import { FastifyRequest, FastifyReply } from 'fastify';
import { getUserProfile, updateUserProfile, changePassword, addPushSubscription, removePushSubscription } from './users.service';
import { UpdateProfileDto, ChangePasswordDto, PushSubscriptionDto } from './types';

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
      reply.status(404).send({ error: 'Not authenticated' });
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
      reply.status(404).send({ error: 'Not authenticated' });
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
      reply.status(404).send({ error: 'Not authenticated' });
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