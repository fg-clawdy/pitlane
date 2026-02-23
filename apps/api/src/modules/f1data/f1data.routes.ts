/**
 * F1 Data Routes
 * Routes for F1 season, race, and driver data
 */

import { FastifyInstance } from 'fastify';
import {
  getSeasons,
  getRacesBySeason,
  getRace,
  getDriversBySeason,
  syncCurrentSeason
} from './f1data.controller';

export async function f1dataRoutes(fastify: FastifyInstance) {
  // Get all seasons
  fastify.get('/seasons', getSeasons);

  // Get races for a season
  fastify.get('/seasons/:year/races', getRacesBySeason);

  // Get a specific race
  fastify.get('/seasons/:year/races/:round', getRace);

  // Get drivers for a season
  fastify.get('/seasons/:year/drivers', getDriversBySeason);

  // Admin sync endpoint
  fastify.post('/admin/sync', syncCurrentSeason);
}