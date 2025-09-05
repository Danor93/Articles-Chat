package handlers

import (
	"article-chat-system/server/internal/models"
	"article-chat-system/server/internal/services"
	"bufio"
	"context"
	"fmt"
	"log/slog"
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
		return c.Status(fiber.StatusBadRequest).JSON(models.ErrorResponse{
			Error:     "invalid_request",
			Message:   "Failed to parse request body",
			Code:      fiber.StatusBadRequest,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})
	}

	// Validate request
	if req.Message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(models.ErrorResponse{
			Error:     "missing_message",
			Message:   "Message is required",
			Code:      fiber.StatusBadRequest,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})
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
		return c.Status(fiber.StatusInternalServerError).JSON(models.ErrorResponse{
			Error:     "processing_failed",
			Message:   "Failed to process your question",
			Code:      fiber.StatusInternalServerError,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})
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

func (h *ChatHandler) handleStreamingChat(c *fiber.Ctx, ctx context.Context, req models.ChatRequest, history []models.ChatMessage) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Access-Control-Allow-Origin", "*")

	// Start streaming
	responseChan, err := h.ragClient.ProcessChatStream(ctx, req.Message, req.ConversationID, history)
	if err != nil {
		slog.Error("Failed to start streaming", "error", err)
		return c.Status(fiber.StatusInternalServerError).JSON(models.ErrorResponse{
			Error:     "streaming_failed",
			Message:   "Failed to start streaming response",
			Code:      fiber.StatusInternalServerError,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})
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