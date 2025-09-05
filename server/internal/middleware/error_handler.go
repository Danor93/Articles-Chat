package middleware

import (
	"article-chat-system/server/internal/errors"
	"article-chat-system/server/internal/models"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
)

// ErrorHandler is a centralized error handler middleware
func ErrorHandler() fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		// Get request ID
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = c.Locals("requestID").(string)
		}

		// Log the error
		slog.Error("Request failed",
			"error", err,
			"method", c.Method(),
			"path", c.Path(),
			"request_id", requestID,
		)

		// Check if it's an AppError
		if appErr, ok := errors.IsAppError(err); ok {
			return c.Status(appErr.StatusCode()).JSON(models.ErrorResponse{
				Error:     string(appErr.Code),
				Message:   appErr.Message,
				Code:      appErr.StatusCode(),
				Timestamp: appErr.Timestamp,
				RequestID: requestID,
			})
		}

		// Check if it's a Fiber error
		if fiberErr, ok := err.(*fiber.Error); ok {
			code := errors.ErrInternalServer
			switch fiberErr.Code {
			case fiber.StatusBadRequest:
				code = errors.ErrBadRequest
			case fiber.StatusUnauthorized:
				code = errors.ErrUnauthorized
			case fiber.StatusForbidden:
				code = errors.ErrForbidden
			case fiber.StatusNotFound:
				code = errors.ErrResourceNotFound
			case fiber.StatusTooManyRequests:
				code = errors.ErrRateLimitExceeded
			case fiber.StatusServiceUnavailable:
				code = errors.ErrServiceUnavailable
			}

			return c.Status(fiberErr.Code).JSON(models.ErrorResponse{
				Error:     string(code),
				Message:   fiberErr.Message,
				Code:      fiberErr.Code,
				Timestamp: time.Now(),
				RequestID: requestID,
			})
		}

		// Default error response
		return c.Status(fiber.StatusInternalServerError).JSON(models.ErrorResponse{
			Error:     string(errors.ErrInternalServer),
			Message:   "An unexpected error occurred",
			Code:      fiber.StatusInternalServerError,
			Timestamp: time.Now(),
			RequestID: requestID,
		})
	}
}