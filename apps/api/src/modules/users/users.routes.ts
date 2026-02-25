import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  getMeHandler,
  updateMeHandler,
  changePasswordHandler,
  addPushSubscriptionHandler,
  removePushSubscriptionHandler,
  requestEmailChangeHandler,
  getEmailChangeStatusHandler,
  cancelEmailChangeHandler,
  waiveHoldEmailChangeHandler,
  verifyEmailChangeHandler
} from './users.controller';
import { authenticate } from '../../lib/auth';

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/users/me - Get current user profile
  fastify.get('/me', {
    preHandler: authenticate,
  }, getMeHandler);

  // PATCH /api/v1/users/me - Update user profile (20/min)
  fastify.patch('/me', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.id || request.ip,
      }
    }
  }, updateMeHandler);

  // POST /api/v1/users/me/password - Change password
  fastify.post('/me/password', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.id || request.ip,
      }
    }
  }, changePasswordHandler);

  // POST /api/v1/users/me/push-subscription - Add push subscription (10/min)
  fastify.post('/me/push-subscription', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.id || request.ip,
      }
    }
  }, addPushSubscriptionHandler);

  // DELETE /api/v1/users/me/push-subscription - Remove push subscription (10/min)
  fastify.delete('/me/push-subscription', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.id || request.ip,
      }
    }
  }, removePushSubscriptionHandler);

  // GET /api/v1/users/me/email-change - Get email change status
  fastify.get('/me/email-change', {
    preHandler: authenticate,
  }, getEmailChangeStatusHandler);

  // POST /api/v1/users/me/email-change - Request email change (3/day)
  fastify.post('/me/email-change', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '24 hours',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.id || request.ip,
      }
    }
  }, requestEmailChangeHandler);

  // POST /api/v1/users/me/email-change/cancel - Cancel email change (5/hr)
  fastify.post('/me/email-change/cancel', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 hour',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.id || request.ip,
      }
    }
  }, cancelEmailChangeHandler);

  // POST /api/v1/users/me/email-change/waive-hold - Waive hold period (5/hr)
  fastify.post('/me/email-change/waive-hold', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 hour',
        keyGenerator: (request: FastifyRequest) => (request as any).user?.id || request.ip,
      }
    }
  }, waiveHoldEmailChangeHandler);

  // GET /api/v1/users/me/email-change/verify - Verify email change (public endpoint with token)
  fastify.get('/me/email-change/verify', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour',
        keyGenerator: (request: FastifyRequest) => {
          const token = (request.query as { token?: string })?.token || request.ip;
          return token;
        },
      }
    }
  }, verifyEmailChangeHandler);
}