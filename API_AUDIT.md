# PitLane Backend API Audit & Analysis
**Date: March 2, 2026** | **Framework:** Fastify + TypeScript + Prisma ORM + PostgreSQL

---

## Executive Summary

Your API is **moderately homogeneous** with good foundational patterns, but has several **critical gaps** in data integrity, validation consistency, and error handling. The architecture is solid, but implementation varies significantly across modules.

**Overall Health Score: 6.5/10** ⚠️

### Key Findings
- ✅ **Strengths:** Standardized response format, good error classifications, transaction usage
- ⚠️ **Warnings:** Incomplete input validation, missing DTOs/schemas, inconsistent error handling
- 🔴 **Critical:** Authorization gaps, missing business logic validation, race conditions in some endpoints

---

## 1. Architecture & Layering ✅ GOOD

### Current Pattern
```
routes → handler functions → controller (class-based) → service → database
```

**Assessment: CONSISTENT**
- Routes properly delegate to handlers
- Handlers parse input and call controllers
- Controllers orchestrate business logic via services
- Services handle database operations

**Issues Found:**
- **Auth module**: Mixes concerns - auth.ts does both middleware + user lookup
- **Leagues/Drafts**: Use class-based controllers (✅ good)
- **Notifications/Users**: Use function-based handlers (inconsistent with leagues/drafts)
- **No clear input validation layer** - scattered across controllers/services

---

## 2. Response Standardization ✅ GOOD

### Status: STANDARDIZED

All responses follow consistent format:
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: { code, message, details? } }
```

**Coverage:**
- ✅ 8/8 modules use `sendSuccess()` / `sendError()` from `api-response.ts`
- ✅ Standard error codes defined in `ErrorCode` enum
- ✅ HTTP status codes properly mapped

**Issues Found:**
- Some error responses bypass the standard (auth middleware returns raw `{ error: string }`)
- Not all error codes are used consistently across modules
- Missing specific error codes for:
  - Draft-specific errors (timeout, unavailable driver, etc.)
  - Scoring errors (calculation failures)
  - Payment/subscription errors

---

## 3. Error Handling & Recovery 🟡 INCONSISTENT

### Error Code Coverage

**Used Codes:**
- UNAUTHORIZED, INVALID_TOKEN, TOKEN_EXPIRED ✅
- FORBIDDEN, VALIDATION_ERROR ✅
- NOT_FOUND variants ✅
- ALREADY_EXISTS, DUPLICATE_ENTRY ✅
- BUSINESS_RULE_VIOLATION ✅

**Missing Codes:**
```
RATE_LIMITED
DRAFT_WINDOW_CLOSED
DRIVER_ALREADY_PICKED
LEAGUE_FULL_ERROR
MISSING_REQUIRED_FIELDS
INVALID_STATE_TRANSITION
CONCURRENT_MODIFICATION
DATA_INTEGRITY_ERROR
```

### Critical Issues

#### Issue #1: Auth Middleware Doesn't Use Standard Response
[auth.ts](auth.ts#L1-L50)
```typescript
// ❌ WRONG - Doesn't use sendError()
reply.status(401).send({ error: 'No token provided' });

// ✅ SHOULD BE
sendError(reply, ApiError.unauthorized('No token provided'));
```

**Impact:** Inconsistent error format from auth failures, breaks client parsing

#### Issue #2: Services Throw Generic Error Strings
```typescript
// ❌ BAD - No error codes
throw new Error('Username already taken');
throw new Error('League name already exists for this season');

// ✅ GOOD - Specific error codes
throw ApiError.conflict('Username already taken');
```

**Impact:** Controllers don't know severity level, can't set correct HTTP status

#### Issue #3: Incomplete Error Handling in Complex Operations
[scoring.service.ts#226](scoring-service.ts#L226)
```typescript
await this.prisma.$transaction(async (tx) => {
  // No error context added to transaction operations
  // If tx fails, no details about which league/race failed
});
```

---

## 4. Input Validation 🔴 CRITICAL GAPS

### Status: INCONSISTENT & INCOMPLETE

**Module-by-Module Assessment:**

| Module | DTOs | Zod Schemas | Manual Validation | Score |
|--------|------|-------------|------------------|-------|
| Auth | ✅ login.dto.ts | ✅ Full coverage | ✅ Password regex | 9/10 |
| Users | ❌ No DTO | ❌ No schemas | ⚠️ Inline strings | 4/10 |
| Leagues | ❌ No DTO | ❌ No schemas | ⚠️ Inline strings | 4/10 |
| Drafts | ❌ No DTO | ❌ No schemas | ❌ Missing | 2/10 |
| Scoring | ❌ No DTO | ❌ No schemas | ❌ None | 1/10 |
| Notifications | ❌ No DTO | ❌ No schemas | ❌ Incomplete | 2/10 |
| F1Data | ❌ Unknown | ❌ Unknown | ❌ Unknown | ? |
| Admin | ❌ No DTO | ⚠️ Partial | ⚠️ Incomplete | 3/10 |

### Critical Gaps

#### Gap #1: No Validation for Scoring Endpoints
[scoring.controller.ts#1-100]
```typescript
// ❌ NO VALIDATION
async getRaceScores(
  request: FastifyRequest<{ Params: { id: string; round: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { id: leagueId, round } = request.params;
  // round could be: "abc", "-5", "1000", null
  // Only parseInt() is used - no validation!
  
  const race = await this.prisma.race.findFirst({
    where: {
      seasonId: league.seasonId,
      round: parseInt(round, 10), // ❌ Could be NaN
    },
  });
}
```

**Required fixes:**
```typescript
// ✅ SHOULD BE
const roundSchema = z.object({
  id: z.string().cuid(),
  round: z.coerce.number().int().min(1).max(25),
});
const { id: leagueId, round } = roundSchema.parse(request.params);
```

#### Gap #2: No Validation for League Creation
[leagues.service.ts#30-50]
```typescript
async createLeague(userId: string, input: CreateLeagueInput) {
  // input has NO type safety - CreateLeagueInput is just interface
  // No actual runtime validation that:
  // - name is string (not null/array/object)
  // - scoringType is valid enum
  // - maxPlayers is actually a number
  // - seasonId exists
}
```

#### Gap #3: Missing Validation in Draft Service
[drafts.service.ts#961]
```typescript
async submitPick({ draftWindowId, leagueMemberId, driverId }: SubmitPickInput) {
  // ❌ No validation that:
  // - draftWindowId format is valid
  // - leagueMemberId format is valid
  // - driverId format is valid
  // - User making request owns the leagueMemberId
}
```

---

## 5. Authentication & Authorization 🔴 CRITICAL ISSUES

### Current Implementation
- ✅ JWT tokens with expiry
- ✅ Refresh token rotation
- ✅ Account lockout on failed attempts (5 attempts, 15 min lockout)
- ❌ Inconsistent auth middleware usage
- ❌ Missing authorization checks in several endpoints

### Critical Issues

#### Issue #1: Auth Middleware Not Applied Consistently
[auth.routes.ts#1-110]
```typescript
// ✅ PROTECTED (auth middleware)
fastify.get('/me', { preHandler: authenticate }, getMeHandler);

// ❌ PUBLIC (should be protected!)
fastify.get('/leagues/:id', getLeagueHandler); 
// But what about /leagues/:id/members (could leak private league data)?

// ❌ Inconsistent
fastify.post('/me/password', { preHandler: authenticate }, ...);
fastify.post('/logout', logoutHandler);  // No auth check!
```

#### Issue #2: Missing Role-Based Authorization
No authorization checks for:
- Who can update draft order? (only commissioner)
- Who can enter race results? (only admin)
- Who can set system settings? (only super_admin)
- Who can flag commissioner issues? (only league members)

**Example:** [leagues.controller.ts#400+]
```typescript
async updateDraftOrder(request: FastifyRequest, reply: FastifyReply) {
  const user = getAuthenticatedUser(request);
  const { leagueId } = request.params;
  
  // ❌ NO CHECK: Is user the commissioner?
  // Any authenticated user could update ANY league's draft order!
  
  const league = await this.leaguesService.updateDraftOrder(leagueId, body);
}
```

#### Issue #3: Insufficient Permission Checks in Services
[users.service.ts#150+]
```typescript
async changePassword(userId: string, dto: ChangePasswordDto) {
  // ✅ Good: Verifies current password
  const isValid = await verifyPassword(dto.currentPassword, user.passwordHash);
  
  // ✅ Good: Invalidates all refresh tokens
  await prisma.$transaction([
    prisma.user.update({ ... }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);
}

// But what about:
async requestEmailChange(userId: string, dto: EmailChangeRequestDto) {
  // ⚠️ Verifies password twice - inefficient
  // ⚠️ Doesn't check if user can actually change email (throttled? verified?)
  // ⚠️ No audit log
}
```

---

## 6. Data Integrity & Transaction Safety 🟡 PARTIAL

### Database Constraints
✅ **Good:**
- Foreign key constraints with cascading deletes
- Unique constraints on (seasonId, round) for races
- Unique constraint on (leagueId, userId) for league members
- Unique constraint on (draftWindowId, leagueMemberId, round) for draft picks
- Soft deletes via `leftAt` timestamp on LeagueMember

❌ **Missing:**
- No constraint preventing user from joining same league twice during race conditions
- No constraint on duplicate email addresses during concurrent email changes
- Missing indexes on frequently queried fields (e.g., User.id in notifications)

### Transaction Usage

**Current Statistics:**
- Used in: 9 files
- Auth: 1 transaction (logout)
- Users: 2 transactions (password change, email verification)
- Leagues: 2 transactions (join league, leave league)
- Drafts: 1 transaction (submit pick)
- Scoring: 2 transactions (race scores, standings)

#### Good Examples
[auth.service.ts#469]
```typescript
// ✅ CORRECT: Transaction ensures both happen or neither
await prisma.$transaction([
  prisma.user.update({ ... passwordHash ... }),
  prisma.refreshToken.deleteMany({ where: { userId } }), // Invalidate all sessions
]);
```

[users.service.ts#259]
```typescript
// ✅ CORRECT: Prevents race condition
await prisma.$transaction([
  prisma.emailChangeRequest.updateMany({ cancelledAt: new Date() }),
  prisma.emailChangeRequest.create({ ... newRequest ... }),
]);
```

#### Problem Examples
[leagues.service.ts#737]
```typescript
// ⚠️ INCOMPLETE TRANSACTION
const [member] = await this.prisma.$transaction([
  prisma.leagueMember.create({ ... }),
  // Missing: Update league memberCount? Check if league is full?
  // No validation that league isn't full!
]);
```

[scoring.service.ts#226]
```typescript
// ❌ SILENT FAILURES
await this.prisma.$transaction(async (tx) => {
  for (const league of leagues) {
    const scores = await calculateScores(...);
    // If this fails for one league, entire transaction fails
    // No granular error handling or logging
  }
});
```

---

## 7. Type Safety & DTOs 🟡 INCONSISTENT

### Current State
- ✅ All files use TypeScript
- ✅ Auth module has full DTO coverage (login.dto.ts)
- ❌ 7/8 modules missing input validation DDOs
- ❌ Response types are interfaces, not Zod schemas

### Examples of Missing Type Safety

#### No Request DTO Validation
[leagues.controller.ts#20]
```typescript
// ❌ No validation of request body shape
const body = request.body as CreateLeagueInput;

// Could be:
// { name: null, scoringType: "invalid", maxPlayers: [] }
// No runtime validation!
```

**Should be:**
```typescript
const createLeagueSchema = z.object({
  name: z.string().min(3).max(80),
  seasonId: z.string().cuid(),
  scoringType: z.enum(['fia_official', 'linear_20', 'proprietary']).optional(),
  draftType: z.enum(['snake', 'regular']).optional(),
  // ... etc
});

const input = createLeagueSchema.parse(request.body);
```

#### Inconsistent Response Types
[leagues.types.ts]
```typescript
// Interface - no validation
export interface LeagueResponse {
  id: string;
  name: string;
  // ...
}

// vs Auth
export type LoginResponse = z.infer<typeof loginResponseSchema>; // ✅ Zod-validated
```

---

## 8. Cross-Module Consistency Issues 🔴 CRITICAL

### Pattern Inconsistencies

| Area | Auth | Users | Leagues | Drafts | Scoring |
|------|------|-------|---------|--------|---------|
| Controller Pattern | Functions | Functions | Classes | Classes | Classes |
| DTO/Validation | Zod ✅ | None ❌ | None ❌ | None ❌ | None ❌ |
| Error Handling | Good ✅ | Inconsistent ⚠️ | Inconsistent ⚠️ | Minimal ❌ | Minimal ❌ |
| Transactions | Some ⚠️ | Some ⚠️ | Some ⚠️ | Some ⚠️ | Some ⚠️ |
| Rate Limiting | Yes ✅ | Yes ✅ | No ❌ | No ❌ | No ❌ |
| WebSocket Support | No | No | No | Yes ✅ | No |
| Logging | Good ✅ | Good ✅ | Good ✅ | Good ✅ | Good ✅ |

### Issue #1: Inconsistent Controller Patterns
```typescript
// Leagues - CLASS BASED
export class LeaguesController {
  constructor(private leaguesService: LeaguesService) {}
  async createLeague(request, reply) { ... }
}

// Auth - FUNCTION BASED
export async function registerHandler(request, reply) { ... }

// This requires different import patterns and makes testing harder
```

### Issue #2: No Consistent Pagination
```typescript
// Admin lists users with pagination
{ page, limit, search, role, status }

// But drafts list without pagination
getLeagueDraftWindows(leagueId) // Returns all, no limit!

// And notifications use inconsistent param names
{ page, limit, unreadOnly, type }
```

### Issue #3: Inconsistent Error Messages

Same scenario, different errors:
```typescript
// Leagues
throw new Error('League name already exists for this season');

// Drafts (if it had validation)
throw new Error('Draft already exists for this race');

// Should use consistent pattern:
throw ApiError.conflict('League already exists for season');
```

---

## 9. Race Conditions & Concurrency ⚠️ HIGH RISK

### Identified Issues

#### Issue #1: Draft Pick Submission Race Condition
[drafts.service.ts (not shown)]
```typescript
// ❌ UNSAFE: Multiple steps in sequence
async submitPick(draftWindowId, leagueMemberId, driverId) {
  // Step 1: Check if draft is open
  const draftWindow = await prisma.draftWindow.findUnique(...);
  if (draftWindow.status !== 'open') throw Error(...);
  
  // Step 2: Check if driver is available (⚠️ BETWEEN 1 & 2, ANOTHER USER PICKED IT!)
  
  // Step 3: Create draft pick
  await prisma.draftPick.create({ driverId });
}
// Result: Two users can pick the same driver
```

**Fix:** Use transaction with proper locking
```typescript
await prisma.$transaction(async (tx) => {
  const [draftWindow, existingPick] = await Promise.all([
    tx.draftWindow.findUnique({ where: { id: draftWindowId } }),
    tx.draftPick.findFirst({ where: { driverId, draftWindowId } }),
  ]);
  
  if (existingPick) throw Error('Driver already picked');
  await tx.draftPick.create(...);
});
```

#### Issue #2: League Member Limit Check
[leagues.service.ts#750+]
```typescript
async joinLeague(leagueId, userId) {
  const league = await this.prisma.league.findUnique({
    include: { members: { where: { leftAt: null } } }
  });
  
  // ❌ UNSAFE: Between check and create, another user could join!
  if (league.members.length >= league.maxPlayers) {
    throw Error('League is full');
  }
  
  // ❌ If this fails, transaction should prevent
  await this.prisma.leagueMember.create({ ... });
}
```

#### Issue #3: Email Change During Verification
```typescript
// ❌ User can request email change, then:
// 1. Another tab initiates email change again
// 2. Verification tokens overlap
// 3. Unclear which change succeeds
```

---

## 10. Missing Validation & Business Rules 🔴 CRITICAL

### Validation Gaps

#### Missing Input Validation
```typescript
// Scoring - no validation of sorts
GET /races/:round/scores
// - round could be "abc", "-1", "999"

// Leagues - no validation of team name
POST /leagues/:id/join
{ teamName: "..." }
// - teamName could be "", very long, contain injected code

// Drafts - no validation of pick order
POST /drafts/:id/picks
{ driverId: "..." }
// - driverId could be from different season
```

#### Missing Business Logic Validation
```typescript
// If user is already in league, what happens?
POST /leagues/:id/join
// ❌ No check: user.leagueMemberships.find(m => m.leagueId === id && !m.leftAt)

// If draft window is open but user isn't in league, what happens?
POST /drafts/:id/pick
// ❌ No check: Is leagueMemberId actually from this league?

// If picking driver from different season?
POST /drafts/:id/pick
// ❌ No check: Does driverId belong to season of this league?

// If two picks submitted simultaneously?
POST /drafts/:id/pick
// ❌ No lock mechanism - both could succeed
```

---

## 11. Missing Audit & Observability ⚠️ GAPS

### Audit Logging
- ❌ No audit log when league created/deleted
- ❌ No audit log when user joins/leaves league
- ❌ ⚠️ Audit log table exists but rarely populated
- ✅ Auth logs account lockouts

### Observability
- ✅ Fastify logger used in handlers
- ❌ No structured logging (no request IDs for tracing)
- ❌ No performance metrics
- ❌ No error rate metrics

### Recommended Additions
```typescript
// Create centralized audit logger
async function auditLog(userId, action, entityType, entityId, changes?) {
  await prisma.auditLog.create({
    data: { userId, action, entityType, entityId, changes }
  });
}

// Use in all mutations
async joinLeague(userId, leagueId) {
  const member = await prisma.leagueMember.create(...);
  await auditLog(userId, 'JOIN_LEAGUE', 'League', leagueId, { teamName });
}
```

---

## 12. API Endpoint Security Assessment

### Public Endpoints (No Auth)
```
GET  /health                          ✅ OK (health check)
GET  /leagues                         ✅ OK (public leagues only)
GET  /leagues/:id                     ⚠️ Needs visibility check
GET  /leagues/:id/members             ⚠️ Leaks member list
GET  /join/:inviteToken               ✅ OK (token-based)
POST /join/:inviteToken               ✅ OK (requires auth)
GET  /users/vapid-public-key         ✅ OK (public key)
```

### Protected Endpoints (Auth Required)
```
POST /auth/login                      ✅ Proper auth
POST /auth/register                   ✅ Rate limited (5/min)
POST /auth/refresh                    ⚠️ No CSRF token
POST /auth/logout                     ⚠️ No auth check applied!
GET  /users/me                        ✅ Auth required
PATCH /users/me                       ✅ Rate limited
POST /leagues                         ✅ Auth required
```

### Admin Endpoints
```
GET  /admin/stats                     ⚠️ No auth check visible
GET  /admin/users                     ⚠️ No role check
POST /admin/scoring/calculate/:raceId ⚠️ No role check
```

---

## 13. Recommended Fix Priority

### 🔴 CRITICAL (Fix Immediately)
1. **Add input validation with Zod** to all endpoints
   - Create DTOs for all CreateX/UpdateX operations
   - Auto-validate in request handlers

2. **Fix auth middleware** - Apply to logout and admin endpoints
   - Add role-based authorization checks
   - Create `@authorization('super_admin')` decorator pattern

3. **Fix race conditions** in draft picks and league joins
   - Wrap critical sections in transactions
   - Add optimistic locking if needed

4. **Add comprehensive business logic validation**
   - User already in league?
   - Driver from correct season?
   - Draft window actually open?

### 🟡 HIGH (Fix This Sprint)
5. **Standardize controller patterns** - Choose class-based OR function-based
6. **Add missing error codes** for domain-specific errors
7. **Complete transaction coverage** in critical paths
8. **Add pagination** to all list endpoints
9. **Implement audit logging** for all mutations
10. **Add correlation IDs** for request tracing

### 🟢 MEDIUM (Next Sprint)
11. Create comprehensive API documentation
12. Add request/response validation tests
13. Add concurrent operation tests
14. Implement graceful degradation for external APIs
15. Add metrics and alerting

---

## 14. Code Examples: Before & After

### Example 1: League Creation

**BEFORE (Current) ❌**
```typescript
// leaguesController.ts
async createLeague(request, reply) {
  try {
    const user = getAuthenticatedUser(request);
    const body = request.body as CreateLeagueInput; // No validation!
    const league = await this.leaguesService.createLeague(user.id, body);
    sendSuccess(reply, league, 201);
  } catch (error) {
    sendError(reply, error); // Generic error
  }
}

// leaguesService.ts
async createLeague(userId, input) {
  if (input.name.length < 3 || input.name.length > 80) {
    throw new Error('Invalid name'); // No error code
  }
  // ... manual validation scattered
}
```

**AFTER (Fixed) ✅**
```typescript
// leagues.dto.ts
export const createLeagueSchema = z.object({
  name: z.string().min(3).max(80),
  seasonId: z.string().cuid(),
  scoringType: z.enum(['fia_official', 'linear_20', 'proprietary']).optional(),
  maxPlayers: z.number().int().min(2).max(11).optional(),
  // ... all fields with constraints
});
export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;

// leaguesController.ts
async createLeague(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = getAuthenticatedUser(request);
    const input = createLeagueSchema.parse(request.body); // Validated
    const league = await this.leaguesService.createLeague(user.id, input);
    sendSuccess(reply, league, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(reply, ApiError.validationError(error.errors));
    } else {
      sendError(reply, error);
    }
  }
}

// leaguesService.ts
async createLeague(userId: string, input: CreateLeagueInput) {
  // No re-validation needed - input is guaranteed valid
  
  // Just business logic
  const season = await this.prisma.season.findUniqueOrThrow({
    where: { id: input.seasonId },
  }).catch(() => {
    throw ApiError.notFound('Season');
  });
  
  const existingLeague = await this.prisma.league.findUnique({
    where: { seasonId_name: { seasonId: input.seasonId, name: input.name } },
  });
  
  if (existingLeague) {
    throw ApiError.conflict('League name already exists for this season');
  }
  
  // Create with transaction to ensure atomicity
  return await this.prisma.$transaction(async (tx) => {
    const league = await tx.league.create({ data: { ... } });
    const member = await tx.leagueMember.create({
      data: { leagueId: league.id, userId, teamName: defaultTeamName },
    });
    return transformLeagueResponse(league, 1, true);
  });
}
```

### Example 2: Draft Pick Submission

**BEFORE (Current) ❌**
```typescript
async submitPick(request, reply) {
  try {
    const user = getAuthenticatedUser(request);
    const { draftId } = request.params;
    const { driverId } = request.body;
    
    // No validation of driverId format
    // No check if user owns the draft pick slot
    
    const pick = await this.draftsService.submitPick(draftId, driverId);
    sendSuccess(reply, pick);
  } catch (error) {
    sendError(reply, error);
  }
}
```

**AFTER (Fixed) ✅**
```typescript
// drafts.dto.ts
export const submitPickSchema = z.object({
  draftWindowId: z.string().cuid(),
  leagueMemberId: z.string().cuid(),
  driverId: z.string().cuid(),
});
export type SubmitPickInput = z.infer<typeof submitPickSchema>;

async submitPick(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = getAuthenticatedUser(request);
    const input = submitPickSchema.parse({
      ...request.body,
      draftWindowId: request.params.draftId,
    });
    
    // Verify user owns this league member record
    const leagueMember = await this.prisma.leagueMember.findUnique({
      where: { id: input.leagueMemberId },
    });
    
    if (leagueMember?.userId !== user.id) {
      throw ApiError.forbidden('You cannot submit picks for this league');
    }
    
    const pick = await this.draftsService.submitPick(input);
    sendSuccess(reply, pick);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(reply, ApiError.validationError(error.errors));
    } else {
      sendError(reply, error);
    }
  }
}

// drafts.service.ts
async submitPick(input: SubmitPickInput) {
  // Use transaction to prevent race condition
  return await this.prisma.$transaction(async (tx) => {
    // Fetch with lock
    const [draftWindow, existingPick, driver] = await Promise.all([
      tx.draftWindow.findUniqueOrThrow({
        where: { id: input.draftWindowId },
      }),
      tx.draftPick.findFirst({
        where: {
          draftWindowId: input.draftWindowId,
          driverId: input.driverId,
        },
      }),
      tx.driver.findUniqueOrThrow({
        where: { id: input.driverId },
      }),
    ]);
    
    // Validate state
    if (draftWindow.status !== 'open') {
      throw ApiError.badRequest('Draft window is not open', {
        status: draftWindow.status,
      });
    }
    
    if (existingPick) {
      throw ApiError.conflict('Driver already picked in this round', {
        pickedBy: existingPick.leagueMemberId,
      });
    }
    
    // Check if league member's turn
    const currentTurn = await this.getCurrentTurn(input.draftWindowId);
    if (currentTurn.leagueMemberId !== input.leagueMemberId) {
      throw ApiError.badRequest('Not your turn');
    }
    
    // Create pick
    const pick = await tx.draftPick.create({
      data: {
        draftWindowId: input.draftWindowId,
        leagueMemberId: input.leagueMemberId,
        driverId: input.driverId,
        round: currentTurn.round,
        pickOrder: currentTurn.pickOrder,
        submittedAt: new Date(),
      },
    });
    
    return pick;
  });
}
```

---

## Summary Table: Health Indicators

| Category | Status | Score | Notes |
|----------|--------|-------|-------|
| **Architecture** | ✅ Good | 8/10 | Clear layering, consistent patterns |
| **Response Format** | ✅ Good | 9/10 | Standardized structure, minor gaps |
| **Error Handling** | 🟡 Fair | 6/10 | Some inconsistencies, missing codes |
| **Input Validation** | 🔴 Poor | 3/10 | Only auth module has Zod schemas |
| **Authentication** | 🟡 Fair | 6/10 | Good tokens, missing auth checks |
| **Authorization** | 🔴 Poor | 2/10 | Minimal role/permission checks |
| **Data Integrity** | 🟡 Fair | 6/10 | Uses transactions, missing in some paths |
| **Type Safety** | 🟡 Fair | 5/10 | TS everywhere, but interfaces not validated |
| **Concurrency** | 🔴 Poor | 3/10 | Race conditions in draft/league ops |
| **Consistency** | 🟡 Fair | 5/10 | Patterns vary across modules |

---

## Action Items Checklist

### Week 1 (Critical)
- [ ] Add Zod validation DTOs to all endpoints
- [ ] Apply auth middleware to all protected routes
- [ ] Fix draft picks race condition with transaction
- [ ] Fix league joins with member count check

### Week 2-3 (High Priority)
- [ ] Standardize controller patterns across modules
- [ ] Add authorization checks to admin endpoints
- [ ] Implement audit logging for mutations
- [ ] Add missing error codes and centralize error factory

### Week 4+ (Medium Priority)
- [ ] Add comprehensive API documentation
- [ ] Add integration tests for concurrent operations
- [ ] Implement request correlation IDs
- [ ] Add metrics/monitoring

---

**Generated:** March 2, 2026  
**Reviewed By:** API Audit Tool  
**Next Review:** After fixes applied
