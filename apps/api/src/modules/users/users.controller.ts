import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  addPushSubscription,
  removePushSubscription,
  requestEmailChange,
  getEmailChangeStatus,
  cancelEmailChange,
  waiveHoldEmailChange,
  verifyEmailChange
} from './users.service';
import { UpdateProfileDto, ChangePasswordDto, PushSubscriptionDto, EmailChangeRequestDto } from './types';

// VAPID public key endpoint - returns the public key for frontend push subscription
export async function getVapidPublicKeyHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    reply.status(503).send({ error: 'Push notifications not configured' });
    return;
  }
  reply.status(200).send({ publicKey });
}

export async function getMeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      reply.status(400).send({ error: 'User not found' });
      return;
    }

    reply.status(200).send(profile);
  } catch (error) {
    if (error instanceof Error) {
      reply.status(500).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

export async function updateMeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const dto = request.body as UpdateProfileDto;
    const profile = await updateUserProfile(user.id, dto);

    reply.status(200).send(profile);
  } catch (error) {
    if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

export async function changePasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const dto = request.body as ChangePasswordDto;
    await changePassword(user.id, dto);

    reply.status(200).send({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

export async function addPushSubscriptionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const dto = request.body as PushSubscriptionDto;
    await addPushSubscription(user.id, dto);

    reply.status(200).send({ message: 'Push subscription added' });
  } catch (error) {
    if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

export async function removePushSubscriptionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const endpoint = (request.query as { endpoint: string }).endpoint;
    await removePushSubscription(user.id, endpoint);

    reply.status(200).send({ message: 'Push subscription removed' });
  } catch (error) {
    if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

// Email change handlers
export async function requestEmailChangeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const dto = request.body as EmailChangeRequestDto;
    const result = await requestEmailChange(user.id, dto);

    // In development, return the token for testing
    const isDev = process.env.NODE_ENV !== 'production';
    reply.status(200).send({
      ...result,
      ...(isDev && { _token: (await import('crypto').then(c => c.randomBytes(32).toString('hex'))) })
    });
  } catch (error) {
    if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

export async function getEmailChangeStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    const status = await getEmailChangeStatus(user.id);
    reply.status(200).send(status);
  } catch (error) {
    if (error instanceof Error) {
      reply.status(500).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

export async function cancelEmailChangeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    await cancelEmailChange(user.id);
    reply.status(200).send({ message: 'Email change cancelled' });
  } catch (error) {
    if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

export async function waiveHoldEmailChangeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = (request as any).user;
    if (!user) {
      reply.status(401).send({ error: 'Not authenticated' });
      return;
    }

    await waiveHoldEmailChange(user.id);
    reply.status(200).send({ message: 'Hold period waived' });
  } catch (error) {
    if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

export async function verifyEmailChangeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { token } = request.query as { token: string };
    
    if (!token) {
      reply.status(400).send({ error: 'Token is required' });
      return;
    }

    await verifyEmailChange(token);
    reply.status(200).send({ message: 'Email changed successfully' });
  } catch (error) {
    if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}