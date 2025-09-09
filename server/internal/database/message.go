package database

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/google/uuid"
	"article-chat-system/server/internal/errors"
	"article-chat-system/server/internal/models"
)

// CreateMessage creates a new message in a conversation
func (db *DB) CreateMessage(ctx context.Context, conversationID uuid.UUID, role, content string, metadata map[string]interface{}) (*models.Message, error) {
	// Convert metadata to JSON
	var metadataJSON []byte
	var err error
	if metadata != nil {
		metadataJSON, err = json.Marshal(metadata)
		if err != nil {
			return nil, errors.Wrap(err, errors.ErrInvalidDataType)
		}
	}

	query := `
		INSERT INTO messages (conversation_id, role, content, metadata)
		VALUES ($1, $2, $3, $4)
		RETURNING id, conversation_id, role, content, metadata, created_at
	`

	var message models.Message
	var metadataStr sql.NullString

	err = db.QueryRowContext(ctx, query, conversationID, role, content, metadataJSON).Scan(
		&message.ID,
		&message.ConversationID,
		&message.Role,
		&message.Content,
		&metadataStr,
		&message.CreatedAt,
	)

	if err != nil {
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	// Parse metadata if exists
	if metadataStr.Valid && metadataStr.String != "" {
		err = json.Unmarshal([]byte(metadataStr.String), &message.Metadata)
		if err != nil {
			return nil, errors.Wrap(err, errors.ErrDatabaseError)
		}
	} else {
		message.Metadata = nil
	}

	return &message, nil
}

// GetMessage retrieves a message by ID
func (db *DB) GetMessage(ctx context.Context, messageID uuid.UUID) (*models.Message, error) {
	query := `
		SELECT id, conversation_id, role, content, metadata, created_at
		FROM messages
		WHERE id = $1
	`

	var message models.Message
	var metadataStr sql.NullString

	err := db.QueryRowContext(ctx, query, messageID).Scan(
		&message.ID,
		&message.ConversationID,
		&message.Role,
		&message.Content,
		&metadataStr,
		&message.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New(errors.ErrResourceNotFound, "Message not found")
		}
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	// Parse metadata if exists
	if metadataStr.Valid && metadataStr.String != "" {
		err = json.Unmarshal([]byte(metadataStr.String), &message.Metadata)
		if err != nil {
			return nil, errors.Wrap(err, errors.ErrDatabaseError)
		}
	} else {
		message.Metadata = nil
	}

	return &message, nil
}

// GetConversationMessages retrieves all messages for a conversation, ordered by created_at
func (db *DB) GetConversationMessages(ctx context.Context, conversationID uuid.UUID) ([]models.Message, error) {
	query := `
		SELECT id, conversation_id, role, content, metadata, created_at
		FROM messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC
	`

	rows, err := db.QueryContext(ctx, query, conversationID)
	if err != nil {
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var message models.Message
		var metadataStr sql.NullString

		err := rows.Scan(
			&message.ID,
			&message.ConversationID,
			&message.Role,
			&message.Content,
			&metadataStr,
			&message.CreatedAt,
		)
		if err != nil {
			return nil, errors.Wrap(err, errors.ErrDatabaseError)
		}

		// Parse metadata if exists
		if metadataStr.Valid {
			err = json.Unmarshal([]byte(metadataStr.String), &message.Metadata)
			if err != nil {
				return nil, errors.Wrap(err, errors.ErrDatabaseError)
			}
		}

		messages = append(messages, message)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return messages, nil
}

// GetConversationMessagesPaginated retrieves messages for a conversation with pagination
func (db *DB) GetConversationMessagesPaginated(ctx context.Context, conversationID uuid.UUID, limit, offset int) ([]models.Message, error) {
	query := `
		SELECT id, conversation_id, role, content, metadata, created_at
		FROM messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC
		LIMIT $2 OFFSET $3
	`

	rows, err := db.QueryContext(ctx, query, conversationID, limit, offset)
	if err != nil {
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var message models.Message
		var metadataStr sql.NullString

		err := rows.Scan(
			&message.ID,
			&message.ConversationID,
			&message.Role,
			&message.Content,
			&metadataStr,
			&message.CreatedAt,
		)
		if err != nil {
			return nil, errors.Wrap(err, errors.ErrDatabaseError)
		}

		// Parse metadata if exists
		if metadataStr.Valid {
			err = json.Unmarshal([]byte(metadataStr.String), &message.Metadata)
			if err != nil {
				return nil, errors.Wrap(err, errors.ErrDatabaseError)
			}
		}

		messages = append(messages, message)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return messages, nil
}

// DeleteMessage deletes a message by ID
func (db *DB) DeleteMessage(ctx context.Context, messageID uuid.UUID) error {
	query := `DELETE FROM messages WHERE id = $1`

	result, err := db.ExecContext(ctx, query, messageID)
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	if rowsAffected == 0 {
		return errors.New(errors.ErrResourceNotFound, "Message not found")
	}

	return nil
}

// GetMessageCount returns the total number of messages in a conversation
func (db *DB) GetMessageCount(ctx context.Context, conversationID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM messages WHERE conversation_id = $1`

	var count int
	err := db.QueryRowContext(ctx, query, conversationID).Scan(&count)
	if err != nil {
		return 0, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return count, nil
}

// CreateMessagePair creates both user and assistant messages in a single transaction
// This is useful when persisting chat interactions
func (db *DB) CreateMessagePair(ctx context.Context, conversationID uuid.UUID, userContent, assistantContent string, assistantMetadata map[string]interface{}) (*models.Message, *models.Message, error) {
	var userMessage, assistantMessage *models.Message
	var err error

	err = db.Transaction(func(tx *sql.Tx) error {
		// Create user message
		query := `
			INSERT INTO messages (conversation_id, role, content)
			VALUES ($1, $2, $3)
			RETURNING id, conversation_id, role, content, metadata, created_at
		`

		var userMsg models.Message
		var userMetadataStr sql.NullString
		err = tx.QueryRowContext(ctx, query, conversationID, "user", userContent).Scan(
			&userMsg.ID,
			&userMsg.ConversationID,
			&userMsg.Role,
			&userMsg.Content,
			&userMetadataStr,
			&userMsg.CreatedAt,
		)
		if err != nil {
			return errors.Wrap(err, errors.ErrDatabaseError)
		}
		
		// Parse user metadata if exists (usually null for user messages)
		if userMetadataStr.Valid && userMetadataStr.String != "" {
			err = json.Unmarshal([]byte(userMetadataStr.String), &userMsg.Metadata)
			if err != nil {
				return errors.Wrap(err, errors.ErrDatabaseError)
			}
		} else {
			userMsg.Metadata = nil
		}
		userMessage = &userMsg

		// Create assistant message
		var metadataJSON []byte
		if assistantMetadata != nil {
			metadataJSON, err = json.Marshal(assistantMetadata)
			if err != nil {
				return errors.Wrap(err, errors.ErrInvalidDataType)
			}
		}

		query = `
			INSERT INTO messages (conversation_id, role, content, metadata)
			VALUES ($1, $2, $3, $4)
			RETURNING id, conversation_id, role, content, metadata, created_at
		`

		var assistantMsg models.Message
		var metadataStr sql.NullString
		err = tx.QueryRowContext(ctx, query, conversationID, "assistant", assistantContent, metadataJSON).Scan(
			&assistantMsg.ID,
			&assistantMsg.ConversationID,
			&assistantMsg.Role,
			&assistantMsg.Content,
			&metadataStr,
			&assistantMsg.CreatedAt,
		)
		if err != nil {
			return errors.Wrap(err, errors.ErrDatabaseError)
		}

		// Parse metadata if exists
		if metadataStr.Valid && metadataStr.String != "" {
			err = json.Unmarshal([]byte(metadataStr.String), &assistantMsg.Metadata)
			if err != nil {
				return errors.Wrap(err, errors.ErrDatabaseError)
			}
		} else {
			assistantMsg.Metadata = nil
		}
		assistantMessage = &assistantMsg

		// Update conversation message count (+2 for both messages)
		updateQuery := `
			UPDATE conversations
			SET message_count = message_count + 2, updated_at = NOW()
			WHERE id = $1
		`
		_, err = tx.ExecContext(ctx, updateQuery, conversationID)
		if err != nil {
			return errors.Wrap(err, errors.ErrDatabaseError)
		}

		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	return userMessage, assistantMessage, nil
}

// GetFirstUserMessage retrieves the first user message in a conversation (for title generation)
func (db *DB) GetFirstUserMessage(ctx context.Context, conversationID uuid.UUID) (*models.Message, error) {
	query := `
		SELECT id, conversation_id, role, content, metadata, created_at
		FROM messages
		WHERE conversation_id = $1 AND role = 'user'
		ORDER BY created_at ASC
		LIMIT 1
	`

	var message models.Message
	var metadataStr sql.NullString

	err := db.QueryRowContext(ctx, query, conversationID).Scan(
		&message.ID,
		&message.ConversationID,
		&message.Role,
		&message.Content,
		&metadataStr,
		&message.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New(errors.ErrResourceNotFound, "No user message found")
		}
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	// Parse metadata if exists
	if metadataStr.Valid && metadataStr.String != "" {
		err = json.Unmarshal([]byte(metadataStr.String), &message.Metadata)
		if err != nil {
			return nil, errors.Wrap(err, errors.ErrDatabaseError)
		}
	} else {
		message.Metadata = nil
	}

	return &message, nil
}