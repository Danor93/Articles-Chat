package errors

import (
	"fmt"
	"net/http"
	"time"
)

// ErrorCode represents standardized error codes
type ErrorCode string

const (
	// Client Errors (400-499)
	ErrBadRequest           ErrorCode = "BAD_REQUEST"
	ErrValidationFailed     ErrorCode = "VALIDATION_ERROR"
	ErrMissingRequiredField ErrorCode = "MISSING_REQUIRED_FIELD"
	ErrInvalidDataType      ErrorCode = "INVALID_DATA_TYPE"
	ErrInvalidConversationID ErrorCode = "INVALID_CONVERSATION_ID"
	ErrRateLimitExceeded    ErrorCode = "RATE_LIMIT_EXCEEDED"
	
	// Authentication & Authorization (401-403)
	ErrMissingAPIKey ErrorCode = "MISSING_API_KEY"
	ErrInvalidAPIKey ErrorCode = "INVALID_API_KEY"
	ErrUnauthorized  ErrorCode = "UNAUTHORIZED"
	ErrForbidden     ErrorCode = "FORBIDDEN"
	
	// Not Found (404)
	ErrResourceNotFound     ErrorCode = "RESOURCE_NOT_FOUND"
	ErrConversationNotFound ErrorCode = "CONVERSATION_NOT_FOUND"
	ErrArticleNotFound      ErrorCode = "ARTICLE_NOT_FOUND"
	
	// Server Errors (500-599)
	ErrInternalServer      ErrorCode = "INTERNAL_SERVER_ERROR"
	ErrServiceUnavailable  ErrorCode = "SERVICE_UNAVAILABLE"
	ErrVectorStoreError    ErrorCode = "VECTOR_STORE_ERROR"
	ErrEmbeddingsError     ErrorCode = "EMBEDDINGS_ERROR"
	ErrClaudeAPIError      ErrorCode = "CLAUDE_API_ERROR"
	ErrProcessingError     ErrorCode = "PROCESSING_ERROR"
	ErrDatabaseError       ErrorCode = "DATABASE_ERROR"
	ErrCacheError          ErrorCode = "CACHE_ERROR"
	ErrRAGServiceError     ErrorCode = "RAG_SERVICE_ERROR"
	
	// Configuration Errors
	ErrMissingEnvVar         ErrorCode = "MISSING_ENV_VAR"
	ErrInvalidConfiguration  ErrorCode = "INVALID_CONFIGURATION"
	ErrServiceNotInitialized ErrorCode = "SERVICE_NOT_INITIALIZED"
)

// StatusCodes maps error codes to HTTP status codes
var StatusCodes = map[ErrorCode]int{
	// Client Errors
	ErrBadRequest:           http.StatusBadRequest,
	ErrValidationFailed:     http.StatusBadRequest,
	ErrMissingRequiredField: http.StatusBadRequest,
	ErrInvalidDataType:      http.StatusBadRequest,
	ErrInvalidConversationID: http.StatusBadRequest,
	ErrRateLimitExceeded:    http.StatusTooManyRequests,
	
	// Authentication & Authorization
	ErrMissingAPIKey: http.StatusUnauthorized,
	ErrInvalidAPIKey: http.StatusUnauthorized,
	ErrUnauthorized:  http.StatusUnauthorized,
	ErrForbidden:     http.StatusForbidden,
	
	// Not Found
	ErrResourceNotFound:     http.StatusNotFound,
	ErrConversationNotFound: http.StatusNotFound,
	ErrArticleNotFound:      http.StatusNotFound,
	
	// Server Errors
	ErrInternalServer:      http.StatusInternalServerError,
	ErrServiceUnavailable:  http.StatusServiceUnavailable,
	ErrVectorStoreError:    http.StatusInternalServerError,
	ErrEmbeddingsError:     http.StatusInternalServerError,
	ErrClaudeAPIError:      http.StatusBadGateway,
	ErrProcessingError:     http.StatusInternalServerError,
	ErrDatabaseError:       http.StatusInternalServerError,
	ErrCacheError:          http.StatusInternalServerError,
	ErrRAGServiceError:     http.StatusBadGateway,
	
	// Configuration Errors
	ErrMissingEnvVar:         http.StatusInternalServerError,
	ErrInvalidConfiguration:  http.StatusInternalServerError,
	ErrServiceNotInitialized: http.StatusServiceUnavailable,
}

// AppError represents an application error
type AppError struct {
	Code      ErrorCode   `json:"error"`
	Message   string      `json:"message"`
	Details   interface{} `json:"details,omitempty"`
	RequestID string      `json:"request_id,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}

// Error implements the error interface
func (e *AppError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// StatusCode returns the HTTP status code for this error
func (e *AppError) StatusCode() int {
	if code, ok := StatusCodes[e.Code]; ok {
		return code
	}
	return http.StatusInternalServerError
}

// New creates a new AppError
func New(code ErrorCode, message string) *AppError {
	return &AppError{
		Code:      code,
		Message:   message,
		Timestamp: time.Now(),
	}
}

// NewWithDetails creates a new AppError with additional details
func NewWithDetails(code ErrorCode, message string, details interface{}) *AppError {
	return &AppError{
		Code:      code,
		Message:   message,
		Details:   details,
		Timestamp: time.Now(),
	}
}

// WithRequestID adds a request ID to the error
func (e *AppError) WithRequestID(requestID string) *AppError {
	e.RequestID = requestID
	return e
}

// Wrap wraps an existing error
func Wrap(err error, code ErrorCode) *AppError {
	if appErr, ok := err.(*AppError); ok {
		return appErr
	}
	return New(code, err.Error())
}

// IsAppError checks if an error is an AppError
func IsAppError(err error) (*AppError, bool) {
	appErr, ok := err.(*AppError)
	return appErr, ok
}