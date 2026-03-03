# Product Requirements Document: Team/Constructor Support

## Overview

Add full Team (Constructor) support to the PitLane application, enabling proper tracking of driver-team associations throughout the F1 season. This includes fixing hardcoded year issues by determining the active season based on the current date.

---

## Problem Statement

1. **No Team Data**: The current system lacks Team/Constructor data models, making it impossible to:
   - Display which team a driver belongs to
   - Show team affiliations in race results
   - Group drivers by team on the drivers page

2. **Hardcoded Year Bug**: The race detail page (`apps/web/src/app/(dashboard)/races/[seasonId]/[round]/page.tsx`) has a hardcoded year (2024), causing incorrect data fetching.

3. **Season Resolution**: The system should determine the active season based on the current date, not from stored season IDs.

---

## Goals

1. Add Team/Constructor data model with full driver associations
2. Sync constructor data from Jolpica API during race result imports
3. Display team information throughout the frontend
4. Fix hardcoded year issues across the application
5. Implement date-based active season resolution

---

## Technical Design

### 1. Database Schema Changes

#### New Models

```prisma
model Constructor {
  id            String   @id @default(cuid())
  constructorId String   // jolpica ID (e.g., "red_bull", "ferrari")
  name          String   // Display name (e.g., "Red Bull Racing")
  nationality   String
  seasonId      String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  season        Season   @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  driverTeams   DriverConstructor[]
  raceResults   RaceResult[]

  @@unique([seasonId, constructorId])
  @@index([seasonId])
}

model DriverConstructor {
  id             String    @id @default(cuid())
  driverId       String
  constructorId  String
  seasonId       String
  startDate      DateTime  @default(now())
  endDate        DateTime? // null if current
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  driver         Driver     @relation(fields: [driverId], references: [id], onDelete: Cascade)
  constructor    Constructor @relation(fields: [constructorId], references: [id], onDelete: Cascade)
  season         Season     @relation(fields: [seasonId], references: [id], onDelete: Cascade)

  @@unique([driverId, seasonId, startDate])
  @@index([driverId])
  @@index([constructorId])
  @@index([seasonId])
}
```

#### Updated Models

```prisma
model Season {
  id           String   @id @default(cuid())
  year         Int      @unique
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  races        Race[]
  drivers      Driver[]
  constructors Constructor[]
  driverTeams  DriverConstructor[]
  leagues      League[]
}

model Driver {
  id              String   @id @default(cuid())
  driverId        String
  permanentNumber Int?
  code            String
  givenName       String
  familyName      String
  nationality     String
  dateOfBirth     DateTime
  seasonId        String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  season          Season   @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  results         RaceResult[]
  draftPicks      DraftPick[]
  driverTeams     DriverConstructor[]

  @@unique([seasonId, driverId])
  @@index([seasonId])
}

model RaceResult {
  id              String   @id @default(cuid())
  raceId          String
  driverId        String
  constructorId   String   // NEW: Team at time of race
  position        Int
  points          Float
  status          String
  time            String?
  fastestLap      Boolean  @default(false)
  jolpicaValue    Json?
  adminValue      Json?
  adminProtected  Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  race            Race        @relation(fields: [raceId], references: [id], onDelete: Cascade)
  driver          Driver      @relation(fields: [driverId], references: [id], onDelete: Cascade)
  constructor     Constructor @relation(fields: [constructorId], references: [id], onDelete: Cascade)
  discrepancies   DataDiscrepancy[]

  @@unique([raceId, driverId])
  @@index([raceId])
  @@index([driverId])
  @@index([constructorId])
}
```

### 2. Backend Changes

#### A. Jolpica Client Updates (`jolpica-client.ts`)

- Add `JolpicaConstructor` interface
- Add `syncConstructors(seasonYear)` method
- Update `syncRaceResults()` to capture constructor data from race results
- Create/update `DriverConstructor` associations when syncing results

#### B. F1 Data Service Updates (`f1data.service.ts`)

- Add `getConstructorsBySeason(year)` method
- Add `getActiveSeasonYear()` - determine season based on current date:
  ```typescript
  getActiveSeasonYear(): number {
    const now = new Date();
    // F1 season typically runs March-December
    // If we're in Jan-Feb, we're still in the previous year's season
    if (now.getMonth() < 2) {
      return now.getFullYear() - 1;
    }
    return now.getFullYear();
  }
  ```
- Add `getDriverCurrentConstructor(driverId)` method
- Add `getDriversWithConstructors(year)` method

#### C. API Endpoints (`f1data.routes.ts`)

New endpoints:
- `GET /seasons/:year/constructors` - List all constructors for a season
- `GET /seasons/:year/drivers-with-teams` - List drivers with their current team

Updated endpoints:
- `GET /seasons/:year/races/:round/results` - Include constructor in response

### 3. Frontend Changes

#### A. API Client Updates (`apps/web/src/lib/api.ts`)

New types:
```typescript
export interface Constructor {
  id: string;
  constructorId: string;
  name: string;
  nationality: string;
  seasonId: string;
}

export interface DriverWithConstructor {
  id: string;
  driverId: string;
  permanentNumber: number | null;
  code: string;
  givenName: string;
  familyName: string;
  nationality: string;
  currentConstructor: {
    id: string;
    name: string;
    constructorId: string;
  } | null;
}

export interface RaceResultPublic {
  // ... existing fields
  constructor: {
    id: string;
    name: string;
    constructorId: string;
  };
}
```

New API functions:
- `getConstructorsBySeason(year)`
- `getDriversWithConstructors(year)`

#### B. Drivers Page (`apps/web/src/app/(dashboard)/drivers/page.tsx`)

- Group drivers by team
- Display team colors/badges
- Show team name under each driver

#### C. Race Detail Page (`apps/web/src/app/(dashboard)/races/[seasonId]/[round]/page.tsx`)

- Fix: Derive year from current date, not from URL param or hardcoded value
- Show constructor name in race results
- Display team colors/badges

#### D. Race Results Component

- Add constructor column/display
- Show team affiliation for each result

---

## Implementation Phases

### Phase 1: Database Schema (Backend)
1. Update Prisma schema with new models
2. Generate and run migration
3. Update seed scripts if needed

### Phase 2: Data Sync (Backend)
1. Update Jolpica client to sync constructors
2. Update race result sync to capture constructor data
3. Add driver-constructor association logic

### Phase 3: API Layer (Backend)
1. Add constructor endpoints
2. Update existing endpoints to include constructor data
3. Add helper methods for season resolution

### Phase 4: Frontend Updates
1. Update API client types
2. Fix hardcoded year issues
3. Update Drivers page with team grouping
4. Update Race Results display

### Phase 5: Testing & Cleanup
1. Test data sync with real Jolpica data
2. Verify frontend displays correctly
3. Update any remaining hardcoded references

---

## Edge Cases

1. **Driver Mid-Season Transfers**: Support via `DriverConstructor` with `startDate`/`endDate`
2. **Reserve Drivers**: Handle drivers who only participate in specific races
3. **Historical Data**: Constructor data from past seasons should remain immutable
4. **Missing Constructor Data**: Fallback gracefully if Jolpica doesn't have constructor info

---

## Success Criteria

1. ✅ Drivers page shows drivers grouped by team
2. ✅ Race results display constructor/team for each driver
3. ✅ No hardcoded years in the codebase
4. ✅ Active season correctly determined from current date
5. ✅ Data syncs correctly from Jolpica API
6. ✅ Historical seasons remain viewable

---

## Files to Modify

### Backend
- `apps/api/prisma/schema.prisma` - Add Constructor and DriverConstructor models
- `apps/api/src/modules/f1data/jolpica-client.ts` - Add constructor sync
- `apps/api/src/modules/f1data/f1data.service.ts` - Add constructor methods
- `apps/api/src/modules/f1data/f1data.controller.ts` - Add constructor endpoints
- `apps/api/src/modules/f1data/f1data.routes.ts` - Add routes

### Frontend
- `apps/web/src/lib/api.ts` - Add constructor types and API functions
- `apps/web/src/app/(dashboard)/drivers/page.tsx` - Group by team
- `apps/web/src/app/(dashboard)/races/[seasonId]/[round]/page.tsx` - Fix year, add constructor
- `apps/web/src/app/(dashboard)/leagues/[id]/drivers/page.tsx` - Add team display

---

## Timeline Estimate

- Phase 1: 1-2 hours (Database)
- Phase 2: 2-3 hours (Data Sync)
- Phase 3: 1-2 hours (API Layer)
- Phase 4: 2-3 hours (Frontend)
- Phase 5: 1 hour (Testing)

**Total: 7-11 hours**

---

## Dependencies

- Jolpica API availability
- Prisma migration capability
- No breaking changes to existing draft/scoring logic