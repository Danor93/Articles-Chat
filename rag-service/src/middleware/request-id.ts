import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get request ID from header or generate a new one
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  
  // Attach to request object
  req.id = requestId;
  
  // Add to response headers
  res.setHeader('X-Request-ID', requestId);
  
  next();
}