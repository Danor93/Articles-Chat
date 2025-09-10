// Standardized Error Handling System - Cross-Service Error Management
//
// This error handling system provides unified error management across both
// Go backend and Node.js RAG services, ensuring consistent error responses
// and proper HTTP status code mapping throughout the Article-Chat system.
//
// CORE ERROR SYSTEM FEATURES:
// 1. Standardized Error Codes: Consistent error codes across Go and Node.js services
// 2. HTTP Status Mapping: Automatic mapping from error codes to appropriate HTTP responses
// 3. Request ID Correlation: Unique request IDs for debugging and tracing across services
// 4. Structured Error Responses: JSON format with error code, message, timestamp, request ID
// 5. Error Classification: Client (400s), Server (500s), Authentication (401s), Not Found (404s)
// 6. Service Integration: Seamless error propagation from RAG service to Go backend to frontend
//
// ERROR CODE CATEGORIES:
// - Client Errors (400-499): Input validation, bad requests, rate limiting
// - Authentication (401-403): API keys, unauthorized access, forbidden operations
// - Not Found (404): Missing resources, conversations, articles
// - Server Errors (500-599): Internal failures, service unavailable, processing errors
// - Configuration Errors: Missing environment variables, initialization failures
//
// CROSS-SERVICE CONSISTENCY:
// - Both Go and Node.js services use identical error codes for consistent frontend handling
// - Error responses follow the same JSON structure across all services
// - Request IDs propagate from Go service through RAG service for complete tracing
// - HTTP status codes are standardized for proper client-side error handling
//
// INTEGRATION WITH OTHER SYSTEMS:
// - Chat Handler: Maps RAG service errors to user-friendly messages
// - Article Handler: Provides clear feedback for article processing failures
// - Health Checks: Reports service status and dependency health
// - Frontend: Receives consistent error format for user experience optimization
package errors

import (
	"fmt"
	"net/http"
	"time"
)

// ErrorCode represents standardized error codes used across both Go and Node.js services
// These codes are synchronized between both services to ensure consistent error handling
type ErrorCode string

// ERROR CODE CONSTANTS
// These error codes are identical across both Go backend and Node.js RAG services
// to ensure consistent error handling throughout the hybrid architecture
const (
	// CLIENT ERRORS (400-499) - User input and request validation issues
	ErrBadRequest            ErrorCode = "BAD_REQUEST"             // Malformed request body or invalid JSON
	ErrValidationFailed      ErrorCode = "VALIDATION_ERROR"        // Input validation failed (length, format, etc.)
	ErrMissingRequiredField  ErrorCode = "MISSING_REQUIRED_FIELD"  // Required fields missing from request
	ErrInvalidDataType       ErrorCode = "INVALID_DATA_TYPE"       // Wrong data type for field
	ErrInvalidConversationID ErrorCode = "INVALID_CONVERSATION_ID" // Invalid conversation ID format
	ErrRateLimitExceeded     ErrorCode = "RATE_LIMIT_EXCEEDED"     // Too many requests from client

	// AUTHENTICATION & AUTHORIZATION (401-403) - Security and access control
	ErrMissingAPIKey ErrorCode = "MISSING_API_KEY" // ANTHROPIC_API_KEY not provided
	ErrInvalidAPIKey ErrorCode = "INVALID_API_KEY" // Invalid or expired API key
	ErrUnauthorized  ErrorCode = "UNAUTHORIZED"    // Authentication failed
	ErrForbidden     ErrorCode = "FORBIDDEN"       // Access denied for resource

	// NOT FOUND (404) - Resource availability issues
	ErrResourceNotFound     ErrorCode = "RESOURCE_NOT_FOUND"     // Generic resource not found
	ErrConversationNotFound ErrorCode = "CONVERSATION_NOT_FOUND" // Chat conversation not found
	ErrArticleNotFound      ErrorCode = "ARTICLE_NOT_FOUND"      // Article not in knowledge base

	// SERVER ERRORS (500-599) - Internal system failures
	ErrInternalServer     ErrorCode = "INTERNAL_SERVER_ERROR" // Generic internal error
	ErrServiceUnavailable ErrorCode = "SERVICE_UNAVAILABLE"   // Service temporarily down
	ErrVectorStoreError   ErrorCode = "VECTOR_STORE_ERROR"    // FAISS vector store operation failed
	ErrEmbeddingsError    ErrorCode = "EMBEDDINGS_ERROR"      // HuggingFace embeddings generation failed
	ErrClaudeAPIError     ErrorCode = "CLAUDE_API_ERROR"      // Anthropic Claude API failure
	ErrProcessingError    ErrorCode = "PROCESSING_ERROR"      // RAG processing pipeline failure
	ErrDatabaseError      ErrorCode = "DATABASE_ERROR"        // PostgreSQL operation failed
	ErrCacheError         ErrorCode = "CACHE_ERROR"           // Redis cache operation failed
	ErrRAGServiceError    ErrorCode = "RAG_SERVICE_ERROR"     // Node.js RAG service communication failed

	// CONFIGURATION ERRORS - Service setup and initialization issues
	ErrMissingEnvVar         ErrorCode = "MISSING_ENV_VAR"         // Required environment variable missing
	ErrInvalidConfiguration  ErrorCode = "INVALID_CONFIGURATION"   // Invalid configuration values
	ErrServiceNotInitialized ErrorCode = "SERVICE_NOT_INITIALIZED" // Service dependency not ready
)

// StatusCodes provides automatic mapping from error codes to appropriate HTTP status codes
// This ensures consistent HTTP responses across both Go backend and Node.js RAG services
var StatusCodes = map[ErrorCode]int{
	// Client Errors (400s) - Issues with user input or requests
	ErrBadRequest:            http.StatusBadRequest,      // 400 - Bad Request
	ErrValidationFailed:      http.StatusBadRequest,      // 400 - Bad Request
	ErrMissingRequiredField:  http.StatusBadRequest,      // 400 - Bad Request
	ErrInvalidDataType:       http.StatusBadRequest,      // 400 - Bad Request
	ErrInvalidConversationID: http.StatusBadRequest,      // 400 - Bad Request
	ErrRateLimitExceeded:     http.StatusTooManyRequests, // 429 - Too Many Requests

	// Authentication & Authorization (401-403) - Security issues
	ErrMissingAPIKey: http.StatusUnauthorized, // 401 - Unauthorized
	ErrInvalidAPIKey: http.StatusUnauthorized, // 401 - Unauthorized
	ErrUnauthorized:  http.StatusUnauthorized, // 401 - Unauthorized
	ErrForbidden:     http.StatusForbidden,    // 403 - Forbidden

	// Not Found (404) - Missing resources
	ErrResourceNotFound:     http.StatusNotFound, // 404 - Not Found
	ErrConversationNotFound: http.StatusNotFound, // 404 - Not Found
	ErrArticleNotFound:      http.StatusNotFound, // 404 - Not Found

	// Server Errors (500s) - Internal system issues
	ErrInternalServer:     http.StatusInternalServerError, // 500 - Internal Server Error
	ErrServiceUnavailable: http.StatusServiceUnavailable,  // 503 - Service Unavailable
	ErrVectorStoreError:   http.StatusInternalServerError, // 500 - Internal Server Error
	ErrEmbeddingsError:    http.StatusInternalServerError, // 500 - Internal Server Error
	ErrClaudeAPIError:     http.StatusBadGateway,          // 502 - Bad Gateway (external service failure)
	ErrProcessingError:    http.StatusInternalServerError, // 500 - Internal Server Error
	ErrDatabaseError:      http.StatusInternalServerError, // 500 - Internal Server Error
	ErrCacheError:         http.StatusInternalServerError, // 500 - Internal Server Error
	ErrRAGServiceError:    http.StatusBadGateway,          // 502 - Bad Gateway (RAG service failure)

	// Configuration Errors - Service setup issues
	ErrMissingEnvVar:         http.StatusInternalServerError, // 500 - Internal Server Error
	ErrInvalidConfiguration:  http.StatusInternalServerError, // 500 - Internal Server Error
	ErrServiceNotInitialized: http.StatusServiceUnavailable,  // 503 - Service Unavailable
}

// AppError represents a structured application error with rich metadata
// Provides consistent error format across all services for debugging and user feedback
type AppError struct {
	Code      ErrorCode   `json:"error"`                // Standardized error code for programmatic handling
	Message   string      `json:"message"`              // Human-readable error message for users
	Details   interface{} `json:"details,omitempty"`    // Additional error context (validation failures, etc.)
	RequestID string      `json:"request_id,omitempty"` // Unique request ID for tracing across services
	Timestamp time.Time   `json:"timestamp"`            // When the error occurred
}

// Error implements the standard Go error interface
// Provides a string representation of the error for logging and debugging
func (e *AppError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// StatusCode returns the appropriate HTTP status code for this error
// Uses the StatusCodes mapping to ensure consistent HTTP responses
func (e *AppError) StatusCode() int {
	if code, ok := StatusCodes[e.Code]; ok {
		return code
	}
	return http.StatusInternalServerError // Default fallback for unmapped errors
}

// New creates a new AppError with basic error code and message
// Used for simple error cases without additional context
func New(code ErrorCode, message string) *AppError {
	return &AppError{
		Code:      code,
		Message:   message,
		Timestamp: time.Now(),
	}
}

// NewWithDetails creates a new AppError with additional context information
// Used for validation errors or cases requiring detailed error information
func NewWithDetails(code ErrorCode, message string, details interface{}) *AppError {
	return &AppError{
		Code:      code,
		Message:   message,
		Details:   details,
		Timestamp: time.Now(),
	}
}

// WithRequestID adds a request ID to the error for cross-service tracing
// Enables correlation of errors across Go backend and Node.js RAG services
func (e *AppError) WithRequestID(requestID string) *AppError {
	e.RequestID = requestID
	return e
}

// Wrap converts a standard Go error into an AppError with specified error code
// Preserves existing AppErrors while standardizing other error types
func Wrap(err error, code ErrorCode) *AppError {
	if appErr, ok := err.(*AppError); ok {
		return appErr // Already an AppError, return as-is
	}
	return New(code, err.Error()) // Convert standard error to AppError
}

// IsAppError checks if an error is an AppError and returns it for type assertion
// Used by handlers to determine if an error should be handled as a structured application error
func IsAppError(err error) (*AppError, bool) {
	appErr, ok := err.(*AppError)
	return appErr, ok
}
