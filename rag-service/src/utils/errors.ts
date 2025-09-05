export enum ErrorCode {
  // Client Errors (400-499)
  BAD_REQUEST = 'BAD_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_DATA_TYPE = 'INVALID_DATA_TYPE',
  INVALID_CONVERSATION_ID = 'INVALID_CONVERSATION_ID',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Authentication & Authorization (401-403)
  MISSING_API_KEY = 'MISSING_API_KEY',
  INVALID_API_KEY = 'INVALID_API_KEY',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Not Found (404)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  ARTICLE_NOT_FOUND = 'ARTICLE_NOT_FOUND',
  
  // Server Errors (500-599)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  VECTOR_STORE_ERROR = 'VECTOR_STORE_ERROR',
  EMBEDDINGS_ERROR = 'EMBEDDINGS_ERROR',
  CLAUDE_API_ERROR = 'CLAUDE_API_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  
  // Configuration Errors
  MISSING_ENV_VAR = 'MISSING_ENV_VAR',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  SERVICE_NOT_INITIALIZED = 'SERVICE_NOT_INITIALIZED',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: any;
  timestamp?: string;
  requestId?: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(errorDetails: ErrorDetails) {
    super(errorDetails.message);
    this.code = errorDetails.code;
    this.statusCode = errorDetails.statusCode;
    this.details = errorDetails.details;
    this.timestamp = errorDetails.timestamp || new Date().toISOString();
    this.requestId = errorDetails.requestId;
    this.name = 'AppError';
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

export const ErrorMessages = {
  // Client Errors
  [ErrorCode.BAD_REQUEST]: 'Bad request',
  [ErrorCode.VALIDATION_ERROR]: 'Validation error',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Missing required field',
  [ErrorCode.INVALID_DATA_TYPE]: 'Invalid data type',
  [ErrorCode.INVALID_CONVERSATION_ID]: 'Invalid conversation ID',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  
  // Authentication & Authorization
  [ErrorCode.MISSING_API_KEY]: 'API key is missing',
  [ErrorCode.INVALID_API_KEY]: 'Invalid API key',
  [ErrorCode.UNAUTHORIZED]: 'Unauthorized',
  [ErrorCode.FORBIDDEN]: 'Forbidden',
  
  // Not Found
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Resource not found',
  [ErrorCode.CONVERSATION_NOT_FOUND]: 'Conversation not found',
  [ErrorCode.ARTICLE_NOT_FOUND]: 'Article not found',
  
  // Server Errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Internal server error',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service unavailable',
  [ErrorCode.VECTOR_STORE_ERROR]: 'Vector store error',
  [ErrorCode.EMBEDDINGS_ERROR]: 'Embeddings service error',
  [ErrorCode.CLAUDE_API_ERROR]: 'Claude API error',
  [ErrorCode.PROCESSING_ERROR]: 'Processing error',
  [ErrorCode.DATABASE_ERROR]: 'Database error',
  [ErrorCode.CACHE_ERROR]: 'Cache error',
  
  // Configuration Errors
  [ErrorCode.MISSING_ENV_VAR]: 'Missing environment variable',
  [ErrorCode.INVALID_CONFIGURATION]: 'Invalid configuration',
  [ErrorCode.SERVICE_NOT_INITIALIZED]: 'Service not initialized',
};

export const StatusCodes = {
  // Client Errors
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_DATA_TYPE]: 400,
  [ErrorCode.INVALID_CONVERSATION_ID]: 400,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  
  // Authentication & Authorization
  [ErrorCode.MISSING_API_KEY]: 401,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  
  // Not Found
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.CONVERSATION_NOT_FOUND]: 404,
  [ErrorCode.ARTICLE_NOT_FOUND]: 404,
  
  // Server Errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.VECTOR_STORE_ERROR]: 500,
  [ErrorCode.EMBEDDINGS_ERROR]: 500,
  [ErrorCode.CLAUDE_API_ERROR]: 502,
  [ErrorCode.PROCESSING_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CACHE_ERROR]: 500,
  
  // Configuration Errors
  [ErrorCode.MISSING_ENV_VAR]: 500,
  [ErrorCode.INVALID_CONFIGURATION]: 500,
  [ErrorCode.SERVICE_NOT_INITIALIZED]: 503,
};

export function createError(
  code: ErrorCode,
  message?: string,
  details?: any,
  requestId?: string
): AppError {
  return new AppError({
    code,
    message: message || ErrorMessages[code],
    statusCode: StatusCodes[code],
    details,
    requestId,
  });
}

export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

export function handleError(error: any, requestId?: string): ErrorDetails {
  if (isAppError(error)) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('ANTHROPIC_API_KEY')) {
      return createError(
        ErrorCode.MISSING_API_KEY,
        'Anthropic API key is not configured',
        null,
        requestId
      ).toJSON();
    }

    if (error.message.includes('rate limit')) {
      return createError(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        error.message,
        null,
        requestId
      ).toJSON();
    }

    if (error.message.includes('vector store')) {
      return createError(
        ErrorCode.VECTOR_STORE_ERROR,
        error.message,
        null,
        requestId
      ).toJSON();
    }

    if (error.message.includes('embedding')) {
      return createError(
        ErrorCode.EMBEDDINGS_ERROR,
        error.message,
        null,
        requestId
      ).toJSON();
    }

    if (error.message.includes('Claude') || error.message.includes('Anthropic')) {
      return createError(
        ErrorCode.CLAUDE_API_ERROR,
        error.message,
        null,
        requestId
      ).toJSON();
    }
  }

  // Default error
  return createError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    'An unexpected error occurred',
    error?.toString(),
    requestId
  ).toJSON();
}