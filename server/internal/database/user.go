package database

import (
	"database/sql"
	"time"

	"article-chat-system/server/internal/errors"
	"article-chat-system/server/internal/models"
	"github.com/google/uuid"
)

// CreateUser creates a new user in the database
func (db *DB) CreateUser(user *models.UserSignup, passwordHash string) (*models.User, error) {
	newUser := &models.User{
		ID:        uuid.New(),
		Email:     user.Email,
		FullName:  user.FullName,
		IsActive:  true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	query := `
		INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`

	err := db.QueryRow(
		query,
		newUser.ID,
		newUser.Email,
		passwordHash,
		newUser.FullName,
		newUser.CreatedAt,
		newUser.UpdatedAt,
		newUser.IsActive,
	).Scan(&newUser.ID, &newUser.CreatedAt, &newUser.UpdatedAt)

	if err != nil {
		// Check for unique constraint violation (duplicate email)
		if err.Error() == `pq: duplicate key value violates unique constraint "users_email_key"` {
			return nil, errors.New(errors.ErrValidationFailed, "Email already exists")
		}
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return newUser, nil
}

// GetUserByEmail retrieves a user by their email address
func (db *DB) GetUserByEmail(email string) (*models.User, error) {
	user := &models.User{}
	var lastLogin sql.NullTime

	query := `
		SELECT id, email, full_name, created_at, updated_at, last_login, is_active
		FROM users
		WHERE email = $1`

	err := db.QueryRow(query, email).Scan(
		&user.ID,
		&user.Email,
		&user.FullName,
		&user.CreatedAt,
		&user.UpdatedAt,
		&lastLogin,
		&user.IsActive,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New(errors.ErrResourceNotFound, "User not found")
		}
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	user.LastLogin = NullTimeToTime(lastLogin)
	return user, nil
}

// GetUserByID retrieves a user by their ID
func (db *DB) GetUserByID(userID uuid.UUID) (*models.User, error) {
	user := &models.User{}
	var lastLogin sql.NullTime

	query := `
		SELECT id, email, full_name, created_at, updated_at, last_login, is_active
		FROM users
		WHERE id = $1`

	err := db.QueryRow(query, userID).Scan(
		&user.ID,
		&user.Email,
		&user.FullName,
		&user.CreatedAt,
		&user.UpdatedAt,
		&lastLogin,
		&user.IsActive,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New(errors.ErrResourceNotFound, "User not found")
		}
		return nil, errors.Wrap(err, errors.ErrDatabaseError)
	}

	user.LastLogin = NullTimeToTime(lastLogin)
	return user, nil
}

// GetUserPasswordHash retrieves the password hash for authentication
func (db *DB) GetUserPasswordHash(email string) (uuid.UUID, string, error) {
	var userID uuid.UUID
	var passwordHash string

	query := `SELECT id, password_hash FROM users WHERE email = $1 AND is_active = true`
	
	err := db.QueryRow(query, email).Scan(&userID, &passwordHash)
	if err != nil {
		if err == sql.ErrNoRows {
			return uuid.Nil, "", errors.New(errors.ErrUnauthorized, "Invalid credentials")
		}
		return uuid.Nil, "", errors.Wrap(err, errors.ErrDatabaseError)
	}

	return userID, passwordHash, nil
}

// UpdateUser updates a user's profile information
func (db *DB) UpdateUser(userID uuid.UUID, update *models.UserUpdate) error {
	query := `
		UPDATE users 
		SET full_name = $2, updated_at = NOW()
		WHERE id = $1`

	result, err := db.Exec(query, userID, update.FullName)
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	if rowsAffected == 0 {
		return errors.New(errors.ErrResourceNotFound, "User not found")
	}

	return nil
}

// UpdateLastLogin updates the user's last login timestamp
func (db *DB) UpdateLastLogin(userID uuid.UUID) error {
	query := `UPDATE users SET last_login = NOW() WHERE id = $1`
	
	_, err := db.Exec(query, userID)
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	return nil
}

// DeactivateUser soft deletes a user by setting is_active to false
func (db *DB) DeactivateUser(userID uuid.UUID) error {
	query := `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`
	
	result, err := db.Exec(query, userID)
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	if rowsAffected == 0 {
		return errors.New(errors.ErrResourceNotFound, "User not found")
	}

	return nil
}

// CheckEmailExists checks if an email already exists in the database
func (db *DB) CheckEmailExists(email string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`
	
	err := db.QueryRow(query, email).Scan(&exists)
	if err != nil {
		return false, errors.Wrap(err, errors.ErrDatabaseError)
	}

	return exists, nil
}