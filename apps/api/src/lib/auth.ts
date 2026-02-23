import { FastifyRequest } from 'fastify';
import { verifyToken, TokenPayload } from './tokens';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function authenticate(
  request: FastifyRequest,
  reply: { status: (code: number) => { send: (data: any) => any } }
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'No token provided' });
      return;
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
      reply.status(401).send({ error: 'User not found' });
      return;
    }

    if (user.status !== 'active') {
      reply.status(401).send({ error: 'Account is not active' });
      return;
    }

    (request as any).user = user;
  } catch (error) {
    if (error instanceof Error) {
      reply.status(401).send({ error: error.message });
    } else {
      reply.status(401).send({ error: 'Invalid token' });
    }
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