import Fastify from 'fastify';
import { authRoutes } from './modules/auth/auth.routes';

const fastify = Fastify({
  logger: true,
});

// Register CORS
fastify.register(require('@fastify/cors'), {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
});

// Register cookie support
fastify.register(require('@fastify/cookie'), {
  secret: process.env.COOKIE_SECRET || 'pitlane-cookie-secret',
});

// Register auth routes under /api/v1/auth
fastify.register(async function (fastify) {
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
});

// Health check endpoint
fastify.get('/health', async (_request, _reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
