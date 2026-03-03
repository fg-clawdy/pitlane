import { FastifyRequest } from 'fastify';
import { verifyToken, TokenPayload } from './tokens';
import { PrismaClient } from '@prisma/client';
import { ApiError, sendError } from './api-response';

const prisma = new PrismaClient();

export async function authenticate(
  request: FastifyRequest,
  reply: { status: (code: number) => { send: (data: any) => any } }
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
        role: true,
        displayName: true,
        defaultTeamName: true,
        emailEnabled: true,
        pushEnabled: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (user.status !== 'active') {
      throw ApiError.unauthorized('Account is not active');
    }

    (request as any).user = user;
  } catch (error) {
    // Re-throw the error to let Fastify's error handler deal with it
    throw error instanceof ApiError ? error : ApiError.unauthorized('Invalid token');
  }
}

export function getCurrentUser(request: FastifyRequest): TokenPayload | null {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}