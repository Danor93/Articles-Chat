package database

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
	"article-chat-system/server/internal/errors"
	"article-chat-system/server/internal/models"
)

// CreateConversation creates a new conversation for a user
func (db *DB) CreateConversation(ctx context.Context, userID uuid.UUID, title string) (*models.Conversation, error) {
	query := `
		INSERT INTO conversations (user_id, title)
		VALUES ($1, $2)
		RETURNING id, user_id, title, created_at, updated_at, message_count
	`

	var conv models.Conversation
	err := db.QueryRowContext(ctx, query, userID, title).Scan(
		&conv.ID,
		&conv.UserID,
		&conv.Title,
		&conv.CreatedAt,
		&conv.UpdatedAt,
		&conv.MessageCount,
	)

	if err != nil {
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return &conv, nil
}

// GetConversation retrieves a conversation by ID
func (db *DB) GetConversation(ctx context.Context, conversationID uuid.UUID) (*models.Conversation, error) {
	query := `
		SELECT id, user_id, title, created_at, updated_at, message_count
		FROM conversations
		WHERE id = $1
	`

	var conv models.Conversation
	err := db.QueryRowContext(ctx, query, conversationID).Scan(
		&conv.ID,
		&conv.UserID,
		&conv.Title,
		&conv.CreatedAt,
		&conv.UpdatedAt,
		&conv.MessageCount,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New(errors.ErrResourceNotFound, "Conversation not found")
		}
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return &conv, nil
}

// GetUserConversations retrieves all conversations for a user, ordered by updated_at desc
func (db *DB) GetUserConversations(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.Conversation, error) {
	query := `
		SELECT id, user_id, title, created_at, updated_at, message_count
		FROM conversations
		WHERE user_id = $1
		ORDER BY updated_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := db.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}
	defer rows.Close()

	var conversations []models.Conversation
	for rows.Next() {
		var conv models.Conversation
		err := rows.Scan(
			&conv.ID,
			&conv.UserID,
			&conv.Title,
			&conv.CreatedAt,
			&conv.UpdatedAt,
			&conv.MessageCount,
		)
		if err != nil {
			return nil, errors.Wrap(err, errors.ErrDatabaseError)
		}
		conversations = append(conversations, conv)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return conversations, nil
}

// GetConversationWithMessages retrieves a conversation with all its messages
func (db *DB) GetConversationWithMessages(ctx context.Context, conversationID uuid.UUID) (*models.ConversationWithMessages, error) {
	// First get the conversation
	conv, err := db.GetConversation(ctx, conversationID)
	if err != nil {
		return nil, err
	}

	// Then get all messages
	messages, err := db.GetConversationMessages(ctx, conversationID)
	if err != nil {
		return nil, err
	}

	return &models.ConversationWithMessages{
		Conversation: *conv,
		Messages:     messages,
	}, nil
}

// UpdateConversation updates a conversation's title
func (db *DB) UpdateConversation(ctx context.Context, conversationID uuid.UUID, title string) (*models.Conversation, error) {
	query := `
		UPDATE conversations
		SET title = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING id, user_id, title, created_at, updated_at, message_count
	`

	var conv models.Conversation
	err := db.QueryRowContext(ctx, query, conversationID, title).Scan(
		&conv.ID,
		&conv.UserID,
		&conv.Title,
		&conv.CreatedAt,
		&conv.UpdatedAt,
		&conv.MessageCount,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New(errors.ErrResourceNotFound, "Conversation not found")
		}
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return &conv, nil
}

// DeleteConversation deletes a conversation and all its messages
func (db *DB) DeleteConversation(ctx context.Context, conversationID uuid.UUID) error {
	query := `DELETE FROM conversations WHERE id = $1`

	result, err := db.ExecContext(ctx, query, conversationID)
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	if rowsAffected == 0 {
		return errors.New(errors.ErrResourceNotFound, "Conversation not found")
	}

	return nil
}

// CheckConversationOwnership verifies if a user owns a conversation
func (db *DB) CheckConversationOwnership(ctx context.Context, conversationID, userID uuid.UUID) error {
	query := `SELECT id FROM conversations WHERE id = $1 AND user_id = $2`

	var id uuid.UUID
	err := db.QueryRowContext(ctx, query, conversationID, userID).Scan(&id)
	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New(errors.ErrUnauthorized, "Access denied to conversation")
		}
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	return nil
}

// IncrementMessageCount increments the message count for a conversation
func (db *DB) IncrementMessageCount(ctx context.Context, conversationID uuid.UUID) error {
	query := `
		UPDATE conversations
		SET message_count = message_count + 1, updated_at = NOW()
		WHERE id = $1
	`

	_, err := db.ExecContext(ctx, query, conversationID)
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	return nil
}

// GetConversationCount returns the total number of conversations for a user
func (db *DB) GetConversationCount(ctx context.Context, userID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM conversations WHERE user_id = $1`

	var count int
	err := db.QueryRowContext(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return count, nil
}

// GenerateConversationTitle generates a conversation title based on the first user message
// If no title is provided and no messages exist, returns "New Conversation"
func GenerateConversationTitle(firstMessage string) string {
	if firstMessage == "" {
		return "New Conversation"
	}

	// Truncate to first 50 characters and add ellipsis if needed
	const maxLength = 50
	if len(firstMessage) > maxLength {
		return firstMessage[:maxLength] + "..."
	}

	return firstMessage
}