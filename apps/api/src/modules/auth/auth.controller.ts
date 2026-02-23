import { FastifyRequest, FastifyReply } from 'fastify';
import { login, refreshAccessToken, logout } from './auth.service';
import { loginSchema } from './login.dto';

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
