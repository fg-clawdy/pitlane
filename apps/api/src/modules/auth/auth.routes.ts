import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  registerHandler,
  verifyEmailHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  resendVerificationHandler,
} from './auth.controller';

/**
 * Register authentication routes with rate limiting
 * @param fastify - Fastify instance
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/register
  // Rate limit: 5/min/IP
  fastify.post('/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => {
          return request.ip;
        },
      },
    },
  }, registerHandler);

  // POST /api/v1/auth/login
  // Rate limit: 10/min/IP, 5/15min/email
  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => {
          return request.ip;
        },
      },
    },
  }, loginHandler);

  // POST /api/v1/auth/refresh
  fastify.post('/refresh', refreshHandler);

  // POST /api/v1/auth/logout
  fastify.post('/logout', logoutHandler);

  // GET /api/v1/auth/verify-email
  // Rate limit: 10/hr/token
  fastify.get('/verify-email', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour',
        keyGenerator: (request: FastifyRequest) => {
          const token = (request.query as { token?: string }).token || request.ip;
          return `verify:${token}`;
        },
      },
    },
  }, verifyEmailHandler);

  // POST /api/v1/auth/forgot-password
  // Rate limit: 3/hr/email
  fastify.post('/forgot-password', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour',
        keyGenerator: (request: FastifyRequest) => {
          const body = request.body as { email?: string };
          return `forgot:${body.email || request.ip}`;
        },
      },
    },
  }, forgotPasswordHandler);

  // POST /api/v1/auth/reset-password
  // Rate limit: 5/hr/IP
  fastify.post('/reset-password', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 hour',
        keyGenerator: (request: FastifyRequest) => {
          return request.ip;
        },
      },
    },
  }, resetPasswordHandler);

  // POST /api/v1/auth/resend-verification
  // Rate limit: 3/hr/email
  fastify.post('/resend-verification', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour',
        keyGenerator: (request: FastifyRequest) => {
          const body = request.body as { email?: string };
          return `resend:${body.email || request.ip}`;
        },
      },
    },
  }, resendVerificationHandler);
}