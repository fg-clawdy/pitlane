# PitLane API

Fastify-based REST API for the PitLane fantasy F1 application.

## Setup

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Generate JWT keys:
   ```bash
   openssl genrsa -out private.pem 2048
   openssl rsa -in private.pem -pubout -out public.pem
   ```
   Then copy the contents into `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` in `.env`.

3. Install dependencies:
   ```bash
   npm install
   ```

4. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

5. Push database schema:
   ```bash
   npm run db:push
   ```

## Development

Run the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3001`.

## API Endpoints

### Authentication

- `POST /api/v1/auth/login` - Login with email and password
- `POST /api/v1/auth/refresh` - Refresh access token using refresh token cookie
- `POST /api/v1/auth/logout` - Logout and clear refresh token cookie

### Health Check

- `GET /health` - Health check endpoint

## Account Lockout

The login system includes account lockout protection:
- After 5 failed login attempts, the account is locked for 15 minutes
- Failed attempts are reset on successful login
- Lockout time is communicated to the user

## Token Management

- **Access Token**: Short-lived (15 minutes), stored in memory
- **Refresh Token**: Long-lived (30 days), stored in httpOnly cookie
- Tokens use RS256 asymmetric encryption for enhanced security

## Build

Build for production:
```bash
npm run build
```

## Start Production Server

```bash
npm start