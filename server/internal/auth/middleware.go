package auth

import (
	"article-chat-system/server/internal/errors"
	"article-chat-system/server/internal/models"

	"github.com/gofiber/fiber/v2"
)

const (
	// UserContextKey is the key used to store user in fiber context
	UserContextKey = "user"
)

// RequireAuth is a middleware that requires a valid session token
func RequireAuth(authService *AuthService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Extract token from Authorization header
		authHeader := c.Get("Authorization")
		token, err := ExtractBearerToken(authHeader)
		if err != nil {
			return handleAuthError(c, err)
		}

		// Validate session
		user, err := authService.ValidateSession(token)
		if err != nil {
			return handleAuthError(c, err)
		}

		// Store user in context for use in handlers
		c.Locals(UserContextKey, user)

		return c.Next()
	}
}

// OptionalAuth has been removed - all endpoints now require authentication except signup/login

// GetUserFromContext retrieves the authenticated user from the fiber context
func GetUserFromContext(c *fiber.Ctx) (*models.User, error) {
	user, ok := c.Locals(UserContextKey).(*models.User)
	if !ok || user == nil {
		return nil, errors.New(errors.ErrUnauthorized, "User not authenticated")
	}
	return user, nil
}

// GetUserFromContextOptional has been removed - all requests are now authenticated

// handleAuthError handles authentication errors consistently
func handleAuthError(c *fiber.Ctx, err error) error {
	if appErr, ok := errors.IsAppError(err); ok {
		return c.Status(appErr.StatusCode()).JSON(fiber.Map{
			"error":   appErr.Code,
			"message": appErr.Message,
		})
	}

	// Default unauthorized response
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"error":   errors.ErrUnauthorized,
		"message": "Authentication required",
	})
}