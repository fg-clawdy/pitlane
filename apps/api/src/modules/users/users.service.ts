import { PrismaClient } from '@prisma/client';
import { verifyPassword, hashPassword } from '../../lib/password';
import { UserProfile, UpdateProfileDto, ChangePasswordDto, PushSubscriptionDto } from './types';

const prisma = new PrismaClient();
const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;

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
  if (!user) throw new Error('User not found');
  const isValid = await verifyPassword(dto.currentPassword, user.passwordHash);
  if (!isValid) throw new Error('Current password is incorrect');
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