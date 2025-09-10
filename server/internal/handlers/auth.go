package handlers

import (
	"log/slog"
	"regexp"
	"strings"

	"article-chat-system/server/internal/auth"
	"article-chat-system/server/internal/errors"
	"article-chat-system/server/internal/models"

	"github.com/gofiber/fiber/v2"
)

// AuthHandler handles authentication-related requests
type AuthHandler struct {
	authService *auth.AuthService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService *auth.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// HandleSignup handles user registration
func (h *AuthHandler) HandleSignup(c *fiber.Ctx) error {
	var signup models.UserSignup

	// Parse request body
	if err := c.BodyParser(&signup); err != nil {
		slog.Debug("Failed to parse signup request", "error", err)
		return errors.New(errors.ErrBadRequest, "Invalid request body")
	}

	// Validate input
	if err := validateUserSignup(&signup); err != nil {
		return err
	}

	// Create user
	user, err := h.authService.SignupUser(&signup)
	if err != nil {
		return err
	}

	// Log user creation
	slog.Info("New user registered", "user_id", user.ID, "email", user.Email)

	// Return user profile
	profile := models.UserProfile{
		ID:        user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"user":    profile,
		"message": "Registration successful. Please login to continue.",
	})
}

// HandleLogin handles user login
func (h *AuthHandler) HandleLogin(c *fiber.Ctx) error {
	var credentials models.UserCredentials

	// Parse request body
	if err := c.BodyParser(&credentials); err != nil {
		slog.Debug("Failed to parse login request", "error", err)
		return errors.New(errors.ErrBadRequest, "Invalid request body")
	}

	// Validate input
	if err := validateUserCredentials(&credentials); err != nil {
		return err
	}

	// Get client info for session
	userAgent := c.Get("User-Agent")
	ipAddress := c.IP()

	// Authenticate user
	user, token, err := h.authService.LoginUser(&credentials, userAgent, ipAddress)
	if err != nil {
		return err
	}

	// Create auth response
	profile := models.UserProfile{
		ID:        user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
		LastLogin: user.LastLogin,
	}

	response := models.AuthResponse{
		User:  profile,
		Token: token,
	}

	slog.Info("User logged in", "user_id", user.ID, "email", user.Email)

	return c.JSON(response)
}

// HandleLogout handles user logout
func (h *AuthHandler) HandleLogout(c *fiber.Ctx) error {
	// Extract token
	authHeader := c.Get("Authorization")
	token, err := auth.ExtractBearerToken(authHeader)
	if err != nil {
		return err
	}

	// Logout user
	if err := h.authService.LogoutUser(token); err != nil {
		return err
	}

	slog.Info("User logged out")

	return c.JSON(fiber.Map{
		"message": "Logged out successfully",
	})
}

// HandleLogoutAll logs out all sessions for the authenticated user
func (h *AuthHandler) HandleLogoutAll(c *fiber.Ctx) error {
	// Get authenticated user
	user, err := auth.GetUserFromContext(c)
	if err != nil {
		return err
	}

	// Logout all sessions
	if err := h.authService.LogoutAllSessions(user.ID); err != nil {
		return err
	}

	slog.Info("All sessions logged out", "user_id", user.ID)

	return c.JSON(fiber.Map{
		"message": "All sessions logged out successfully",
	})
}

// HandleGetProfile returns the authenticated user's profile
func (h *AuthHandler) HandleGetProfile(c *fiber.Ctx) error {
	// Get authenticated user
	user, err := auth.GetUserFromContext(c)
	if err != nil {
		return err
	}

	// Get profile
	profile, err := h.authService.GetUserProfile(user.ID)
	if err != nil {
		return err
	}

	return c.JSON(profile)
}

// HandleUpdateProfile updates the authenticated user's profile
func (h *AuthHandler) HandleUpdateProfile(c *fiber.Ctx) error {
	// Get authenticated user
	user, err := auth.GetUserFromContext(c)
	if err != nil {
		return err
	}

	var update models.UserUpdate

	// Parse request body
	if err := c.BodyParser(&update); err != nil {
		slog.Debug("Failed to parse update request", "error", err)
		return errors.New(errors.ErrBadRequest, "Invalid request body")
	}

	// Validate input
	if err := validateUserUpdate(&update); err != nil {
		return err
	}

	// Update profile
	if err := h.authService.UpdateUserProfile(user.ID, &update); err != nil {
		return err
	}

	// Get updated profile
	profile, err := h.authService.GetUserProfile(user.ID)
	if err != nil {
		return err
	}

	slog.Info("User profile updated", "user_id", user.ID)

	return c.JSON(profile)
}

// HandleCheckEmail checks if an email is already registered
func (h *AuthHandler) HandleCheckEmail(c *fiber.Ctx) error {
	email := strings.TrimSpace(strings.ToLower(c.Query("email")))

	if email == "" {
		return errors.New(errors.ErrMissingRequiredField, "Email is required")
	}

	// Basic email validation
	if !strings.Contains(email, "@") || !strings.Contains(email, ".") {
		return errors.New(errors.ErrValidationFailed, "Invalid email format")
	}

	exists, err := h.authService.GetDB().CheckEmailExists(email)
	if err != nil {
		return err
	}

	return c.JSON(fiber.Map{
		"exists": exists,
	})
}

// Validation functions

func validateUserSignup(signup *models.UserSignup) error {
	if signup.Email == "" {
		return errors.New(errors.ErrMissingRequiredField, "Email is required")
	}
	if signup.Password == "" {
		return errors.New(errors.ErrMissingRequiredField, "Password is required")
	}
	if signup.FullName == "" {
		return errors.New(errors.ErrMissingRequiredField, "Full name is required")
	}

	// Validate email format
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(signup.Email) {
		return errors.New(errors.ErrValidationFailed, "Invalid email format")
	}

	// Validate password length
	if len(signup.Password) < 8 {
		return errors.New(errors.ErrValidationFailed, "Password must be at least 8 characters long")
	}

	// Validate full name length
	if len(strings.TrimSpace(signup.FullName)) < 2 {
		return errors.New(errors.ErrValidationFailed, "Full name must be at least 2 characters long")
	}

	return nil
}

func validateUserCredentials(creds *models.UserCredentials) error {
	if creds.Email == "" {
		return errors.New(errors.ErrMissingRequiredField, "Email is required")
	}
	if creds.Password == "" {
		return errors.New(errors.ErrMissingRequiredField, "Password is required")
	}

	// Validate email format
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(creds.Email) {
		return errors.New(errors.ErrValidationFailed, "Invalid email format")
	}

	return nil
}

func validateUserUpdate(update *models.UserUpdate) error {
	if update.FullName != "" && len(strings.TrimSpace(update.FullName)) < 2 {
		return errors.New(errors.ErrValidationFailed, "Full name must be at least 2 characters long")
	}
	return nil
}
