package validation

import (
	"article-chat-system/server/internal/errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

// ValidateChatRequest validates a chat request
func ValidateChatRequest(message string, conversationID string) error {
	// Validate message
	if message == "" {
		return errors.New(errors.ErrMissingRequiredField, "message is required")
	}

	if len(message) > 4000 {
		return errors.NewWithDetails(
			errors.ErrValidationFailed,
			"message exceeds maximum length",
			map[string]interface{}{
				"max_length": 4000,
				"actual":     len(message),
			},
		)
	}

	// Validate conversation ID if provided
	if conversationID != "" && !isValidConversationID(conversationID) {
		return errors.New(
			errors.ErrInvalidConversationID,
			"conversation ID must contain only alphanumeric characters, hyphens, and underscores",
		)
	}

	return nil
}

// ValidateArticleURL validates an article URL
func ValidateArticleURL(urlStr string) error {
	if urlStr == "" {
		return errors.New(errors.ErrMissingRequiredField, "url is required")
	}

	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return errors.NewWithDetails(
			errors.ErrValidationFailed,
			"invalid URL format",
			map[string]string{"error": err.Error()},
		)
	}

	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return errors.New(
			errors.ErrValidationFailed,
			"URL must use http or https protocol",
		)
	}

	if parsedURL.Host == "" {
		return errors.New(
			errors.ErrValidationFailed,
			"URL must include a valid host",
		)
	}

	return nil
}

// ValidateBatchArticleURLs validates a batch of article URLs
func ValidateBatchArticleURLs(urls []string) error {
	if len(urls) == 0 {
		return errors.New(errors.ErrMissingRequiredField, "urls array is required and cannot be empty")
	}

	if len(urls) > 100 {
		return errors.NewWithDetails(
			errors.ErrValidationFailed,
			"cannot process more than 100 URLs at once",
			map[string]interface{}{
				"max_allowed": 100,
				"actual":      len(urls),
			},
		)
	}

	var invalidURLs []string
	for _, urlStr := range urls {
		if err := ValidateArticleURL(urlStr); err != nil {
			invalidURLs = append(invalidURLs, urlStr)
		}
	}

	if len(invalidURLs) > 0 {
		return errors.NewWithDetails(
			errors.ErrValidationFailed,
			fmt.Sprintf("found %d invalid URLs", len(invalidURLs)),
			map[string]interface{}{
				"invalid_urls": invalidURLs,
			},
		)
	}

	return nil
}

// ValidatePagination validates pagination parameters
func ValidatePagination(limit, offset int) error {
	if limit < 0 || limit > 100 {
		return errors.NewWithDetails(
			errors.ErrValidationFailed,
			"limit must be between 0 and 100",
			map[string]interface{}{
				"limit": limit,
			},
		)
	}

	if offset < 0 {
		return errors.NewWithDetails(
			errors.ErrValidationFailed,
			"offset must be non-negative",
			map[string]interface{}{
				"offset": offset,
			},
		)
	}

	return nil
}

// isValidConversationID checks if a conversation ID is valid
func isValidConversationID(id string) bool {
	if id == "" {
		return false
	}
	// Allow alphanumeric, hyphens, and underscores
	validPattern := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	return validPattern.MatchString(id)
}

// SanitizeString removes potentially harmful characters from a string
func SanitizeString(input string) string {
	// Remove control characters
	input = strings.TrimSpace(input)
	// Remove null bytes and other control characters
	cleaned := strings.Map(func(r rune) rune {
		if r < 32 && r != '\n' && r != '\r' && r != '\t' {
			return -1
		}
		return r
	}, input)
	return cleaned
}

// ValidateStruct validates a struct using reflection (simplified implementation)
func ValidateStruct(v interface{}) error {
	// This is a simplified validator for our authentication structs
	// In a real application, you might use a library like go-playground/validator
	
	// Since we don't have reflection-based validation, we'll handle each type manually
	return nil // Placeholder - validation will be done in handlers
}