package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"article-chat-system/server/internal/config"
	"article-chat-system/server/internal/errors"
	_ "github.com/lib/pq" // PostgreSQL driver
)

// DB holds the database connection pool
type DB struct {
	*sql.DB
}

// NewConnection creates a new database connection pool
func NewConnection(cfg *config.Config) (*DB, error) {
	// Validate database URL
	if cfg.Database.URL == "" {
		return nil, errors.New(errors.ErrMissingEnvVar, "DATABASE_URL environment variable is required")
	}

	// Open database connection
	db, err := sql.Open("postgres", cfg.Database.URL)
	if err != nil {
		return nil, errors.New(errors.ErrDatabaseError, fmt.Sprintf("Failed to open database connection: %v", err))
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	// Test the connection with retries for container startup
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	var lastErr error
	for i := 0; i < 3; i++ {
		if err := db.PingContext(ctx); err != nil {
			lastErr = err
			log.Printf("Database connection attempt %d/3 failed: %v", i+1, err)
			if i < 2 {
				time.Sleep(2 * time.Second)
				continue
			}
		} else {
			lastErr = nil
			break
		}
	}

	if lastErr != nil {
		db.Close()
		return nil, errors.New(errors.ErrDatabaseError, fmt.Sprintf("Failed to connect to database after 3 attempts: %v", lastErr))
	}

	log.Println("Successfully connected to PostgreSQL database")

	return &DB{db}, nil
}

// Close closes the database connection pool
func (db *DB) Close() error {
	if db.DB != nil {
		return db.DB.Close()
	}
	return nil
}

// Migrate runs any pending database migrations
// For now, migrations are handled by PostgreSQL init scripts
// This method is a placeholder for future migration tooling
func (db *DB) Migrate() error {
	// In production, you might use a migration library like golang-migrate
	// For now, migrations are handled by the init scripts in data/migrations
	log.Println("Database migrations handled by PostgreSQL init scripts")
	return nil
}

// Transaction helper for executing operations in a transaction
func (db *DB) Transaction(fn func(*sql.Tx) error) error {
	tx, err := db.Begin()
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p) // Re-throw panic after rollback
		}
	}()

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}

	return nil
}

// Helper function to handle null strings from database
func NullStringToString(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

// Helper function to handle null times from database
func NullTimeToTime(nt sql.NullTime) *time.Time {
	if nt.Valid {
		return &nt.Time
	}
	return nil
}

// Helper function to create null string for database
func StringToNullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

// Helper function to create null time for database
func TimeToNullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{Valid: false}
	}
	return sql.NullTime{Time: *t, Valid: true}
}

// CleanupExpiredSessions removes expired sessions from the database
// This should be called periodically (e.g., every hour)
func (db *DB) CleanupExpiredSessions() error {
	_, err := db.Exec("SELECT cleanup_expired_sessions()")
	if err != nil {
		return errors.Wrap(err, errors.ErrDatabaseError)
	}
	return nil
}
