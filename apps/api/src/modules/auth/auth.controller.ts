import { FastifyRequest, FastifyReply } from 'fastify';
import { login, refreshAccessToken, logout, register, verifyEmail, forgotPassword, resetPassword, resendVerification } from './auth.service';
import { loginSchema } from './login.dto';
import { z } from 'zod';

// Request body schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).max(30).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

/**
 * POST /api/v1/auth/register
 * Register a new user with email verification
 */
export async function registerHandler(
  request: FastifyRequest<{ Body: { email: string; password: string; username?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const dto = registerSchema.parse(request.body);
    const result = await register(dto);
    reply.status(201).send(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400).send({ error: 'Validation failed', details: error.errors });
    } else if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

/**
 * POST /api/v1/auth/login
 * Login endpoint with account lockout
 */
export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Validate request body
    const dto = loginSchema.parse(request.body);

    // Attempt login
    const result = await login(dto);

    // Set refresh token in httpOnly cookie
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30);

    (reply as any).setCookie('refreshToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: refreshTokenExpiry,
    });

    // Return access token and user data
    reply.status(200).send(result);
  } catch (error) {
    if (error instanceof Error) {
      reply.status(401).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token from cookie
 */
export async function refreshHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get refresh token from cookie
    const refreshToken = (request as any).cookies.refreshToken;

    if (!refreshToken) {
      reply.status(401).send({ error: 'No refresh token provided' });
      return;
    }

    // Refresh access token
    const result = await refreshAccessToken(refreshToken);

    reply.status(200).send(result);
  } catch (error) {
    if (error instanceof Error) {
      reply.status(401).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

/**
 * POST /api/v1/auth/logout
 * Logout user by deleting refresh token
 */
export async function logoutHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get refresh token from cookie
    const refreshToken = (request as any).cookies.refreshToken;

    if (refreshToken) {
      await logout(refreshToken);
    }

    // Clear refresh token cookie
    (reply as any).clearCookie('refreshToken', {
      path: '/',
    });

    reply.status(200).send({ message: 'Logged out successfully' });
  } catch (error) {
    reply.status(500).send({ error: 'Internal server error' });
  }
}

/**
 * GET /api/v1/auth/verify-email
 * Verify email address with token
 */
export async function verifyEmailHandler(
  request: FastifyRequest<{ Querystring: { token: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { token } = request.query;
    
    if (!token) {
      reply.status(400).send({ error: 'Verification token is required' });
      return;
    }

    const result = await verifyEmail(token);

    // Set refresh token in httpOnly cookie for auto-login
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30);

    // Note: We're using accessToken as refresh token here for simplicity
    // In production, generate separate refresh token
    (reply as any).setCookie('refreshToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: refreshTokenExpiry,
    });

    reply.status(200).send(result);
  } catch (error) {
    if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

/**
 * POST /api/v1/auth/forgot-password
 * Request password reset email
 */
export async function forgotPasswordHandler(
  request: FastifyRequest<{ Body: { email: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const dto = forgotPasswordSchema.parse(request.body);
    const result = await forgotPassword(dto);
    reply.status(200).send(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400).send({ error: 'Invalid email format' });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

/**
 * POST /api/v1/auth/reset-password
 * Reset password with token
 */
export async function resetPasswordHandler(
  request: FastifyRequest<{ Body: { token: string; newPassword: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const dto = resetPasswordSchema.parse(request.body);
    const result = await resetPassword(dto);
    reply.status(200).send(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      reply.status(400).send({ error: 'Validation failed', details: error.errors });
    } else if (error instanceof Error) {
      reply.status(400).send({ error: error.message });
    } else {
      reply.status(500).send({ error: 'Internal server error' });
    }
  }
}

/**
 * POST /api/v1/auth/resend-verification
 * Resend verification email
 */
export async function resendVerificationHandler(
  request: FastifyRequest<{ Body: { email: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { email } = request.body as { email: string };
    
    if (!email || typeof email !== 'string') {
      reply.status(400).send({ error: 'Email is required' });
      return;
    }

    const result = await resendVerification(email);
    reply.status(200).send(result);
  } catch (error) {
    reply.status(500).send({ error: 'Internal server error' });
  }
}