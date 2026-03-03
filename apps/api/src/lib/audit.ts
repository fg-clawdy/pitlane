/**
 * Audit Logging Utility
 * Centralized audit log creation for mutations
 */

import { PrismaClient } from '@prisma/client';
import { FastifyRequest } from 'fastify';

const prisma = new PrismaClient();

export interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an action for audit trail
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: entry.changes,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (error) {
    // Log error but don't throw - audit logging should not break operations
    console.error('[AuditLog] Error creating audit log:', error);
  }
}

/**
 * Helper to extract request metadata for audit logs
 */
export function getRequestMetadata(request: FastifyRequest) {
  return {
    ipAddress: request.ip,
    userAgent: (request.headers['user-agent'] as string) || 'Unknown',
  };
}

/**
 * Create audit log from request context
 */
export async function auditAction(
  request: FastifyRequest,
  action: string,
  entityType: string,
  entityId: string,
  changes?: any
): Promise<void> {
  const user = (request as any).user;
  const metadata = getRequestMetadata(request);
  
  await createAuditLog({
    userId: user?.id,
    action,
    entityType,
    entityId,
    changes,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}
