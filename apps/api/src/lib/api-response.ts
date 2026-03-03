/**
 * API Response Utilities
 * Standardized response formatting and error handling for all API controllers
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Standard API error codes
 */
export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Authorization errors
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Not found errors
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  LEAGUE_NOT_FOUND = 'LEAGUE_NOT_FOUND',
  RACE_NOT_FOUND = 'RACE_NOT_FOUND',
  DRAFT_NOT_FOUND = 'DRAFT_NOT_FOUND',
  DRIVER_NOT_FOUND = 'DRIVER_NOT_FOUND',
  
  // Conflict errors
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  
  // Business logic errors
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  LEAGUE_FULL = 'LEAGUE_FULL',
  ALREADY_MEMBER = 'ALREADY_MEMBER',
  DRAFT_WINDOW_CLOSED = 'DRAFT_WINDOW_CLOSED',
  DRIVER_ALREADY_PICKED = 'DRIVER_ALREADY_PICKED',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  DATA_INTEGRITY_ERROR = 'DATA_INTEGRITY_ERROR',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  
  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode | string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Common factory methods
   */
  static unauthorized(message: string = 'Not authenticated'): ApiError {
    return new ApiError(401, ErrorCode.UNAUTHORIZED, message);
  }

  static forbidden(message: string = 'Access denied'): ApiError {
    return new ApiError(403, ErrorCode.FORBIDDEN, message);
  }

  static insufficientPermissions(message: string = 'Insufficient permissions'): ApiError {
    return new ApiError(403, ErrorCode.INSUFFICIENT_PERMISSIONS, message);
  }

  static notFound(resource: string = 'Resource'): ApiError {
    return new ApiError(404, ErrorCode.NOT_FOUND, `${resource} not found`);
  }

  static badRequest(message: string, details?: any): ApiError {
    return new ApiError(400, ErrorCode.INVALID_INPUT, message, details);
  }

  static validationError(details: any): ApiError {
    return new ApiError(400, ErrorCode.VALIDATION_ERROR, 'Validation failed', details);
  }

  static conflict(message: string, details?: any): ApiError {
    return new ApiError(409, ErrorCode.ALREADY_EXISTS, message, details);
  }

  static draftWindowClosed(message: string = 'Draft window is closed'): ApiError {
    return new ApiError(409, ErrorCode.DRAFT_WINDOW_CLOSED, message);
  }

  static driverAlreadyPicked(message: string = 'Driver already picked', details?: any): ApiError {
    return new ApiError(409, ErrorCode.DRIVER_ALREADY_PICKED, message, details);
  }

  static notYourTurn(message: string = 'It is not your turn'): ApiError {
    return new ApiError(409, ErrorCode.NOT_YOUR_TURN, message);
  }

  static leagueFull(message: string = 'League is full'): ApiError {
    return new ApiError(409, ErrorCode.LEAGUE_FULL, message);
  }

  static alreadyMember(message: string = 'You are already a member of this league'): ApiError {
    return new ApiError(409, ErrorCode.ALREADY_MEMBER, message);
  }

  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(500, ErrorCode.INTERNAL_ERROR, message);
  }

  static serviceUnavailable(message: string = 'Service unavailable'): ApiError {
    return new ApiError(503, ErrorCode.SERVICE_UNAVAILABLE, message);
  }
}

/**
 * Standard success response structure
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * API Response type
 */
export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * Authenticated user interface
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'user' | 'commissioner' | 'super_admin';
}

/**
 * Send a standardized success response
 */
export function sendSuccess<T>(reply: FastifyReply, data: T, statusCode: number = 200): void {
  reply.code(statusCode).send({
    success: true,
    data,
  } as SuccessResponse<T>);
}

/**
 * Send a standardized error response
 */
export function sendError(
  reply: FastifyReply,
  error: ApiError | Error | unknown
): void {
  if (error instanceof ApiError) {
    reply.code(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    } as ErrorResponse);
  } else if (error instanceof Error) {
    reply.code(500).send({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error.message,
      },
    } as ErrorResponse);
  } else {
    reply.code(500).send({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    } as ErrorResponse);
  }
}

/**
 * Wrapper function for async handlers with standardized error handling
 */
export function handleAsync<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  handler: () => Promise<T>
): Promise<void> {
  return handler()
    .then((result) => {
      sendSuccess(reply, result);
    })
    .catch((error) => {
      request.log.error(error);
      sendError(reply, error);
    });
}

/**
 * Get authenticated user from request or throw
 */
export function getAuthenticatedUser(request: FastifyRequest): AuthenticatedUser {
  const user = (request as any).user;
  if (!user) {
    throw ApiError.unauthorized();
  }
  return user;
}

/**
 * Optional authenticated user (may be undefined)
 */
export function getOptionalUser(request: FastifyRequest): AuthenticatedUser | undefined {
  return (request as any).user;
}

/**
 * Require authenticated user with specific role(s)
 */
export function requireRole(request: FastifyRequest, requiredRoles: string | string[]): AuthenticatedUser {
  const user = getAuthenticatedUser(request);
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  if (!roles.includes(user.role)) {
    throw ApiError.insufficientPermissions(`Required role: ${roles.join(' or ')}`);
  }
  
  return user;
}

/**
 * Require super_admin role
 */
export function requireAdmin(request: FastifyRequest): AuthenticatedUser {
  return requireRole(request, 'super_admin');
}

/**
 * Check if user is super_admin or commissioner
 */
export function requireAdminOrCommissioner(request: FastifyRequest): AuthenticatedUser {
  const user = getAuthenticatedUser(request);
  
  if (!['super_admin', 'commissioner'].includes(user.role)) {
    throw ApiError.insufficientPermissions('Requires admin or commissioner role');
  }
  
  return user;
}