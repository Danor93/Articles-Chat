package handlers

import (
	"article-chat-system/server/internal/errors"
	"article-chat-system/server/internal/models"
	"article-chat-system/server/internal/services"
	"article-chat-system/server/internal/validation"
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ChatHandler struct {
	ragClient *services.RAGClient
	cache     services.CacheService
}

func NewChatHandler(ragClient *services.RAGClient, cache services.CacheService) *ChatHandler {
	return &ChatHandler{
		ragClient: ragClient,
		cache:     cache,
	}
}

func (h *ChatHandler) HandleChat(c *fiber.Ctx) error {
	var req models.ChatRequest
	if err := c.BodyParser(&req); err != nil {
		slog.Error("Failed to parse chat request", "error", err)
		return h.errorResponse(c, errors.NewWithDetails(
			errors.ErrBadRequest,
			"Failed to parse request body",
			map[string]string{"parse_error": err.Error()},
		))
	}

	// Sanitize inputs
	req.Message = validation.SanitizeString(req.Message)
	req.ConversationID = validation.SanitizeString(req.ConversationID)

	// Validate request
	if err := validation.ValidateChatRequest(req.Message, req.ConversationID); err != nil {
		return h.errorResponse(c, err)
	}

	// Generate conversation ID if not provided
	if req.ConversationID == "" {
		req.ConversationID = uuid.New().String()
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(c.Context(), 2*time.Minute)
	defer cancel()

	// For now, start with empty conversation history
	// In production, you'd load this from database
	conversationHistory := []models.ChatMessage{}

	// Add user message to history
	userMessage := models.ChatMessage{
		ID:        uuid.New().String(),
		Role:      "user",
		Content:   req.Message,
		Timestamp: time.Now(),
	}
	conversationHistory = append(conversationHistory, userMessage)

	// Handle streaming vs non-streaming
	if req.Stream {
		return h.handleStreamingChat(c, ctx, req, conversationHistory)
	}

	// Generate cache key for non-streaming requests
	conversationContext := fmt.Sprintf("conv_%s", req.ConversationID)
	cacheKey := services.GenerateCacheKey(req.Message, conversationContext)

	// Check cache first
	var cachedResponse models.ChatResponse
	if err := h.cache.Get(ctx, cacheKey, &cachedResponse); err == nil {
		slog.Info("Cache hit for chat request", 
			"conversation_id", req.ConversationID,
			"cache_key", cacheKey[:8]+"...")
		
		// Add cache hit indicator
		cachedResponse.Cached = true
		return c.JSON(cachedResponse)
	}

	slog.Debug("Cache miss for chat request", 
		"conversation_id", req.ConversationID,
		"cache_key", cacheKey[:8]+"...")

	// Process query through RAG service
	response, err := h.ragClient.ProcessChat(ctx, req.Message, req.ConversationID, conversationHistory)
	if err != nil {
		slog.Error("RAG service failed", "error", err, "query", req.Message)
		
		// Check for specific error types
		if strings.Contains(err.Error(), "rag service error") {
			return h.errorResponse(c, errors.New(
				errors.ErrRAGServiceError,
				"RAG service is temporarily unavailable",
			))
		}
		if strings.Contains(err.Error(), "timeout") {
			return h.errorResponse(c, errors.New(
				errors.ErrServiceUnavailable,
				"Request timed out, please try again",
			))
		}
		
		return h.errorResponse(c, errors.New(
			errors.ErrProcessingError,
			"Failed to process your question",
		))
	}

	// Store response in cache with 24 hour TTL
	if cacheErr := h.cache.Set(ctx, cacheKey, response, 24*time.Hour); cacheErr != nil {
		slog.Warn("Failed to cache response", "error", cacheErr, "cache_key", cacheKey[:8]+"...")
		// Don't fail the request if caching fails
	}

	slog.Info("Chat request processed successfully",
		"conversation_id", req.ConversationID,
		"processing_time_ms", response.ProcessingTime,
		"sources_count", len(response.Sources),
		"tokens_used", response.TokensUsed)

	return c.JSON(response)
}

// errorResponse sends a standardized error response
func (h *ChatHandler) errorResponse(c *fiber.Ctx, err error) error {
	requestID := c.Get("X-Request-ID")
	
	if appErr, ok := errors.IsAppError(err); ok {
		appErr.WithRequestID(requestID)
		return c.Status(appErr.StatusCode()).JSON(models.ErrorResponse{
			Error:     string(appErr.Code),
			Message:   appErr.Message,
			Code:      appErr.StatusCode(),
			Timestamp: appErr.Timestamp,
			RequestID: requestID,
		})
	}
	
	// Unknown error
	return c.Status(fiber.StatusInternalServerError).JSON(models.ErrorResponse{
		Error:     string(errors.ErrInternalServer),
		Message:   "An unexpected error occurred",
		Code:      fiber.StatusInternalServerError,
		Timestamp: time.Now(),
		RequestID: requestID,
	})
}

func (h *ChatHandler) handleStreamingChat(c *fiber.Ctx, ctx context.Context, req models.ChatRequest, history []models.ChatMessage) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Access-Control-Allow-Origin", "*")

	// Start streaming
	responseChan, err := h.ragClient.ProcessChatStream(ctx, req.Message, req.ConversationID, history)
	if err != nil {
		slog.Error("Failed to start streaming", "error", err)
		return h.errorResponse(c, errors.New(
			errors.ErrProcessingError,
			"Failed to start streaming response",
		))
	}

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		for {
			select {
			case response, ok := <-responseChan:
				if !ok {
					// Channel closed
					w.Write([]byte("data: {\"type\":\"done\",\"done\":true}\n\n"))
					w.Flush()
					return
				}

				// Send SSE formatted data
				data := fmt.Sprintf("data: %s\n\n", toJSON(response))
				if _, err := w.Write([]byte(data)); err != nil {
					slog.Error("Failed to write streaming response", "error", err)
					return
				}
				w.Flush()

				if response.Done {
					return
				}

			case <-ctx.Done():
				w.Write([]byte("data: {\"type\":\"error\",\"error\":\"request_cancelled\",\"done\":true}\n\n"))
				w.Flush()
				return
			}
		}
	})

	return nil
}