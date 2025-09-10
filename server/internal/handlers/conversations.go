package handlers

import (
	"log/slog"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"article-chat-system/server/internal/auth"
	"article-chat-system/server/internal/database"
	"article-chat-system/server/internal/errors"
	"article-chat-system/server/internal/models"
)

// ConversationHandler handles conversation-related requests
type ConversationHandler struct {
	db *database.DB
}

// NewConversationHandler creates a new conversation handler
func NewConversationHandler(db *database.DB) *ConversationHandler {
	return &ConversationHandler{
		db: db,
	}
}

// HandleListConversations returns all conversations for the authenticated user
func (h *ConversationHandler) HandleListConversations(c *fiber.Ctx) error {
	// Get authenticated user
	user, err := auth.GetUserFromContext(c)
	if err != nil {
		return err
	}

	// Parse pagination parameters
	limit, offset, err := parsePaginationParams(c)
	if err != nil {
		return err
	}

	// Get conversations
	conversations, err := h.db.GetUserConversations(c.Context(), user.ID, limit, offset)
	if err != nil {
		return err
	}

	// Get total count for pagination
	totalCount, err := h.db.GetConversationCount(c.Context(), user.ID)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"conversations": conversations,
		"pagination": fiber.Map{
			"limit":       limit,
			"offset":      offset,
			"total_count": totalCount,
			"has_more":    offset+len(conversations) < totalCount,
		},
	})
}

// HandleCreateConversation creates a new conversation
func (h *ConversationHandler) HandleCreateConversation(c *fiber.Ctx) error {
	// Get authenticated user
	user, err := auth.GetUserFromContext(c)
	if err != nil {
		return err
	}

	var create models.ConversationCreate

	// Parse request body
	if err := c.BodyParser(&create); err != nil {
		slog.Debug("Failed to parse create conversation request", "error", err)
		return errors.New(errors.ErrBadRequest, "Invalid request body")
	}

	// Validate and set title
	title := strings.TrimSpace(create.Title)
	if title == "" {
		title = "New Conversation"
	}

	// Create conversation
	conversation, err := h.db.CreateConversation(c.Context(), user.ID, title)
	if err != nil {
		return err
	}

	slog.Info("New conversation created", "conversation_id", conversation.ID, "user_id", user.ID, "title", conversation.Title)

	return c.Status(fiber.StatusCreated).JSON(conversation)
}

// HandleGetConversation returns a conversation with all its messages
func (h *ConversationHandler) HandleGetConversation(c *fiber.Ctx) error {
	// Get authenticated user
	user, err := auth.GetUserFromContext(c)
	if err != nil {
		return err
	}

	// Parse conversation ID
	conversationID, err := parseUUIDParam(c, "id")
	if err != nil {
		return err
	}

	// Check if user owns the conversation
	if err := h.db.CheckConversationOwnership(c.Context(), conversationID, user.ID); err != nil {
		return err
	}

	// Get conversation with messages
	conversation, err := h.db.GetConversationWithMessages(c.Context(), conversationID)
	if err != nil {
		return err
	}

	return c.JSON(conversation)
}

// HandleGetConversationMessages returns messages for a conversation with pagination
func (h *ConversationHandler) HandleGetConversationMessages(c *fiber.Ctx) error {
	// Get authenticated user
	user, err := auth.GetUserFromContext(c)
	if err != nil {
		return err
	}

	// Parse conversation ID
	conversationID, err := parseUUIDParam(c, "id")
	if err != nil {
		return err
	}

	// Check if user owns the conversation
	if err := h.db.CheckConversationOwnership(c.Context(), conversationID, user.ID); err != nil {
		return err
	}

	// Parse pagination parameters
	limit, offset, err := parsePaginationParams(c)
	if err != nil {
		return err
	}

	// Get messages
	messages, err := h.db.GetConversationMessagesPaginated(c.Context(), conversationID, limit, offset)
	if err != nil {
		return err
	}

	// Get total count
	totalCount, err := h.db.GetMessageCount(c.Context(), conversationID)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"messages": messages,
		"pagination": fiber.Map{
			"limit":       limit,
			"offset":      offset,
			"total_count": totalCount,
			"has_more":    offset+len(messages) < totalCount,
		},
	})
}

// HandleUpdateConversation updates a conversation's title
func (h *ConversationHandler) HandleUpdateConversation(c *fiber.Ctx) error {
	// Get authenticated user
	user, err := auth.GetUserFromContext(c)
	if err != nil {
		return err
	}

	// Parse conversation ID
	conversationID, err := parseUUIDParam(c, "id")
	if err != nil {
		return err
	}

	// Check if user owns the conversation
	if err := h.db.CheckConversationOwnership(c.Context(), conversationID, user.ID); err != nil {
		return err
	}

	var update models.ConversationUpdate

	// Parse request body
	if err := c.BodyParser(&update); err != nil {
		slog.Debug("Failed to parse update conversation request", "error", err)
		return errors.New(errors.ErrBadRequest, "Invalid request body")
	}

	// Validate title
	if err := validateConversationUpdate(&update); err != nil {
		return err
	}

	// Update conversation
	conversation, err := h.db.UpdateConversation(c.Context(), conversationID, update.Title)
	if err != nil {
		return err
	}

	slog.Info("Conversation updated", "conversation_id", conversationID, "user_id", user.ID, "new_title", update.Title)

	return c.JSON(conversation)
}

// HandleDeleteConversation deletes a conversation and all its messages
func (h *ConversationHandler) HandleDeleteConversation(c *fiber.Ctx) error {
	// Get authenticated user
	user, err := auth.GetUserFromContext(c)
	if err != nil {
		return err
	}

	// Parse conversation ID
	conversationID, err := parseUUIDParam(c, "id")
	if err != nil {
		return err
	}

	// Check if user owns the conversation
	if err := h.db.CheckConversationOwnership(c.Context(), conversationID, user.ID); err != nil {
		return err
	}

	// Delete conversation
	if err := h.db.DeleteConversation(c.Context(), conversationID); err != nil {
		return err
	}

	slog.Info("Conversation deleted", "conversation_id", conversationID, "user_id", user.ID)

	return c.JSON(fiber.Map{
		"message": "Conversation deleted successfully",
	})
}

// Helper functions

// parsePaginationParams parses limit and offset from query parameters
func parsePaginationParams(c *fiber.Ctx) (limit, offset int, err error) {
	// Parse limit (default: 20, max: 100)
	limitStr := c.Query("limit", "20")
	limit, err = strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	// Parse offset (default: 0)
	offsetStr := c.Query("offset", "0")
	offset, err = strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	return limit, offset, nil
}

// parseUUIDParam parses a UUID parameter from the URL
func parseUUIDParam(c *fiber.Ctx, paramName string) (uuid.UUID, error) {
	idStr := c.Params(paramName)
	if idStr == "" {
		return uuid.UUID{}, errors.New(errors.ErrMissingRequiredField, paramName+" is required")
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		return uuid.UUID{}, errors.New(errors.ErrInvalidDataType, "Invalid "+paramName+" format")
	}

	return id, nil
}

// validateConversationUpdate validates conversation update data
func validateConversationUpdate(update *models.ConversationUpdate) error {
	if strings.TrimSpace(update.Title) == "" {
		return errors.New(errors.ErrMissingRequiredField, "Title is required")
	}

	if len(strings.TrimSpace(update.Title)) > 255 {
		return errors.New(errors.ErrValidationFailed, "Title must be 255 characters or less")
	}

	// Clean the title
	update.Title = strings.TrimSpace(update.Title)

	return nil
}
