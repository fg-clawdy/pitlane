import { PrismaClient } from '@prisma/client';
import { ApiError } from '../../lib/api-response';
import { verifyPassword, hashPassword } from '../../lib/password';
import { UserProfile, UpdateProfileDto, ChangePasswordDto, PushSubscriptionDto, EmailChangeRequestDto, EmailChangeResponse, EmailChangeStatus } from './types';
import crypto from 'crypto';

const prisma = new PrismaClient();
const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;

// Default hold period: 24 hours (can be overridden by system settings)
const DEFAULT_EMAIL_CHANGE_HOLD_SECONDS = 86400;
const EMAIL_CHANGE_EXPIRY_HOURS = 72;

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    defaultTeamName: user.defaultTeamName,
    emailEnabled: user.emailEnabled,
    pushEnabled: user.pushEnabled,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function validateUsername(username: string): string | null {
  if (username.length < 3 || username.length > 30) return 'Username must be 3-30 chars';
  if (!USERNAME_REGEX.test(username)) return 'Username can only have letters, numbers, dots, underscores, hyphens';
  return null;
}

function validateDisplayName(displayName: string | null): string | null {
  if (displayName === null || displayName === undefined) return null;
  if (displayName.length < 1 || displayName.length > 50) return 'Display name must be 1-50 chars';
  return null;
}

function validateDefaultTeamName(teamName: string | null): string | null {
  if (teamName === null || teamName === undefined) return null;
  if (teamName.length < 1 || teamName.length > 50) return 'Team name must be 1-50 chars';
  return null;
}

export async function updateUserProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
  if (dto.username !== undefined) {
    const error = validateUsername(dto.username);
    if (error) throw new Error(error);
    const existing = await prisma.user.findFirst({ where: { username: dto.username, NOT: { id: userId } } });
    if (existing) throw new Error('Username already taken');
  }
  if (dto.displayName !== undefined) {
    const error = validateDisplayName(dto.displayName);
    if (error) throw new Error(error);
  }
  if (dto.defaultTeamName !== undefined) {
    const error = validateDefaultTeamName(dto.defaultTeamName);
    if (error) throw new Error(error);
  }

  const updateData: any = {};
  if (dto.username !== undefined) updateData.username = dto.username;
  if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
  if (dto.defaultTeamName !== undefined) updateData.defaultTeamName = dto.defaultTeamName;
  if (dto.emailEnabled !== undefined) updateData.emailEnabled = dto.emailEnabled;
  if (dto.pushEnabled !== undefined) updateData.pushEnabled = dto.pushEnabled;

  const user = await prisma.user.update({ where: { id: userId }, data: updateData });
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    defaultTeamName: user.defaultTeamName,
    emailEnabled: user.emailEnabled,
    pushEnabled: user.pushEnabled,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User');
  const isValid = await verifyPassword(dto.currentPassword, user.passwordHash);
  if (!isValid) throw ApiError.forbidden('Current password is incorrect');
  const newHash = await hashPassword(dto.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);
}

export async function addPushSubscription(userId: string, dto: PushSubscriptionDto): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId, endpoint: dto.endpoint } },
    create: { userId, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth },
    update: { p256dh: dto.p256dh, auth: dto.auth },
  });
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export async function getSystemSetting(key: string, defaultValue: number): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  if (!setting || typeof setting.value !== 'number') return defaultValue;
  return setting.value;
}

export async function requestEmailChange(userId: string, dto: EmailChangeRequestDto): Promise<EmailChangeResponse> {
  // Verify password
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User');
  
  const isValid = await verifyPassword(dto.password, user.passwordHash);
  if (!isValid) throw ApiError.forbidden('Password is incorrect');

  // Check if new email is different
  if (dto.newEmail.toLowerCase() === user.email.toLowerCase()) {
    throw ApiError.badRequest('New email must be different from current email');
  }

  // Check if new email is already in use
  const existingUser = await prisma.user.findFirst({
    where: {
      email: { equals: dto.newEmail, mode: 'insensitive' },
      NOT: { id: userId }
    }
  });
  if (existingUser) throw ApiError.conflict('Email is already in use');

  // Cancel any existing pending request
  await prisma.emailChangeRequest.updateMany({
    where: { userId, cancelledAt: null, completedAt: null },
    data: { cancelledAt: new Date() }
  });

  // Get hold period from system settings
  const holdPeriodSeconds = await getSystemSetting('email_change_hold_seconds', DEFAULT_EMAIL_CHANGE_HOLD_SECONDS);

  // Create new request
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_EXPIRY_HOURS * 60 * 60 * 1000);

  const request = await prisma.emailChangeRequest.create({
    data: {
      userId,
      newEmail: dto.newEmail,
      token,
      expiresAt,
    }
  });

  return {
    id: request.id,
    newEmail: request.newEmail,
    currentEmail: user.email,
    expiresAt: request.expiresAt,
    holdPeriodSeconds,
    canWaive: true,
  };
}

export async function getEmailChangeStatus(userId: string): Promise<EmailChangeStatus> {
  const request = await prisma.emailChangeRequest.findFirst({
    where: {
      userId,
      cancelledAt: null,
      completedAt: null,
      expiresAt: { gt: new Date() }
    }
  });

  if (!request) {
    return { hasPendingRequest: false, request: null };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const holdPeriodSeconds = await getSystemSetting('email_change_hold_seconds', DEFAULT_EMAIL_CHANGE_HOLD_SECONDS);

  return {
    hasPendingRequest: true,
    request: {
      id: request.id,
      newEmail: request.newEmail,
      currentEmail: user?.email || '',
      expiresAt: request.expiresAt,
      holdPeriodSeconds,
      canWaive: request.holdWaivedAt === null,
    }
  };
}

export async function cancelEmailChange(userId: string): Promise<void> {
  const request = await prisma.emailChangeRequest.findFirst({
    where: {
      userId,
      cancelledAt: null,
      completedAt: null,
      expiresAt: { gt: new Date() }
    }
  });

  if (!request) throw new Error('No pending email change request found');

  await prisma.emailChangeRequest.update({
    where: { id: request.id },
    data: { cancelledAt: new Date() }
  });
}

export async function waiveHoldEmailChange(userId: string): Promise<void> {
  const request = await prisma.emailChangeRequest.findFirst({
    where: {
      userId,
      cancelledAt: null,
      completedAt: null,
      expiresAt: { gt: new Date() }
    }
  });

  if (!request) throw new Error('No pending email change request found');
  if (request.holdWaivedAt) throw new Error('Hold already waived');

  await prisma.emailChangeRequest.update({
    where: { id: request.id },
    data: { holdWaivedAt: new Date() }
  });
}

export async function verifyEmailChange(token: string): Promise<void> {
  const request = await prisma.emailChangeRequest.findUnique({
    where: { token },
    include: { user: true }
  });

  if (!request) throw new Error('Invalid token');
  if (request.cancelledAt) throw new Error('Request was cancelled');
  if (request.completedAt) throw new Error('Request already completed');
  if (request.expiresAt < new Date()) throw new Error('Token has expired');

  // Check if hold period has elapsed or been waived
  const holdPeriodSeconds = await getSystemSetting('email_change_hold_seconds', DEFAULT_EMAIL_CHANGE_HOLD_SECONDS);
  const holdElapsed = Date.now() >= request.createdAt.getTime() + holdPeriodSeconds * 1000;
  
  if (!request.holdWaivedAt && !holdElapsed) {
    throw new Error('Hold period has not elapsed yet');
  }

  // Update user email and mark request as completed
  await prisma.$transaction([
    prisma.user.update({
      where: { id: request.userId },
      data: { email: request.newEmail }
    }),
    prisma.emailChangeRequest.update({
      where: { id: request.id },
      data: { completedAt: new Date() }
    }),
    // Invalidate all refresh tokens
    prisma.refreshToken.deleteMany({ where: { userId: request.userId } })
  ]);
}