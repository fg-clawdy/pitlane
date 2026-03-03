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
  getTeamsBySeason,
  getAllTeams,
  syncCurrentSeason,
  getRaceResults,
  syncRaceResults,
  overrideRaceResult,
  createDriverSubstitution,
  getAdminOverrideData,
  listRaceOverrides,
  resolveDiscrepancy
} from './f1data.controller';

export async function f1dataRoutes(fastify: FastifyInstance) {
  // Get all seasons
  fastify.get('/seasons', getSeasons);

  // Get races for a season
  fastify.get('/seasons/:year/races', getRacesBySeason);

  // Get a specific race
  fastify.get('/seasons/:year/races/:round', getRace);

  // Get race results
  fastify.get('/seasons/:year/races/:round/results', getRaceResults);

  // Get drivers for a season
  fastify.get('/seasons/:year/drivers', getDriversBySeason);

  // Get teams (constructors) for a season
  fastify.get('/seasons/:year/teams', getTeamsBySeason);

  // Get all teams
  fastify.get('/teams', getAllTeams);

  // Admin sync endpoint
  fastify.post('/admin/sync', syncCurrentSeason);

  // Admin sync race results endpoint
  fastify.post('/admin/sync-results/:year/:round', syncRaceResults);

  // ========== Admin Data Override Routes ==========

  // Override race result field
  fastify.patch('/admin/race-results/:resultId/override', overrideRaceResult);

  // Get admin override data for a race result
  fastify.get('/admin/race-results/:resultId', getAdminOverrideData);

  // Create driver substitution
  fastify.post('/admin/races/:raceId/substitutions', createDriverSubstitution);

  // List all overrides for a race
  fastify.get('/admin/races/:raceId/overrides', listRaceOverrides);

  // Resolve data discrepancy
  fastify.patch('/admin/discrepancies/:discrepancyId/resolve', resolveDiscrepancy);
}
