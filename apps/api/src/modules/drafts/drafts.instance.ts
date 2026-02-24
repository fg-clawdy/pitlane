/**
 * Shared DraftsService Instance
 * This ensures the same service instance is used across HTTP routes and WebSocket handlers
 * for proper broadcast functionality
 */

import { PrismaClient } from '@prisma/client';
import { DraftsService } from './drafts.service';

const prisma = new PrismaClient();

// Singleton instance for WebSocket client management
export const sharedDraftsService = new DraftsService(prisma);

export default sharedDraftsService;