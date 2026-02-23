import { FastifyInstance } from 'fastify';
import { getMeHandler, updateMeHandler, changePasswordHandler, addPushSubscriptionHandler, removePushSubscriptionHandler } from './users.controller';
import { authenticate } from '../../lib/auth';

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/users/me
  fastify.get('/me', { preHandler: authenticate }, getMeHandler);

  // PATCH /api/v1/users/me
  fastify.patch('/me', { preHandler: authenticate }, updateMeHandler);

  // POST /api/v1/users/me/password
  fastify.post('/me/password', { preHandler: authenticate }, changePasswordHandler);

  // POST /api/v1/users/me/push-subscription
  fastify.post('/me/push-subscription', { preHandler: authenticate }, addPushSubscriptionHandler);

  // DELETE /api/v1/users/me/push-subscription
  fastify.delete('/me/push-subscription', { preHandler: authenticate }, removePushSubscriptionHandler);
}