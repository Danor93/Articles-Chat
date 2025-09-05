import { Request, Response, NextFunction } from 'express';
import { AppError, handleError, isAppError } from '../utils/errors';

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.id || req.headers['x-request-id'] as string;
  
  // Log the error
  console.error('Error occurred:', {
    requestId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Handle the error
  const errorDetails = handleError(error, requestId);

  // Send response
  res.status(errorDetails.statusCode).json(errorDetails);
}

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.id || req.headers['x-request-id'] as string;
  
  res.status(404).json({
    error: 'RESOURCE_NOT_FOUND',
    message: `Endpoint ${req.method} ${req.url} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
    requestId,
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}