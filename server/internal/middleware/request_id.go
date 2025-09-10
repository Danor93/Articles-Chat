package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// RequestID middleware adds a unique request ID to each request
func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Check if request ID exists in header
		requestID := c.Get("X-Request-ID")

		// Generate new ID if not provided
		if requestID == "" {
			requestID = uuid.New().String()
		}

		// Store in locals for easy access
		c.Locals("requestID", requestID)

		// Add to response header
		c.Set("X-Request-ID", requestID)

		return c.Next()
	}
}
