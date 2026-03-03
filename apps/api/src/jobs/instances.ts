/**
 * Shared Service Instances for BullMQ Workers
 * Creates singleton instances for Prisma, F1DataService, and ScoringService
 * to be passed to workers, ensuring consistent data access
 */

import { PrismaClient } from '@prisma/client';
import { F1DataService } from '../modules/f1data/f1data.service';
import { ScoringService } from '../modules/scoring/scoring.service';
import { DraftsService } from '../modules/drafts/drafts.service';

let prisma: PrismaClient | null;
let f1dataService: F1DataService | null;
let scoringService: ScoringService | null;
let draftsService: DraftsService | null;

/**
 * Initialize shared services
 * Should be called once at application startup
 */
export function initializeServices(): void {
  prisma = new PrismaClient();
  f1dataService = new F1DataService(prisma);
  scoringService = new ScoringService(prisma);
  draftsService = new DraftsService(prisma);
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return prisma;
}
export function getF1DataService(): F1DataService {
  if (!f1dataService) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return f1dataService;
}
export function getScoringService(): ScoringService {
  if (!scoringService) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return scoringService;
}
export function getDraftsService(): DraftsService {
  if (!draftsService) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return draftsService;
}
