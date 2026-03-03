import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import jwt from 'jsonwebtoken';

// Token configuration
const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

// Get JWT keys from environment variables
const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY!;
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY!;

if (!JWT_PRIVATE_KEY || !JWT_PUBLIC_KEY) {
  throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables must be set');
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate an access token (short-lived, stored in memory)
 * @param payload - Token payload
 * @returns JWT access token
 */
export function generateAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

/**
 * Generate a refresh token (long-lived, stored in httpOnly cookie)
 * @param payload - Token payload
 * @returns JWT refresh token
 */
export function generateRefreshToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token to verify
 * @returns Decoded token payload
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_PUBLIC_KEY, {
      algorithms: ['RS256'],
    }) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Decode a token without verification (for debugging/logging only)
 * @param token - JWT token to decode
 * @returns Decoded token payload or null if invalid
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Get time until token expires in seconds
 * @param token - JWT token
 * @returns Seconds until expiration, or 0 if expired/invalid
 */
export function getTimeUntilExpiry(token: string): number {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return 0;
  }
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, decoded.exp - now);
}

/**
 * Check if token is expired
 * @param token - JWT token
 * @returns True if token is expired
 */
export function isTokenExpired(token: string): boolean {
  return getTimeUntilExpiry(token) === 0;
}
