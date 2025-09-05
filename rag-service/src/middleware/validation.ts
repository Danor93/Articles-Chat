import { Request, Response, NextFunction } from 'express';
import { createError, ErrorCode } from '../utils/errors';

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export function validateRequest(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Array<{ field: string; message: string }> = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      // Check required fields
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: rule.field,
          message: `${rule.field} is required`,
        });
        continue;
      }

      // Skip validation for optional empty fields
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      if (rule.type && typeof value !== rule.type) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be of type ${rule.type}`,
        });
        continue;
      }

      // String validations
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push({
            field: rule.field,
            message: `${rule.field} must be at least ${rule.minLength} characters long`,
          });
        }

        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push({
            field: rule.field,
            message: `${rule.field} must not exceed ${rule.maxLength} characters`,
          });
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push({
            field: rule.field,
            message: `${rule.field} has invalid format`,
          });
        }
      }

      // Custom validation
      if (rule.custom) {
        const result = rule.custom(value);
        if (result !== true) {
          errors.push({
            field: rule.field,
            message: typeof result === 'string' ? result : `${rule.field} validation failed`,
          });
        }
      }
    }

    if (errors.length > 0) {
      throw createError(
        ErrorCode.VALIDATION_ERROR,
        'Validation failed',
        { errors }
      );
    }

    next();
  };
}

// Common validation rules
export const chatValidationRules: ValidationRule[] = [
  {
    field: 'query',
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 4000,
  },
  {
    field: 'conversationId',
    required: false,
    type: 'string',
    pattern: /^[a-zA-Z0-9-_]+$/,
  },
];

export const articleValidationRules: ValidationRule[] = [
  {
    field: 'url',
    required: true,
    type: 'string',
    pattern: /^https?:\/\/.+/,
    custom: (value: string) => {
      try {
        new URL(value);
        return true;
      } catch {
        return 'Invalid URL format';
      }
    },
  },
  {
    field: 'metadata',
    required: false,
    type: 'object',
  },
];

export const batchArticleValidationRules: ValidationRule[] = [
  {
    field: 'urls',
    required: true,
    custom: (value: any) => {
      if (!Array.isArray(value)) {
        return 'urls must be an array';
      }
      if (value.length === 0) {
        return 'urls array cannot be empty';
      }
      if (value.length > 100) {
        return 'Cannot process more than 100 URLs at once';
      }
      for (const url of value) {
        if (typeof url !== 'string') {
          return 'All URLs must be strings';
        }
        try {
          new URL(url);
        } catch {
          return `Invalid URL: ${url}`;
        }
      }
      return true;
    },
  },
];