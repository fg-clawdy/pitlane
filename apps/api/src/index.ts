import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './modules/auth/auth.routes';
import { userRoutes } from './modules/users/users.routes';
import { f1dataRoutes } from './modules/f1data/f1data.routes';
import { leaguesRoutes } from './modules/leagues/leagues.routes';
import { scoringRoutes } from './modules/scoring/scoring.routes';
import { draftsRoutes, draftWebSocketRoutes } from './modules/drafts/drafts.routes';
import { notificationsRoutes } from './modules/notifications/notifications.routes';
import { F1DataService } from './modules/f1data/f1data.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const f1dataService = new F1DataService(prisma);

const fastify = Fastify({
  logger: true,
});

// Register WebSocket support
fastify.register(websocket);

// Register rate limiting
fastify.register(rateLimit, {
  max: 100,
  timeWindow: '15 minutes',
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

// Register routes under /api/v1
fastify.register(async function(fastify) {
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(userRoutes, { prefix: '/api/v1/users' });
  await fastify.register(f1dataRoutes);
  await fastify.register(leaguesRoutes, { prefix: '/api/v1' });
  await fastify.register(scoringRoutes, { prefix: '/api/v1' });
  await fastify.register(draftsRoutes, { prefix: '/api/v1' });
  await fastify.register(notificationsRoutes, { prefix: '/api/v1' });
  
  // WebSocket routes for live draft board
  await fastify.register(draftWebSocketRoutes);
});

// Health check endpoint
fastify.get('/health', async (_request, _reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
async function start() {
  try {
    // Sync current season data on startup
    console.log('Syncing current F1 season data...');
    const syncResult = await f1dataService.syncCurrentSeason();
    console.log(`Sync complete: ${syncResult.racesSynced} races, ${syncResult.driversSynced} drivers`);
    if (syncResult.errors.length > 0) {
      console.warn('Sync warnings:', syncResult.errors);
    }

    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';
    await fastify.listen({ port, host });
    console.log(`Server listening on ${host}:${port}`);
  } catch(err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();