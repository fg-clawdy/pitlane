import { FastifyInstance } from 'fastify';
import { loginHandler, refreshHandler, logoutHandler } from './auth.controller';

/**
 * Register authentication routes
 * @param fastify - Fastify instance
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/login', loginHandler);
  fastify.post('/refresh', refreshHandler);
  fastify.post('/logout', logoutHandler);
}