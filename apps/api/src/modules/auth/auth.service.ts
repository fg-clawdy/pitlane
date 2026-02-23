import { PrismaClient, UserStatus } from '@prisma/client';
import { verifyPassword } from '../../lib/password';
import { generateAccessToken, generateRefreshToken, TokenPayload } from '../../lib/tokens';
import { LoginDto, LoginResponse } from './login.dto';

const prisma = new PrismaClient();

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Login service with account lockout
 * @param dto - Login credentials
 * @returns Login response with access token and user data
 * @throws Error if credentials are invalid or account is locked
 */
export async function login(dto: LoginDto): Promise<LoginResponse> {
  const { email, password } = dto;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Don't reveal that user doesn't exist for security
    throw new Error('Invalid credentials');
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const unlockTime = user.lockedUntil;
    const minutesUntilUnlock = Math.ceil(
      (unlockTime.getTime() - Date.now()) / (1000 * 60)
    );
    throw new Error(
      `Account locked. Please try again in ${minutesUntilUnlock} minutes.`
    );
  }

  // Verify password
  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    // Increment failed login attempts
    const failedAttempts = user.failedLoginAttempts + 1;
    
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      // Lock the account
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil,
        },
      });

      throw new Error(
        `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`
      );
    } else {
      // Just increment failed attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
        },
      });

      throw new Error('Invalid credentials');
    }
  }

  // Check if user is active
  if (user.status !== UserStatus.active) {
    throw new Error('Account is not active. Please verify your email.');
  }

  // Reset failed login attempts on successful login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  // Generate tokens
  const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token in database
  const refreshTokenExpiry = new Date();
  refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30); // 30 days

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: refreshTokenExpiry,
    },
  });

  // Return response
  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      defaultTeamName: user.defaultTeamName,
      status: user.status,
      role: user.role,
    },
  };
}

/**
 * Refresh access token using refresh token
 * @param refreshToken - Refresh token from cookie
 * @returns New access token
 * @throws Error if refresh token is invalid or expired
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
  // Find refresh token in database
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedToken) {
    throw new Error('Invalid refresh token');
  }

  // Check if refresh token is expired
  if (storedToken.expiresAt < new Date()) {
    // Delete expired token
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });
    throw new Error('Refresh token expired');
  }

  // Check if user is still active
  if (storedToken.user.status !== UserStatus.active) {
    throw new Error('Account is not active');
  }

  // Generate new access token
  const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
    userId: storedToken.user.id,
    email: storedToken.user.email,
    role: storedToken.user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);

  return { accessToken };
}

/**
 * Logout user by deleting refresh token
 * @param refreshToken - Refresh token to delete
 */
export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });
}

/**
 * Logout from all devices by deleting all refresh tokens for a user
 * @param userId - User ID
 */
export async function logoutAll(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}