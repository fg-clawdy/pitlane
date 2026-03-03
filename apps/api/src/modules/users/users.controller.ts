/**
 * Users Controller
 * Handles user profile and settings endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
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
import { ApiError, ErrorCode, sendSuccess, sendError, getAuthenticatedUser } from '../../lib/api-response';
import {
  updateProfileSchema,
  changePasswordSchema,
  pushSubscriptionSchema,
  emailChangeRequestSchema,
  verifyEmailChangeSchema,
} from './users.dto';

/**
 * Get VAPID public key for push notifications
 * GET /api/v1/users/vapid-public-key
 */
export async function getVapidPublicKeyHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      throw ApiError.serviceUnavailable('Push notifications not configured');
    }

    sendSuccess(reply, { publicKey });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Get current user profile
 * GET /api/v1/users/me
 */
export async function getMeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    const profile = await getUserProfile(user.id);
    if (!profile) {
      throw ApiError.notFound('User');
    }

    sendSuccess(reply, profile);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Update current user profile
 * PATCH /api/v1/users/me
 */
export async function updateMeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    const dto = updateProfileSchema.parse(request.body);
    const profile = await updateUserProfile(user.id, dto);

    sendSuccess(reply, profile);
  } catch (error) {
    request.log.error(error);
    if (error instanceof z.ZodError) {
      sendError(reply, ApiError.validationError(error.errors));
    } else {
      sendError(reply, error);
    }
  }
}

/**
 * Change password
 * POST /api/v1/users/me/change-password
 */
export async function changePasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    const dto = changePasswordSchema.parse(request.body);
    await changePassword(user.id, dto);

    sendSuccess(reply, { message: 'Password changed successfully' });
  } catch (error) {
    request.log.error(error);
    if (error instanceof z.ZodError) {
      sendError(reply, ApiError.validationError(error.errors));
    } else {
      sendError(reply, error);
    }
  }
}

/**
 * Add push subscription for notifications
 * POST /api/v1/users/me/push-subscriptions
 */
export async function addPushSubscriptionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    const dto = pushSubscriptionSchema.parse(request.body);
    await addPushSubscription(user.id, dto);

    sendSuccess(reply, { message: 'Push subscription added' });
  } catch (error) {
    request.log.error(error);
    if (error instanceof z.ZodError) {
      sendError(reply, ApiError.validationError(error.errors));
    } else {
      sendError(reply, error);
    }
  }
}

/**
 * Remove push subscription
 * DELETE /api/v1/users/me/push-subscriptions
 */
export async function removePushSubscriptionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    const endpoint = (request.query as { endpoint: string }).endpoint;
    if (!endpoint) {
      throw ApiError.badRequest('endpoint is required');
    }

    await removePushSubscription(user.id, endpoint);

    sendSuccess(reply, { message: 'Push subscription removed' });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Request email change
 * POST /api/v1/users/me/email-change/request
 */
export async function requestEmailChangeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    const dto = emailChangeRequestSchema.parse(request.body);
    const result = await requestEmailChange(user.id, dto);

    sendSuccess(reply, result);
  } catch (error) {
    request.log.error(error);
    if (error instanceof z.ZodError) {
      sendError(reply, ApiError.validationError(error.errors));
    } else {
      sendError(reply, error);
    }
  }
}

/**
 * Get email change status
 * GET /api/v1/users/me/email-change/status
 */
export async function getEmailChangeStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    const status = await getEmailChangeStatus(user.id);

    sendSuccess(reply, status);
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Cancel email change
 * POST /api/v1/users/me/email-change/cancel
 */
export async function cancelEmailChangeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    await cancelEmailChange(user.id);

    sendSuccess(reply, { message: 'Email change cancelled' });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Waive hold period for email change
 * POST /api/v1/users/me/email-change/waive-hold
 */
export async function waiveHoldEmailChangeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);

    await waiveHoldEmailChange(user.id);

    sendSuccess(reply, { message: 'Hold period waived' });
  } catch (error) {
    request.log.error(error);
    sendError(reply, error);
  }
}

/**
 * Verify email change with token
 * GET /api/v1/users/me/email-change/verify
 */
export async function verifyEmailChangeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const query = verifyEmailChangeSchema.parse(request.query);

    await verifyEmailChange(query.token);

    sendSuccess(reply, { message: 'Email changed successfully' });
  } catch (error) {
    request.log.error(error);
    if (error instanceof z.ZodError) {
      sendError(reply, ApiError.validationError(error.errors));
    } else {
      sendError(reply, error);
    }
  }
}