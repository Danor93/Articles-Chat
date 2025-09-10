package database

import (
	"database/sql"
	"time"

	"article-chat-system/server/internal/errors"
	"article-chat-system/server/internal/models"
	"github.com/google/uuid"
)

// CreateSession creates a new user session
func (db *DB) CreateSession(userID uuid.UUID, tokenHash string, userAgent, ipAddress string) (*models.UserSession, error) {
	session := &models.UserSession{
		ID:        uuid.New(),
		UserID:    userID,
		Token:     tokenHash,                      // This should be the hashed token
		ExpiresAt: time.Now().Add(24 * time.Hour), // Sessions expire in 24 hours
		CreatedAt: time.Now(),
		UserAgent: userAgent,
		IPAddress: ipAddress,
	}

	query := `
		INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, expires_at`

	err := db.QueryRow(
		query,
		session.ID,
		session.UserID,
		session.Token,
		session.ExpiresAt,
		session.CreatedAt,
		StringToNullString(session.UserAgent),
		StringToNullString(session.IPAddress),
	).Scan(&session.ID, &session.CreatedAt, &session.ExpiresAt)

	if err != nil {
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return session, nil
}

// GetSessionByToken retrieves a session by its token hash
func (db *DB) GetSessionByToken(tokenHash string) (*models.UserSession, error) {
	session := &models.UserSession{}
	var userAgent, ipAddress sql.NullString

	query := `
		SELECT id, user_id, token_hash, expires_at, created_at, user_agent, ip_address
		FROM user_sessions
		WHERE token_hash = $1 AND expires_at > NOW()`

	err := db.QueryRow(query, tokenHash).Scan(
		&session.ID,
		&session.UserID,
		&session.Token,
		&session.ExpiresAt,
		&session.CreatedAt,
		&userAgent,
		&ipAddress,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New(errors.ErrUnauthorized, "Invalid or expired session")
		}
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	session.UserAgent = NullStringToString(userAgent)
	session.IPAddress = NullStringToString(ipAddress)

	return session, nil
}

// DeleteSession deletes a session (for logout)
func (db *DB) DeleteSession(tokenHash string) error {
	query := `DELETE FROM user_sessions WHERE token_hash = $1`

	result, err := db.Exec(query, tokenHash)
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	if rowsAffected == 0 {
		return errors.New(errors.ErrResourceNotFound, "Session not found")
	}

	return nil
}

// DeleteUserSessions deletes all sessions for a user
func (db *DB) DeleteUserSessions(userID uuid.UUID) error {
	query := `DELETE FROM user_sessions WHERE user_id = $1`

	_, err := db.Exec(query, userID)
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	return nil
}

// ExtendSession extends the expiration time of a session
func (db *DB) ExtendSession(tokenHash string, duration time.Duration) error {
	query := `
		UPDATE user_sessions 
		SET expires_at = NOW() + $2::interval
		WHERE token_hash = $1 AND expires_at > NOW()`

	result, err := db.Exec(query, tokenHash, duration.String())
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	if rowsAffected == 0 {
		return errors.New(errors.ErrUnauthorized, "Invalid or expired session")
	}

	return nil
}

// GetUserActiveSessions retrieves all active sessions for a user
func (db *DB) GetUserActiveSessions(userID uuid.UUID) ([]models.UserSession, error) {
	sessions := []models.UserSession{}

	query := `
		SELECT id, user_id, token_hash, expires_at, created_at, user_agent, ip_address
		FROM user_sessions
		WHERE user_id = $1 AND expires_at > NOW()
		ORDER BY created_at DESC`

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}
	defer rows.Close()

	for rows.Next() {
		var session models.UserSession
		var userAgent, ipAddress sql.NullString

		err := rows.Scan(
			&session.ID,
			&session.UserID,
			&session.Token,
			&session.ExpiresAt,
			&session.CreatedAt,
			&userAgent,
			&ipAddress,
		)
		if err != nil {
			return nil, errors.Wrap(err, errors.ErrDatabaseError)
		}

		session.UserAgent = NullStringToString(userAgent)
		session.IPAddress = NullStringToString(ipAddress)
		sessions = append(sessions, session)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return sessions, nil
}

// CleanupExpiredSessionsForUser removes expired sessions for a specific user
func (db *DB) CleanupExpiredSessionsForUser(userID uuid.UUID) error {
	query := `DELETE FROM user_sessions WHERE user_id = $1 AND expires_at < NOW()`

	_, err := db.Exec(query, userID)
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	return nil
}
