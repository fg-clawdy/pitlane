import { PrismaClient, UserStatus } from '@prisma/client';
import { verifyPassword, hashPassword } from '../../lib/password';
import { generateAccessToken, generateRefreshToken, TokenPayload } from '../../lib/tokens';
import { LoginDto, LoginResponse } from './login.dto';
import crypto from 'crypto';

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

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;

export interface RegisterDto {
  email: string;
  password: string;
  username?: string;
}

export interface RegisterResponse {
  message: string;
  userId: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface VerifyEmailResponse {
  message: string;
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    defaultTeamName: string | null;
    status: UserStatus;
    role: string;
  };
}

/**
 * Register a new user with email verification
 * @param dto - Registration data
 * @returns Registration response with userId
 * @throws Error if validation fails or email already exists
 */
export async function register(dto: RegisterDto): Promise<RegisterResponse> {
  const { email, password, username } = dto;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  // Validate password complexity
  if (!PASSWORD_REGEX.test(password)) {
    throw new Error('Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 digit, and 1 special character');
  }

  // Generate username from email if not provided
  const finalUsername = username || email.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 30);

  // Validate username
  if (finalUsername.length < 3 || !USERNAME_REGEX.test(finalUsername)) {
    throw new Error('Username must be 3-30 characters with only letters, numbers, dots, underscores, or hyphens');
  }

  // Check if email already exists
  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });
  if (existingEmail) {
    throw new Error('Email already registered');
  }

  // Check if username already exists
  const existingUsername = await prisma.user.findUnique({
    where: { username: finalUsername },
  });
  if (existingUsername) {
    throw new Error('Username already taken');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user with pending_verification status
  const user = await prisma.user.create({
    data: {
      email,
      username: finalUsername,
      passwordHash,
      status: UserStatus.pending_verification,
    },
  });

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpires = new Date();
  tokenExpires.setHours(tokenExpires.getHours() + 24); // 24 hour expiry

  await prisma.verificationToken.create({
    data: {
      token: verificationToken,
      userId: user.id,
      expiresAt: tokenExpires,
    },
  });

  // TODO: Send verification email (when email service is implemented)
  // For now, return the token in development
  const message = process.env.NODE_ENV === 'production'
    ? 'Registration successful. Please check your email to verify your account.'
    : `Registration successful. Verification token: ${verificationToken}`;

  return {
    message,
    userId: user.id,
  };
}

/**
 * Verify email address with token
 * @param token - Verification token
 * @returns Login response with access token
 * @throws Error if token is invalid or expired
 */
export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  // Find verification token
  const storedToken = await prisma.verificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!storedToken) {
    throw new Error('Invalid verification token');
  }

  // Check if token is expired
  if (storedToken.expiresAt < new Date()) {
    // Delete expired token
    await prisma.verificationToken.delete({
      where: { id: storedToken.id },
    });
    throw new Error('Verification token expired. Please request a new one.');
  }

  // Update user status to active
  const user = await prisma.user.update({
    where: { id: storedToken.userId },
    data: { status: UserStatus.active },
  });

  // Delete the verification token
  await prisma.verificationToken.delete({
    where: { id: storedToken.id },
  });

  // Generate tokens for auto-login
  const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token
  const refreshTokenExpiry = new Date();
  refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: refreshTokenExpiry,
    },
  });

  return {
    message: 'Email verified successfully',
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
 * Request password reset email
 * @param dto - Forgot password data
 * @returns Success message (always returns success for security)
 */
export async function forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; token?: string }> {
  const { email } = dto;

  // Always return success to prevent email enumeration
  const successMessage = 'If an account with that email exists, a password reset link has been sent.';

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return { message: successMessage };
  }

  // Invalidate any existing password reset tokens for this user
  await prisma.verificationToken.deleteMany({
    where: { userId: user.id },
  });

  // Generate new reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenExpires = new Date();
  tokenExpires.setHours(tokenExpires.getHours() + 1); // 1 hour expiry

  await prisma.verificationToken.create({
    data: {
      token: resetToken,
      userId: user.id,
      expiresAt: tokenExpires,
    },
  });

  // TODO: Send password reset email (when email service is implemented)
  // For development, return the token
  return {
    message: successMessage,
    ...(process.env.NODE_ENV !== 'production' && { token: resetToken }),
  };
}

/**
 * Reset password with token
 * @param dto - Reset password data
 * @returns Success message
 * @throws Error if token is invalid or password doesn't meet requirements
 */
export async function resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
  const { token, newPassword } = dto;

  // Validate password complexity
  if (!PASSWORD_REGEX.test(newPassword)) {
    throw new Error('Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 digit, and 1 special character');
  }

  // Find reset token
  const storedToken = await prisma.verificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!storedToken) {
    throw new Error('Invalid or expired reset token');
  }

  // Check if token is expired
  if (storedToken.expiresAt < new Date()) {
    await prisma.verificationToken.delete({
      where: { id: storedToken.id },
    });
    throw new Error('Reset token expired. Please request a new one.');
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password and activate account if needed
  await prisma.$transaction([
    prisma.user.update({
      where: { id: storedToken.userId },
      data: {
        passwordHash,
        status: UserStatus.active,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.verificationToken.delete({
      where: { id: storedToken.id },
    }),
    // Invalidate all refresh tokens (force re-login)
    prisma.refreshToken.deleteMany({
      where: { userId: storedToken.userId },
    }),
  ]);

  return { message: 'Password reset successfully. Please log in with your new password.' };
}

/**
 * Resend verification email
 * @param email - User email
 * @returns Success message
 */
export async function resendVerification(email: string): Promise<{ message: string; token?: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.status !== UserStatus.pending_verification) {
    // Return success anyway to prevent enumeration
    return { message: 'If your email needs verification, a new link has been sent.' };
  }

  // Delete existing tokens
  await prisma.verificationToken.deleteMany({
    where: { userId: user.id },
  });

  // Generate new verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpires = new Date();
  tokenExpires.setHours(tokenExpires.getHours() + 24);

  await prisma.verificationToken.create({
    data: {
      token: verificationToken,
      userId: user.id,
      expiresAt: tokenExpires,
    },
  });

  // TODO: Send verification email
  return {
    message: 'If your email needs verification, a new link has been sent.',
    ...(process.env.NODE_ENV !== 'production' && { token: verificationToken }),
  };
}
