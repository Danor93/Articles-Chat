package models

import (
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system
type User struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	FullName  string     `json:"full_name"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	LastLogin *time.Time `json:"last_login,omitempty"`
	IsActive  bool       `json:"is_active"`
}

// UserCredentials represents user login credentials
type UserCredentials struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

// UserSignup represents user registration data
type UserSignup struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	FullName string `json:"full_name" validate:"required,min=2"`
}

// UserSession represents an active user session
type UserSession struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
	UserAgent string    `json:"user_agent,omitempty"`
	IPAddress string    `json:"ip_address,omitempty"`
}

// UserProfile represents the user profile data
type UserProfile struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	FullName  string     `json:"full_name"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	LastLogin *time.Time `json:"last_login,omitempty"`
}

// UserUpdate represents fields that can be updated
type UserUpdate struct {
	FullName string `json:"full_name,omitempty" validate:"omitempty,min=2"`
}

// AuthResponse represents the response after successful authentication
type AuthResponse struct {
	User  UserProfile `json:"user"`
	Token string      `json:"token"`
}

// Conversation represents a chat conversation
type Conversation struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Title        string    `json:"title"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	MessageCount int       `json:"message_count"`
}

// Message represents a single message in a conversation
type Message struct {
	ID             uuid.UUID              `json:"id"`
	ConversationID uuid.UUID              `json:"conversation_id"`
	Role           string                 `json:"role"` // "user" or "assistant"
	Content        string                 `json:"content"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
}

// ConversationWithMessages represents a conversation with its messages
type ConversationWithMessages struct {
	Conversation
	Messages []Message `json:"messages"`
}

// ConversationCreate represents data for creating a new conversation
type ConversationCreate struct {
	Title string `json:"title,omitempty"`
}

// ConversationUpdate represents data for updating a conversation
type ConversationUpdate struct {
	Title string `json:"title" validate:"required,min=1"`
}