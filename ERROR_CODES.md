# Article Chat System - Error Codes Documentation

This document provides a comprehensive list of all error codes used across the Article Chat System, including both the RAG service (Node.js) and the Go backend service.

## Table of Contents
- [Client Errors (4xx)](#client-errors-4xx)
- [Server Errors (5xx)](#server-errors-5xx)
- [Service-Specific Errors](#service-specific-errors)
- [Error Response Format](#error-response-format)

## Client Errors (4xx)

### 400 - Bad Request

| Error Code | Description | HTTP Status | Example |
|------------|-------------|-------------|---------|
| `BAD_REQUEST` | General bad request error | 400 | Invalid request format |
| `VALIDATION_ERROR` | Request validation failed | 400 | Invalid field values |
| `MISSING_REQUIRED_FIELD` | Required field is missing | 400 | Missing 'message' field |
| `INVALID_DATA_TYPE` | Invalid data type provided | 400 | String expected but number received |
| `INVALID_CONVERSATION_ID` | Conversation ID format is invalid | 400 | Contains invalid characters |

### 401 - Unauthorized

| Error Code | Description | HTTP Status | Example |
|------------|-------------|-------------|---------|
| `MISSING_API_KEY` | API key is not provided | 401 | Missing ANTHROPIC_API_KEY |
| `INVALID_API_KEY` | API key is invalid | 401 | Wrong or expired API key |
| `UNAUTHORIZED` | General unauthorized access | 401 | Authentication required |

### 403 - Forbidden

| Error Code | Description | HTTP Status | Example |
|------------|-------------|-------------|---------|
| `FORBIDDEN` | Access forbidden | 403 | Insufficient permissions |

### 404 - Not Found

| Error Code | Description | HTTP Status | Example |
|------------|-------------|-------------|---------|
| `RESOURCE_NOT_FOUND` | Requested resource not found | 404 | Unknown endpoint |
| `CONVERSATION_NOT_FOUND` | Conversation ID not found | 404 | No history for conversation |
| `ARTICLE_NOT_FOUND` | Article not found | 404 | URL returns 404 |

### 429 - Too Many Requests

| Error Code | Description | HTTP Status | Example |
|------------|-------------|-------------|---------|
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | 429 | Too many requests |

## Server Errors (5xx)

### 500 - Internal Server Error

| Error Code | Description | HTTP Status | Example |
|------------|-------------|-------------|---------|
| `INTERNAL_SERVER_ERROR` | General server error | 500 | Unexpected error occurred |
| `PROCESSING_ERROR` | Error during processing | 500 | Failed to process request |
| `VECTOR_STORE_ERROR` | Vector store operation failed | 500 | FAISS operation error |
| `EMBEDDINGS_ERROR` | Embeddings service error | 500 | Failed to generate embeddings |
| `DATABASE_ERROR` | Database operation failed | 500 | Query execution error |
| `CACHE_ERROR` | Cache operation failed | 500 | Redis connection error |
| `MISSING_ENV_VAR` | Missing environment variable | 500 | Required config not set |
| `INVALID_CONFIGURATION` | Invalid configuration | 500 | Malformed config values |

### 502 - Bad Gateway

| Error Code | Description | HTTP Status | Example |
|------------|-------------|-------------|---------|
| `CLAUDE_API_ERROR` | Claude API error | 502 | Anthropic API failure |
| `RAG_SERVICE_ERROR` | RAG service error | 502 | RAG service unavailable |

### 503 - Service Unavailable

| Error Code | Description | HTTP Status | Example |
|------------|-------------|-------------|---------|
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable | 503 | Service is down |
| `SERVICE_NOT_INITIALIZED` | Service not initialized | 503 | Service not ready |

## Service-Specific Errors

### RAG Service (Node.js)

The RAG service handles:
- Chat query processing
- Article content extraction and processing
- Vector store operations
- Embeddings generation
- Claude API interactions

Common scenarios:
```javascript
// Missing API key
{
  "error": "MISSING_API_KEY",
  "message": "Anthropic API key is not configured",
  "statusCode": 401,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "123e4567-e89b-12d3-a456-426614174000"
}

// Invalid chat request
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "statusCode": 400,
  "details": {
    "errors": [
      {
        "field": "query",
        "message": "query must be at least 1 characters long"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Go Backend Service

The Go backend handles:
- Request routing and middleware
- Communication with RAG service
- Caching with Redis
- Article URL validation
- Response aggregation

Common scenarios:
```go
// RAG service unavailable
{
  "error": "RAG_SERVICE_ERROR",
  "message": "RAG service is temporarily unavailable",
  "code": 502,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "request_id": "123e4567-e89b-12d3-a456-426614174000"
}

// Invalid article URL
{
  "error": "VALIDATION_ERROR",
  "message": "URL must use http or https protocol",
  "code": 400,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "request_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

## Error Response Format

### Standard Error Response

All errors follow this consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error description",
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "details": {
    // Optional additional error details
  }
}
```

### Streaming Error Response

For streaming endpoints, errors are sent as Server-Sent Events:

```
data: {
  "error": "ERROR_CODE",
  "message": "Error description",
  "done": true
}
```

## Error Handling Best Practices

### For Frontend Developers

1. **Always check for error responses** before processing data
2. **Use the error code** for programmatic handling
3. **Display the message** to users for clarity
4. **Include requestId** when reporting issues

Example error handling:
```javascript
try {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: userMessage })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    // Handle error based on code
    switch (data.error) {
      case 'RATE_LIMIT_EXCEEDED':
        showError('Please slow down! Too many requests.');
        break;
      case 'VALIDATION_ERROR':
        showValidationErrors(data.details?.errors);
        break;
      default:
        showError(data.message || 'An error occurred');
    }
    return;
  }
  
  // Process successful response
  handleChatResponse(data);
  
} catch (error) {
  showError('Network error. Please check your connection.');
}
```

### For Backend Developers

1. **Use appropriate error codes** from the predefined list
2. **Include relevant details** in the error response
3. **Log errors with context** for debugging
4. **Don't expose sensitive information** in error messages

## Environment Variables

### Required Environment Variables

#### RAG Service (Node.js)
```env
# Required
ANTHROPIC_API_KEY=your-api-key-here

# Optional with defaults
PORT=3001
CLAUDE_MODEL=claude-3-7-sonnet-latest
MAX_TOKENS=4000
TEMPERATURE=0.7
```

#### Go Backend Service
```env
# Required
RAG_SERVICE_URL=http://localhost:3001

# Optional with defaults
PORT=8080
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=24h
```

### Error Prevention

To prevent configuration errors:
1. Check all required environment variables at startup
2. Validate configuration values
3. Provide clear error messages for missing config
4. Use sensible defaults where appropriate

## Monitoring and Debugging

### Request ID Tracking

Every request is assigned a unique ID for tracking:
- Frontend sends: `X-Request-ID` header
- Backend generates if missing
- All logs include request ID
- Error responses include request ID

### Logging

Both services use structured logging:
```
2024-01-15T10:30:00.123Z ERROR Chat request failed {
  "error": "CLAUDE_API_ERROR",
  "request_id": "123e4567-e89b-12d3-a456-426614174000",
  "user_message": "What is...",
  "processing_time_ms": 1234
}
```

### Health Checks

Monitor service health:
- `/health` - Basic health check
- `/health/detailed` - Detailed service status

## Common Issues and Solutions

### Issue: MISSING_API_KEY
**Solution**: Ensure ANTHROPIC_API_KEY is set in environment

### Issue: SERVICE_NOT_INITIALIZED
**Solution**: Wait for service startup completion

### Issue: RATE_LIMIT_EXCEEDED
**Solution**: Implement exponential backoff on client

### Issue: VECTOR_STORE_ERROR
**Solution**: Check disk space and FAISS index integrity

### Issue: CACHE_ERROR
**Solution**: Verify Redis connection and credentials