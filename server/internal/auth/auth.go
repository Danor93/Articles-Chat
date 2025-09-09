package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"time"

	"article-chat-system/server/internal/database"
	"article-chat-system/server/internal/errors"
	"article-chat-system/server/internal/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// AuthService handles authentication operations
type AuthService struct {
	db *database.DB
}

// NewAuthService creates a new authentication service
func NewAuthService(db *database.DB) *AuthService {
	return &AuthService{
		db: db,
	}
}

// GetDB returns the database instance (for specific operations in handlers)
func (s *AuthService) GetDB() *database.DB {
	return s.db
}

// HashPassword hashes a plain text password using bcrypt
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", errors.Wrap(err, errors.ErrInternalServer)
	}
	return string(bytes), nil
}

// CheckPasswordHash compares a plain text password with a hash
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateSessionToken generates a secure random session token
func GenerateSessionToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", errors.Wrap(err, errors.ErrInternalServer)
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// HashToken creates a SHA256 hash of a token for storage
func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// SignupUser creates a new user account
func (s *AuthService) SignupUser(signup *models.UserSignup) (*models.User, error) {
	// Validate email format
	signup.Email = strings.TrimSpace(strings.ToLower(signup.Email))
	
	// Check if email already exists
	exists, err := s.db.CheckEmailExists(signup.Email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New(errors.ErrValidationFailed, "Email already registered")
	}

	// Hash the password
	passwordHash, err := HashPassword(signup.Password)
	if err != nil {
		return nil, err
	}

	// Create the user
	user, err := s.db.CreateUser(signup, passwordHash)
	if err != nil {
		return nil, err
	}

	return user, nil
}

// LoginUser authenticates a user and creates a session
func (s *AuthService) LoginUser(credentials *models.UserCredentials, userAgent, ipAddress string) (*models.User, string, error) {
	// Normalize email
	credentials.Email = strings.TrimSpace(strings.ToLower(credentials.Email))

	// Get user ID and password hash
	userID, passwordHash, err := s.db.GetUserPasswordHash(credentials.Email)
	if err != nil {
		return nil, "", err
	}

	// Verify password
	if !CheckPasswordHash(credentials.Password, passwordHash) {
		return nil, "", errors.New(errors.ErrUnauthorized, "Invalid credentials")
	}

	// Get user details
	user, err := s.db.GetUserByID(userID)
	if err != nil {
		return nil, "", err
	}

	// Generate session token
	token, err := GenerateSessionToken()
	if err != nil {
		return nil, "", err
	}

	// Hash token for storage
	tokenHash := HashToken(token)

	// Create session
	_, err = s.db.CreateSession(user.ID, tokenHash, userAgent, ipAddress)
	if err != nil {
		return nil, "", err
	}

	// Update last login
	if err := s.db.UpdateLastLogin(user.ID); err != nil {
		// Log error but don't fail the login
		// This is a non-critical operation
	}

	return user, token, nil
}

// LogoutUser deletes a user's session
func (s *AuthService) LogoutUser(token string) error {
	tokenHash := HashToken(token)
	return s.db.DeleteSession(tokenHash)
}

// LogoutAllSessions logs out all sessions for a user
func (s *AuthService) LogoutAllSessions(userID uuid.UUID) error {
	return s.db.DeleteUserSessions(userID)
}

// ValidateSession checks if a session token is valid and returns the user
func (s *AuthService) ValidateSession(token string) (*models.User, error) {
	tokenHash := HashToken(token)
	
	// Get session
	session, err := s.db.GetSessionByToken(tokenHash)
	if err != nil {
		return nil, err
	}

	// Check if session is expired
	if session.ExpiresAt.Before(time.Now()) {
		// Clean up expired session
		s.db.DeleteSession(tokenHash)
		return nil, errors.New(errors.ErrUnauthorized, "Session expired")
	}

	// Get user
	user, err := s.db.GetUserByID(session.UserID)
	if err != nil {
		return nil, err
	}

	// Check if user is active
	if !user.IsActive {
		return nil, errors.New(errors.ErrForbidden, "Account deactivated")
	}

	// Optionally extend session on activity
	// This keeps active users logged in
	if time.Until(session.ExpiresAt) < 12*time.Hour {
		s.db.ExtendSession(tokenHash, 24*time.Hour)
	}

	return user, nil
}

// UpdateUserProfile updates a user's profile information
func (s *AuthService) UpdateUserProfile(userID uuid.UUID, update *models.UserUpdate) error {
	return s.db.UpdateUser(userID, update)
}

// GetUserProfile retrieves a user's profile
func (s *AuthService) GetUserProfile(userID uuid.UUID) (*models.UserProfile, error) {
	user, err := s.db.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	profile := &models.UserProfile{
		ID:        user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
		LastLogin: user.LastLogin,
	}

	return profile, nil
}

// ExtractBearerToken extracts token from Authorization header
func ExtractBearerToken(authHeader string) (string, error) {
	if authHeader == "" {
		return "", errors.New(errors.ErrUnauthorized, "Missing authorization header")
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return "", errors.New(errors.ErrUnauthorized, "Invalid authorization header format")
	}

	return parts[1], nil
}