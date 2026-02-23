# PitLane — Product Requirements Document (PRD)

# 1. Document Control

## 1.2 Document Metadata

| Field | Value |
|---|---|
| Product / App Name | PitLane |
| PRD Title | PitLane v1.0 MVP Product Requirements Document |
| Document ID | PRD-PITLANE-MVP-001 |
| PRD Version | 0.9.0 |
| Status | Draft |
| Author(s) | TBD — Product Owner |
| Owner (DRI) | TBD |
| Technical Lead | TBD |
| Design Lead | TBD |
| Reviewers | Product, Engineering, Design, Security |
| Approver(s) | Engineering Lead + Product Owner |
| Target Release | TBD |
| Last Updated | 2026-02-22 |
| Source of Truth | TBD — Git repo `/docs/PRD.md` |
| Related Repos | TBD — frontend, backend, infra |
| Environments | local / dev / staging / prod |

## 1.3 Revision History

| Version | Date | Author | Change Summary | Sections Touched | Approved By |
|---|---|---|---|---|---|
| 0.9.0 | 2026-02-22 | TBD | Initial MVP PRD draft | All | N/A |

## 1.4 Approvals & Sign-Off

| Role | Name | Sign-Off Date | Conditions / Notes |
|---|---|---|---|
| Product Owner | TBD | TBD | |
| Engineering Lead | TBD | TBD | |
| Design Lead | TBD | TBD | |
| Security Lead | TBD | TBD | |

## 1.6 Decision Log

| Decision ID | Date | Decision | Options Considered | Rationale | Owner | Revisit Criteria |
|---|---|---|---|---|---|---|
| DEC-001 | 2026-02-22 | F1 only — no multi-sport scope | Multi-sport, F1 only | Deep F1 domain knowledge, focused UX, Jolpica API specialization | Product Owner | Never — anti-scope creep |
| DEC-002 | 2026-02-22 | Jolpica as sole golden source for F1 data | Jolpica, Ergast (deprecated), web scraping | Jolpica is the maintained successor to Ergast, F1-official adjacent | Engineering Lead | If Jolpica goes offline/deprecated |
| DEC-003 | 2026-02-22 | Per-race drafts (not season-long rosters) | Season-long, per-race, weekly | F1's 22-driver field makes per-race draft uniquely viable; adds weekly engagement | Product Owner | Post-MVP user feedback |
| DEC-004 | 2026-02-22 | Proprietary scoring as default (10th = 10 pts) | FIA official, linear 20-pt, proprietary | Rewards consistency over peak performance; differentiates product | Product Owner | Post-MVP user feedback |
| DEC-005 | 2026-02-22 | SMTP (send-only) for email | SendGrid, SES, SMTP | Simplest MVP path; no vendor lock-in; can migrate to transactional service later | Engineering Lead | > 10,000 emails/month → evaluate dedicated service |
| DEC-006 | 2026-02-22 | HTML5 Web Push + email for notifications | Push only, email only, SMS, hybrid | Hybrid covers both in-app and offline users without native app dependency | Engineering Lead | Native apps in v2 |
| DEC-007 | 2026-02-22 | Email change hold period is admin-configurable | Fixed 24h, user-configurable, admin-configurable | Admin needs control for compliance; default 24h | Engineering Lead | — |
| DEC-008 | 2026-02-22 | PostgreSQL + Redis + Next.js/Fastify stack | See §9.3 | ACID compliance, team familiarity, proven at scale | Engineering Lead | > 50K DAU → evaluate read replicas |

---

# 2. Executive Summary & Product Vision

## 2.2 Vision Statement

> "PitLane is the Formula 1 fantasy sports platform that enables passionate F1 fans to compete weekly in skill-based constructor drafts by selecting two drivers each race, unlike generic multi-sport fantasy apps which dilute the F1 experience with one-size-fits-all mechanics. Our north star is achieving 10,000 monthly active league members in the first full F1 season after launch."

## 2.3 Product Elevator Pitch

PitLane is a fantasy Formula 1 app where up to 11 players per league draft two drivers before each Grand Prix, score points based on race results, and compete for weekly wins and a season podium. It's the only fantasy platform built exclusively and deeply for F1, with automatic Jolpica-powered race data and unique per-race constructor drafts.

## 2.4 Problem Statement

### 2.4.1 Current State

| Problem ID | Problem | Severity (1–5) | Who Is Impacted | Current Workaround |
|---|---|---|---|---|
| PROB-001 | No purpose-built F1 fantasy product with per-race drafting exists | 5 | F1 fans | Use ESPN/generic fantasy (season-long, wrong sport focus) |
| PROB-002 | Existing F1 fantasy apps (F1 official) lock users into season-long rosters with no weekly strategy | 4 | F1 fans wanting weekly engagement | Accept the limitation |
| PROB-003 | Private friend leagues with F1 scoring require manual spreadsheets | 5 | Casual fan groups | Google Sheets maintained by one person |
| PROB-004 | Race data availability is fragmented; no reliable free live results API | 3 | Developers/apps | Scraping, paid APIs |

### 2.4.3 Desired Future State

PitLane becomes the go-to platform for friend groups and F1 fan communities to run private and public fantasy leagues with minimal administrative overhead. Each Monday before a race, players receive a push/email notification prompting their driver draft. By qualifying, rosters are locked. After the race, results automatically import from Jolpica within 2 hours of availability and scores update instantly. Commissioners have full control without needing admin intervention except for genuine edge cases.

## 2.5 Proposed Solution

PitLane automates the full lifecycle of an F1 fantasy season: season data is imported from Jolpica automatically at the start of each F1 season, leagues are created by commissioners who invite players, and each race triggers an automated draft window. Players draft two drivers per race forming their "constructor team." Points calculate automatically using one of three configurable scoring systems. Weekly winners and season podium standings are visible to all league members.

Admin intervention is scoped only to data quality issues — if Jolpica data is missing or incorrect, admins can override manually with full audit trails. All overrides are surfaced transparently to commissioners and optionally to all league members.

## 2.7 Product Principles

| # | Principle | What It Requires | What It Forbids |
|---|---|---|---|
| 1 | F1-Only Forever | All features designed around F1 domain model | Adding any non-F1 sport in any version |
| 2 | Jolpica is the golden source | All race/driver/result data flows from Jolpica → DB | Direct user input of race results without admin override workflow |
| 3 | Commissioner controls their league | Commissioners set all league-level rules; admins cannot override league-level decisions | Admins meddling in specific league settings or scores |
| 4 | Transparency by default | All data overrides are visible; notification trail is full and permanent | Silent data changes; dismissed notifications disappearing from history |
| 5 | Mobile-first | All screens designed at 375px breakpoint first | Desktop-only features or UI patterns that break below 768px |

## 2.8 Scope

### 2.8.1 In Scope (MVP)

| Item | Description | Section Reference |
|---|---|---|
| User auth & profiles | Email registration, verification, username, default team name | §6.1 |
| Season & race data sync | Jolpica integration, automatic import, admin override | §6.2, §15 |
| League management | Create, join, invite, public/private, commissioner CRUD | §6.3 |
| Per-race draft system | Snake/regular draft, 24h timers, auto-draft, rotation | §6.4 |
| Scoring engine | FIA official, linear 20-pt, proprietary 10th=10pt | §6.5 |
| Results & standings | Weekly winners, season podium, live draft board | §6.6 |
| Notification system | HTML5 push + email (SMTP), notification history | §6.7 |
| Admin panel | Data override, Jolpica sync management, user management | §6.8 |
| DNF/DNS/DGE tracking | Special stat tracking for double goose eggs | §6.5 |

### 2.8.2 Out of Scope (Not Building in MVP)

| Item | Reason | Revisit Criteria | Target Version |
|---|---|---|---|
| Native iOS / Android apps | Web-first MVP strategy; HTML5 push covers notifications | > 10K MAU on mobile web | v2.0 |
| Multiple sports | Anti-scope creep; F1-only is the brand | Never | Never |
| Payments / subscriptions | Free product for MVP | > 50K MAU or cost pressure | v2.0 |
| Live race telemetry / live scoring mid-race | Race results not available until after race; complexity high | Post-MVP | v2.0 |
| Social features (chat, comments) | Out of scope for competition-focused MVP | User demand confirmed post-launch | v2.0 |
| MFA / social login | SMTP email auth is sufficient for MVP | Security audit post-launch | v1.5 |
| Trade / transfer between leagues | Not applicable to per-race draft model | — | — |
| Commissioner delegation / co-commissioner | Single commissioner per league in MVP | User request post-launch | v1.5 |

## 2.10 Product Roadmap Context

| Phase | Timeline | Key Milestones | Entry Criteria | Dependencies |
|---|---|---|---|---|
| MVP | Q2 2026 | Core auth, leagues, drafts, scoring, Jolpica sync, admin panel | PRD approved, infra set up | Jolpica API access confirmed |
| Growth | Q3 2026 | Public league discovery, push notification improvements, stats dashboard | MVP live, > 500 MAU | MVP KPIs met |
| Scale | Q4 2026 | Native apps, social features, live scoring | > 5K MAU | Growth phase complete |

## 2.11 Constraints & Non-Negotiables

| Constraint | Value | Rationale |
|---|---|---|
| Data source | Jolpica API only for F1 data | Single source of truth; avoids licensing issues |
| Email | SMTP (send-only) | MVP cost constraint |
| League size | 2–11 players (constraint of 22 F1 drivers ÷ 2 per constructor) | Hard domain constraint |
| Scoring default | Proprietary (10th = 10 pts) | Product differentiator |
| Season lifecycle | Follows Jolpica F1 season calendar exactly | No manual season overrides except via admin |

---

# 3. Business Objectives, Goals & Success Metrics (KPIs)

## 3.2 Business Objectives

| Objective ID | Objective | Why It Matters | Time Horizon | Owner |
|---|---|---|---|---|
| OBJ-001 | Launch MVP before 2026 F1 season midpoint | Capture remainder of 2026 season engagement | MVP launch | Product Owner |
| OBJ-002 | Achieve 500 active league members by end of 2026 season | Prove product-market fit with organic growth | End of 2026 F1 season | Product Owner |
| OBJ-003 | Achieve < 1% critical bug rate in race scoring | Trust in score accuracy is the core product promise | Ongoing | Engineering Lead |

## 3.4 KPI Catalog

| KPI ID | Name | Formula | Baseline | Target (Launch) | Target (6mo) | Data Source |
|---|---|---|---|---|---|---|
| KPI-001 | League Activation Rate | Leagues with ≥ 1 completed race draft / leagues created | 0% | 70% | 80% | DB: `leagues`, `draft_picks` |
| KPI-002 | Draft Participation Rate | Players submitting draft picks on time / total draft slots | 0% | 60% | 75% | DB: `draft_picks` |
| KPI-003 | Weekly Active Users | Unique users with ≥ 1 login or action in 7-day window | 0 | 200 | 1,000 | DB: `user_sessions` |
| KPI-004 | Score Accuracy Rate | Race results where final score matches verified Jolpica data | N/A | 99.5% | 99.9% | DB: `race_results`, `admin_overrides` |
| KPI-005 | Draft Auto-Expiry Rate | Draft picks resolved by 24h timeout / total picks | 0% | < 20% | < 10% | DB: `draft_picks.resolution_method` |

## 3.5 Instrumentation — Event Dictionary

| Event Name | Trigger | Key Properties |
|---|---|---|
| `auth.user.registered` | POST /auth/register 201 | `method: 'email'` |
| `auth.user.verified` | GET /auth/verify-email success | `user_id` |
| `league.created` | POST /leagues 201 | `league_id`, `visibility`, `draft_type`, `scoring_type` |
| `league.joined` | POST /leagues/:id/join 200 | `league_id`, `user_id`, `method: 'invite'|'public'` |
| `draft.pick.submitted` | POST /drafts/:id/picks 201 | `draft_id`, `round`, `driver_id`, `method: 'manual'|'auto'` |
| `draft.pick.expired` | Job: draft pick timeout | `draft_id`, `pick_id`, `resolution: 'random'|'top_points'|'no_pick'` |
| `race.results.imported` | Job: Jolpica sync success | `race_id`, `season_year`, `source: 'jolpica'|'admin_override'` |
| `notification.sent` | Any notification dispatch | `type`, `channel: 'push'|'email'`, `user_id` |

## 3.6 Guardrail Metrics

| Guardrail | Threshold | Alert Owner | Action |
|---|---|---|---|
| API Error Rate (5xx) | > 1% over 5 min | Engineering Lead | Page on-call |
| Jolpica Sync Failure | > 3 consecutive failed checks | Admin team | Auto-notify admins, trigger manual workflow |
| Draft Timer Miss | Scheduled timer fires > 5min late | Engineering Lead | Investigate job queue health |
| Score Calculation Error | Any discrepancy flagged by double-check | Engineering Lead | Hold score publication, notify admin |

---

# 4. Target Audience & User Personas

## 4.2 Target Market Segmentation

| Segment | Description | Key Needs |
|---|---|---|
| F1 Fan Friend Groups | 4–8 friends who watch F1 together; want a shared competition | Easy setup, fair drafts, automatic scoring |
| F1 Community Organizers | Discord/Reddit mods, fan club leaders running large public leagues | Public league tools, commissioner controls, visibility |
| Casual Viewers | Watch some races; want low-commitment weekly engagement | Simple draft UI, auto-draft, push reminders |

## 4.3 Persona 1: "The Commissioner" — League Commissioner

| Attribute | Detail |
|---|---|
| Name | Marco, 34, F1 superfan |
| Technical Proficiency | 3/5 |
| Primary Goal | Run a tight, fair fantasy league for his friend group |
| Pain Points | Manually updating spreadsheets after each race; chasing friends for picks; resolving scoring disputes |
| RBAC Role | `commissioner` |
| Primary Flows | FLOW-003 (Create League), FLOW-004 (Manage League), FLOW-007 (Resolve draft edge cases) |

**JTBD:** "When race weekend approaches, I want to know everyone has submitted their picks and scores will update automatically, so I can focus on watching the race."

## 4.4 Persona 2: "The Active Drafter" — League Member (Engaged)

| Attribute | Detail |
|---|---|
| Name | Priya, 28, casual F1 fan |
| Technical Proficiency | 4/5 |
| Primary Goal | Win her work league's season podium |
| Pain Points | Missing draft windows; not knowing driver standings; forgetting to set auto-draft |
| RBAC Role | `member` |
| Primary Flows | FLOW-005 (Join League), FLOW-006 (Submit Draft Pick), FLOW-008 (View Standings) |

**JTBD:** "When it's my turn to draft, I want a clear notification and a ranked list of available drivers, so I can make a strategic pick quickly."

## 4.5 Persona 3: "The Admin" — Platform Administrator

| Attribute | Detail |
|---|---|
| Name | Dev team member |
| Technical Proficiency | 5/5 |
| Primary Goal | Ensure data integrity and system health with minimal manual intervention |
| Pain Points | Jolpica data delays after race; driver substitutions mid-season; commissioner escalations |
| RBAC Role | `super_admin` |
| Primary Flows | FLOW-010 (Manual result entry), FLOW-011 (Override Jolpica data), FLOW-012 (Manage sync schedule) |

## 4.6 Anti-Persona

| Attribute | Detail |
|---|---|
| Name | Sports betting operator |
| Why Excluded | PitLane has no real-money wagering. No odds, no cash prizes in MVP. |
| When to Reconsider | Never in current legal/regulatory scope |

## 4.7 User Role Matrix

| Role | Description | Permissions Level | Creation Method |
|---|---|---|---|
| `super_admin` | Platform-wide admin | Full platform access | System-seeded |
| `commissioner` | League creator/manager | Full control of own league(s) | Becomes commissioner on league creation |
| `member` | Standard league participant | View/draft within own leagues | Invited or joined publicly |

---

# 5. User Journeys & Core Flows

## 5.1 Core Flow Index

| Flow ID | Name | Actor | Trigger | Outcome |
|---|---|---|---|---|
| FLOW-001 | User Registration | New user | Landing page CTA | Verified account created |
| FLOW-002 | User Login | Registered user | Login page | Authenticated session |
| FLOW-003 | Create League | Commissioner | Dashboard "Create League" button | League created, shareable |
| FLOW-004 | Invite Members | Commissioner | League settings | Invite links sent |
| FLOW-005 | Join League | Member | Invite link or public search | Member added to league |
| FLOW-006 | Draft Pick Submission | Member | Draft window open + member's turn | Pick recorded |
| FLOW-007 | Auto-Draft Execution | System (job) | Draft window expires or preference set | Pick auto-assigned |
| FLOW-008 | View Live Draft Board | Member | During draft window | Real-time board visible |
| FLOW-009 | Race Result Import | System (job) | 3 hrs after race start, every 2 hrs | Scores calculated |
| FLOW-010 | Admin Data Override | Admin | Admin panel | Override stored, audit trail created, commissioners notified |
| FLOW-011 | Email Change | User | Profile settings | Email changed after hold period |
| FLOW-012 | Notification Delivery | System | Various triggers | Notification sent via push + email |

## 5.2 Flow: FLOW-001 — User Registration

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant SMTP as SMTP Server

    U->>FE: Navigate to /signup
    U->>FE: Fill: email, password, username (optional)
    FE->>FE: Client-side validation
    FE->>API: POST /api/v1/auth/register
    API->>DB: Check email uniqueness
    alt Email taken
        API-->>FE: 409 CONFLICT — "An account with this email already exists."
        FE-->>U: Inline error on email field
    else Email available
        API->>DB: INSERT user (status=pending_verification)
        API->>DB: INSERT verification_token
        API->>SMTP: Send verification email
        API-->>FE: 201 — "Check your email to verify your address."
        FE-->>U: Show /verify-email-sent page
    end

    U->>FE: Click verify link in email
    FE->>API: GET /api/v1/auth/verify-email?token={token}
    API->>DB: Mark user verified, expire token
    API-->>FE: 200 — redirect to /login with toast "Email verified. Please sign in."
```

## 5.3 Flow: FLOW-006 — Draft Pick Submission

```mermaid
sequenceDiagram
    actor M as Member
    participant FE as Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant WS as WebSocket
    participant PUSH as Push/Email

    Note over M,PUSH: Draft window is open; it is Member's turn
    PUSH->>M: Notification: "It's your turn to draft for [Race Name]"
    M->>FE: Navigate to /leagues/{id}/draft
    FE->>API: GET /api/v1/leagues/{id}/drafts/current
    API-->>FE: Draft state: available drivers, pick order, timer
    FE-->>M: Display draft board with available drivers sorted by preference/stats

    M->>FE: Select driver
    FE->>API: POST /api/v1/drafts/{id}/picks {driver_id, round}
    API->>DB: Validate: driver available, player's turn, window open
    API->>DB: INSERT draft_pick
    API->>WS: Broadcast draft state update to all league members
    API-->>FE: 201 — pick confirmed
    WS-->>FE: All other members see board update in real-time
    FE-->>M: Board updates; advance to next player's turn or Round 2
```

## 5.4 Flow: FLOW-009 — Race Result Import

```mermaid
flowchart TD
    A[Race scheduled_start passes] --> B[Wait 3 hours]
    B --> C[Job: Poll Jolpica for race results]
    C --> D{Results available?}
    D -- No --> E[Increment check_count]
    E --> F{check_count >= 18?}
    F -- No --> G[Wait 2 hours]
    G --> C
    F -- Yes --> H[Notify all admins: Manual intervention required]
    H --> I[Admin enters results manually in admin panel]
    I --> J[admin_override = true, jolpica_protection = true]
    D -- Yes --> K[Import results to race_results table]
    K --> L{Any admin_override fields exist for this race?}
    L -- Yes --> M[Mark discrepancies; do NOT overwrite protected fields]
    M --> N[Notify commissioners of data discrepancies]
    L -- No --> O[Calculate scores for all league members]
    N --> O
    O --> P[Publish weekly results and standings]
    P --> Q[Send results notifications to all league members]
```

---

# 6. Feature Specifications

## 6.1 Epic: EPIC-001 — User Authentication & Profiles

### FEAT-001: User Registration

**Description:** Email-based account creation with mandatory verification.

**Acceptance Criteria:**
```gherkin
Feature: User Registration

  Scenario: Successful registration
    Given I am on the "/signup" page
    When I enter a valid unique email, a valid password, and agree to terms
    And I click "Create Account"
    Then a new user record is created with status "pending_verification"
    And a verification email is sent to the provided address
    And I am redirected to "/verify-email-sent" with message: "Please check your email to verify your account."

  Scenario: Duplicate email
    Given a user already exists with email "test@example.com"
    When I attempt to register with email "test@example.com"
    Then I see inline error: "An account with this email already exists."
    And no new user record is created

  Scenario: Invalid password
    Given I am on the "/signup" page
    When I enter a password shorter than 8 characters
    Then the "Create Account" button is disabled
    And I see: "Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character."

  Scenario: Unverified user attempts login
    Given I registered but have not verified my email
    When I attempt to log in
    Then I see: "Please verify your email before logging in. Resend verification email."
    And I can click "Resend verification email" to trigger a new verification email

  Scenario: Email verification link expired
    Given my verification token is older than 24 hours
    When I click the verification link
    Then I see: "This verification link has expired. Request a new one."
    And I am shown a "Resend verification email" button
```

**Business Rules:**
- Email must be unique globally (case-insensitive). Emails are stored lowercase.
- Username defaults to the portion of email before `@` (e.g., `john.doe@gmail.com` → `john.doe`). Username is editable. Usernames are NOT required to be unique globally.
- Password: minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character (`!@#$%^&*()-_=+[]{}|;:,.<>?`). Max 128 characters. Stored as bcrypt hash (cost 12).
- Verification token expires after 24 hours. One active token per user at a time. New resend invalidates old token.
- Rate limit: 5 registrations per minute per IP, 3 verification emails per hour per email address.
- No disposable email blocking in MVP (revisit in v1.5).

**UI Fields:**

| Field | Label | Type | Validation | Placeholder |
|---|---|---|---|---|
| email | "Email Address" | text/email | Required, valid email, max 254 chars | "you@example.com" |
| password | "Password" | password | See business rules above | "" |
| password_confirm | "Confirm Password" | password | Must match password | "" |
| username | "Username (optional)" | text | 3–30 chars, alphanumeric + `.` `_` `-`. Defaults to email prefix if left blank | "yourname" |
| agreed_to_terms | "I agree to the Terms of Service and Privacy Policy" | checkbox | Must be checked | — |

---

### FEAT-002: User Login

**Business Rules:**
- Login always by email address.
- After 5 consecutive failed login attempts for an account, lock account for 15 minutes. Show: "Too many failed attempts. Account locked until [TIME]. Try again or reset your password."
- JWT access token: 15 minutes TTL, stored in memory.
- JWT refresh token: 30 days TTL, stored in httpOnly cookie.
- On 401 from any authenticated endpoint: attempt refresh once → on failure: redirect to `/login`.

---

### FEAT-003: User Profile

**Editable Fields:**
- `username` (3–30 chars, alphanumeric + `.` `_` `-`)
- `display_name` (1–50 chars, any UTF-8)
- `default_team_name` (1–50 chars, any UTF-8) — pre-fills team name when joining any new league (can be overridden per league)
- `email` — see FEAT-004 for change flow
- `password` — requires current password confirmation before change; invalidates all refresh tokens on success
- `push_notifications_enabled` (boolean) — HTML5 push consent
- `email_notifications_enabled` (boolean) — email opt-in/out

---

### FEAT-004: Email Change Flow

**Business Rules:**
1. User requests email change on profile page (enters new email + current password for confirmation).
2. System validates: new email not already in use, password is correct.
3. System sends two notifications simultaneously:
   a. **Current email:** "A request was made to change your email address to [NEW_EMAIL]. If you did not request this, click here to cancel. This change will take effect in [HOLD_PERIOD] unless cancelled." Contains: [Cancel Change] button and [Waive Hold & Change Now] button.
   b. **New email:** "Please verify your new email address for PitLane." Contains: [Verify New Email] button.
4. The `email_change_hold_seconds` system setting (set by admin, default: 86400 seconds / 24 hours) controls the hold period.
5. Change becomes permanent ONLY when BOTH conditions are met: (a) new email verified AND (b) hold period elapsed (unless waived).
6. The current email holder can cancel the change at any time during the hold period. Clicking cancel reverts the pending change and sends a confirmation email to the current address.
7. The current email holder can waive the hold period, causing the change to take effect immediately after new email verification.
8. If the change is not completed (new email not verified) within 72 hours, the request expires.
9. On completion: all refresh tokens are invalidated, user must re-login with new email.

---

## 6.2 Epic: EPIC-002 — F1 Season & Race Data

### FEAT-005: Jolpica Data Import

**Description:** Automated import of F1 seasons, races, circuits, drivers, and results from the Jolpica API.

**Jolpica API Base URL:** `https://api.jolpi.ca/ergast/f1/`

**Data Imported:**

| Entity | Jolpica Endpoint | Schedule | Fields Imported |
|---|---|---|---|
| Season | `/f1/{year}/races.json` | Once per season (on app startup for current year + preemptively for next year) | `season`, `round`, `raceName`, `Circuit`, `date`, `time` |
| Drivers | `/f1/{year}/drivers.json` | Once per season + after each round | `driverId`, `permanentNumber`, `code`, `givenName`, `familyName`, `nationality`, `dateOfBirth` |
| Race Results | `/f1/{year}/{round}/results.json` | Poll job starting 3 hours post-race-start | `position`, `Driver`, `Constructor`, `points`, `status`, `Time`, `FastestLap` |
| Driver Standings | `/f1/{year}/driverStandings.json` | After each race results import | Used for auto-draft fallback ordering |

**Import Business Rules:**
- All imported data is stored in the `f1_data` schema tables (see §12).
- If a field is returned by Jolpica that matches an admin-protected override, the Jolpica value is stored in `jolpica_value` column and the override is preserved in `admin_value` column. The `admin_protected` flag prevents overwrite.
- If Jolpica returns data that differs from any admin-overridden field, a `data_discrepancy` record is created and all league commissioners are notified via push + email.
- Jolpica polling for race results: start 3 hours after `races.scheduled_start_utc`, check every 2 hours, max 18 checks (36 hours total).
- After 18 failed checks: trigger `admin.jolpica.sync_failed` notification to all `super_admin` users. System enters manual data entry mode for that race.
- Successful result import triggers score calculation for all leagues with that race in their season.

**Jolpica Failure Handling:**

| Failure Type | Response | Retry Policy | Admin Action |
|---|---|---|---|
| HTTP 4xx | Log error, mark sync as failed | No retry for 4xx (except 429) | Admin manually enters data |
| HTTP 429 | Respect `Retry-After` header | Wait and retry | — |
| HTTP 5xx | Log error | Retry after 2 hours (standard schedule) | — |
| Timeout (> 30s) | Log timeout | Count as failed check; retry after 2 hours | — |
| Malformed JSON | Log parse error | Count as failed check; retry after 2 hours | Alert admin if 3 consecutive |

---

### FEAT-006: Admin Data Override

**Description:** Admin interface to manually enter or override F1 data from Jolpica.

**Business Rules:**
- Admin can override any field on: `race_results`, `driver_substitutions`, `race_schedule` (for cancellations/postponements).
- When an admin overrides a field, the record stores: `jolpica_value` (last known Jolpica value), `admin_value` (the override), `admin_protected` (boolean, admin-set — if true, Jolpica sync will not overwrite this field), `overridden_by` (admin user ID), `overridden_at` (timestamp).
- If `admin_protected = false`, future Jolpica imports WILL overwrite the field and log a discrepancy note.
- If `admin_protected = true`, future Jolpica imports will NOT overwrite; they will instead log a discrepancy and notify commissioners.
- Every admin override triggers:
  1. Immediate notification to ALL league commissioners via push + email: "Race data for [RACE NAME] has been updated by an administrator. [View changes]"
  2. Commissioners may optionally forward this notification to all their league members (one-click in-app action).
- Score recalculation is triggered automatically after any admin override affects scored results.
- All admin overrides are logged in the `audit_log` table with full before/after values.

**Admin Override UI Fields (per result record):**
- Race, Round, Season (read-only)
- Driver (read-only unless adding substitution)
- Finishing position (editable)
- Status (`Finished` / `DNF` / `DNS` / `DSQ` / custom string)
- Points (calculated from scoring, or manually entered)
- `admin_protected` toggle (label: "Protect from future Jolpica overwrites")
- Notes field (internal admin note, max 500 chars)

---

## 6.3 Epic: EPIC-003 — League Management

### FEAT-007: Create League

**Business Rules:**
- The user who creates a league becomes its `commissioner`.
- A user can be commissioner of multiple leagues simultaneously.
- A user can be a member of up to 10 leagues simultaneously (MVP limit).
- Commissioner cannot be removed from their own league (only can disband it).
- League name: 3–80 chars, unique per season (same name allowed in different seasons).

**League Settings (set at creation, editable by commissioner until first race draft opens):**

| Setting | Type | Options | Default | Description |
|---|---|---|---|---|
| `name` | string | 3–80 chars | — | League display name |
| `season_year` | integer | Current or upcoming F1 season year | Current season | Which F1 season this league covers |
| `scoring_type` | enum | `proprietary` / `linear_20` / `fia_official` | `proprietary` | Scoring system for all races |
| `draft_type` | enum | `snake` / `regular` | `snake` | Draft order pattern |
| `visibility` | enum | `public` / `private` | `private` | Whether non-members can find/join |
| `join_approval_required` | boolean | true / false | false | If true, commissioner must approve join requests |
| `target_players` | integer | 2–11 | 8 | Recommended league size (soft limit; hard max is 11) |
| `max_players` | integer | 2–11 | 11 | Hard maximum members (must be ≥ target_players) |
| `invite_links_by_members` | boolean | true / false | true | If true, any member can generate invite links |
| `missed_pick_resolution` | enum | `random` / `top_points` / `no_pick` | `top_points` | What happens when 24h pick timer expires |
| `substitution_policy` | enum | `redraft` / `auto_replace` | `auto_replace` | Policy when a drafted driver is substituted IRL after draft locks |

**Draft Order Settings:**
- Initial draft order is set by commissioner before first race: either manually (drag-and-drop) or via "Randomize Order" button.
- Draft order rotation rule: after each race, the player who held position N in the previous race moves to position N+1. The player who was last moves to position 1 (i.e., first becomes last, others shift down). This applies for both snake and regular draft types.

**League Disbanding:**
- Commissioner can disband a league at any time. All members are notified via push + email.
- Historical data is retained in read-only state.
- A disbanded league cannot be rejoined or reactivated.

---

### FEAT-008: Join League

**Business Rules:**
- **Public leagues:** Any authenticated user can join up to `max_players` limit.
- **Private leagues:** Can only be joined via invite link.
- **Invite links:** Generated by commissioner (always) or any member (if `invite_links_by_members = true`). Link format: `https://[app]/join/[8-char-random-token]`. Expires after 7 days. One-time use per user (a user cannot use the same invite multiple times, but the link is reusable by different users until expiry or max_players is hit).
- **Approval required:** If `join_approval_required = true`, joining triggers a pending membership request; commissioner gets notification; commissioner approves/denies in league settings.
- **Team name on join:** User is prompted for their team name for this league. Pre-filled from `user.default_team_name`. Must be unique within the league (case-insensitive). 1–50 chars.
- A user cannot join a league mid-season after the 3rd race has been completed (they may be added before that).
- Users can leave a league voluntarily at any time. Their historical picks/scores are retained (read-only). Their spot opens for a new member.

---

### FEAT-009: Commissioner League Management

**Commissioner-only actions:**
- Edit all league settings (before first draft of season opens; `scoring_type` and `draft_type` locked after first draft).
- Set/randomize draft order.
- Approve/deny join requests (if `join_approval_required = true`).
- Generate invite links.
- Remove members from league (member notified via email + push; their draft picks for past races retained read-only).
- Override draft pick resolution for edge cases (e.g., manually assign a substitute driver to a member).
- Flag data issues to platform admin (opens a flagging form with description; admin receives notification).
- Notify all league members of admin data overrides (one-click forward).
- View all member notification histories within their league (read-only).
- Cannot modify historical race scores or picks directly (must flag to admin).

---

## 6.4 Epic: EPIC-004 — Draft System

### FEAT-010: Draft Window Lifecycle

**Draft Window Rules:**
- A new draft window opens for each race in the season.
- **Opens:** Monday 00:00:00 GMT of the week of the race (determined by `races.date` in the Jolpica schedule).
- **Closes:** The earlier of: (a) scheduled qualifying start time (from Jolpica `races.qualifying.date` + `races.qualifying.time`) OR (b) all league members completing both picks.
- If a race has no qualifying session listed (e.g., sprint weekends), draft closes 3 hours before scheduled race start.
- Draft window closes automatically when all players have submitted both rounds of picks.
- Each player has 24 hours from when it becomes their turn to make each pick (the 24h timer for Round 2 starts only when it becomes that player's turn in Round 2, not when Round 1 completes).
- A draft window can only be active during the open period; late picks are not accepted after qualifying start.

**Draft Sequence for Regular Draft (N players):**
- Round 1: Player 1 → Player 2 → ... → Player N
- Round 2: Player 1 → Player 2 → ... → Player N

**Draft Sequence for Snake Draft (N players):**
- Round 1: Player 1 → Player 2 → ... → Player N
- Round 2: Player N → Player N-1 → ... → Player 1

**Draft Order Rotation (applied at start of each race's draft):**
- Previous draft order: `[P1, P2, P3, ..., PN]`
- New draft order: `[P2, P3, ..., PN, P1]` (first picks last; all others shift forward by one)
- This rotation applies for both snake and regular draft types (the snake reversal within rounds still applies; the rotation just shifts the "first position" baseline).

**Available Drivers:**
- All 22 Jolpica-confirmed drivers for the current season are in the draft pool.
- A driver already picked by another player in the same league for the same race is unavailable.
- If a driver is listed as a confirmed DNS/DNF prior to the draft closing (e.g., announced withdrawal before qualifying), they remain available to draft but their status is shown as "DNS/DNF confirmed pre-race."
- Drivers are displayed with: name, team/constructor (IRL), current season championship points, last race finishing position.

**Missed Pick Resolution (per league commissioner setting):**
- `random`: Assign a random available driver.
- `top_points`: Assign the available driver with highest current season championship points. If tied, choose randomly among tied drivers.
- `no_pick`: Player gets no driver for that slot and automatically scores 0 for that slot.
- The resolution method is logged in `draft_picks.resolution_method` field.

---

### FEAT-011: Auto-Draft Preference Queue

**Description:** Players can pre-rank some or all drivers; the system auto-picks their highest available preference when it's their turn.

**Business Rules:**
- Players can set a weighted preference list at any time during the open draft window before their turn.
- The preference list is ordered (1 = highest preference). Players do not need to include all 22 drivers — any unranked driver can still be manually picked.
- When it's a player's turn (24h timer starts) and they have an auto-draft preference set: the system immediately auto-picks their highest-ranked available driver without waiting the 24 hours.
- Auto-draft fires immediately on turn start, not after any delay.
- If a player has a preference list but ALL their ranked drivers are taken, the system treats them as having no auto-draft preference (24h timer begins for manual pick; after 24h, missed_pick_resolution applies).
- Players can update their preference list any time before their auto-pick fires.
- Auto-draft picks are logged as `resolution_method = 'auto_preference'` in `draft_picks`.

---

### FEAT-012: Driver Substitution Edge Cases

**IRL driver substitution handling:**
- If a driver is substituted IRL BEFORE the draft window closes: the replacement driver is added to the pool; original driver is marked as unavailable. Players who had the original driver in their preference queue are notified.
- If a driver is substituted IRL AFTER the draft window closes (picks are locked):
  - The player who drafted the replaced driver is notified immediately.
  - Based on `substitution_policy` commissioner setting:
    - `redraft`: Player gets a one-time re-pick from remaining available drivers (24h window). Notification sent.
    - `auto_replace`: The replacement driver (as determined by Jolpica/admin) is automatically assigned to that player's roster slot.
  - The system waits for Jolpica to confirm the substitute driver before acting. If not confirmed within 6 hours of race start, admin is notified.
- If a driver has a true DNS (no substitute, no IRL replacement) after draft locks: player scores 0 for that driver slot. No re-pick.
- All substitution events are logged in `driver_substitutions` table.

---

### FEAT-013: Notifications for Draft Events

| Trigger | Notification Text | Channel | Recipients |
|---|---|---|---|
| Draft window opens (Monday midnight GMT) | "The [RACE NAME] draft is now open! Draft closes [DATE TIME] UTC." | Push + Email | All league members |
| 24 hours before draft close | "24 hours left to complete your [RACE NAME] draft!" | Push + Email | Members who haven't completed both picks |
| It's player's turn (manual draft, no auto) | "It's your turn to draft for [RACE NAME]! You have 24 hours." | Push + Email | That player only |
| Pick expires (no auto-draft, no manual pick in 24h) | "Your pick expired. A driver was automatically assigned for [RACE NAME]." | Push + Email | That player only |
| Draft window closes | "[RACE NAME] draft is now locked. Good luck!" | Push | All league members |
| Driver substitution post-lock (redraft policy) | "Your drafted driver [NAME] has been substituted. You have 24 hours to re-pick." | Push + Email | Affected player |
| Driver substitution post-lock (auto_replace policy) | "Your drafted driver [NAME] has been substituted by [REPLACEMENT]. Your roster has been updated." | Push + Email | Affected player |

---

## 6.5 Epic: EPIC-005 — Scoring Engine

### FEAT-014: Scoring Systems

**Scoring System 1: FIA Official**
Uses the actual FIA points system as of the current season. Stored as a configurable lookup table (admin-editable). Default current values:

| Position | Points |
|---|---|
| 1st | 25 |
| 2nd | 18 |
| 3rd | 15 |
| 4th | 12 |
| 5th | 10 |
| 6th | 8 |
| 7th | 6 |
| 8th | 4 |
| 9th | 2 |
| 10th | 1 |
| 11th–20th | 0 |
| Fastest Lap (if in top 10) | +1 |
| DNF | 0 |
| DNS | 0 |
| DSQ | 0 |

Note: FIA scoring table is admin-maintained; if FIA changes scoring rules, admin updates the table without code changes.

**Scoring System 2: Linear 20-Point**
- 1st place = 20 points
- Each position after 1st earns 1 fewer point (2nd = 19, 3rd = 18, ..., 20th = 1)
- DNF = 0
- DNS = 0
- DSQ = 0

**Scoring System 3: Proprietary (Default)**
- 10th place = 10 points (maximum)
- Each position further from 10th earns 1 fewer point:
  - 9th = 9 pts, 11th = 9 pts
  - 8th = 8 pts, 12th = 8 pts
  - 7th = 7 pts, 13th = 7 pts
  - 6th = 6 pts, 14th = 6 pts
  - 5th = 5 pts, 15th = 5 pts
  - 4th = 4 pts, 16th = 4 pts
  - 3rd = 3 pts, 17th = 3 pts
  - 2nd = 2 pts, 18th = 2 pts
  - 1st = 1 pt, 19th = 1 pt, 20th = 1 pt
- DNF = 0
- DNS = 0
- DSQ = 0
- Formula: `max(0, 10 - abs(finishing_position - 10))`; minimum 1 pt for any finisher except DNF/DNS/DSQ/no driver.

**Score Calculation Rules (all systems):**
- A player's race score = Driver 1 score + Driver 2 score.
- If a player has no Driver 1 (missed pick resolution = `no_pick`): Driver 1 score = 0.
- If a player has no Driver 2 (missed pick resolution = `no_pick`): Driver 2 score = 0.
- **DNF rule:** Any driver who does not finish (status contains `DNF`, `Accident`, `Collision`, `Mechanical`, or any non-"Finished" status in Jolpica) scores 0 for that slot.
- **DNS rule:** A driver who does not start scores 0 (whether or not there is a substitute).
- **DSQ (Disqualification):** Scores 0. If DSQ is applied retroactively by Jolpica after initial import, scores are recalculated and all commissioners are notified.

---

### FEAT-015: Double Goose Egg (DGE) Tracking

**Definition:** A "Double Goose Egg" (DGE) occurs when BOTH of a player's drafted drivers for a race score 0 points (both DNF, both DNS, any combination of 0-scoring outcomes). Note: `no_pick` (missed draft) does NOT count as a DGE — DGE only applies when actual drivers were drafted and both scored 0.

**Business Rules:**
- `dge_count` is a persistent stat tracked per player per league across the season.
- Displayed prominently in standings as "🥚🥚" (DGE count) alongside player records.
- DGE is logged in `league_member_stats.dge_count` and in `race_scores.is_dge`.
- Admin overrides that change driver outcomes retroactively will recalculate DGE stats.

---

### FEAT-016: Weekly Winners & Season Podium

**Weekly Winner:**
- The league member with the highest total race score for a given race is the weekly winner.
- Ties: multiple winners are possible (both/all tied players receive "winner" designation for that race).
- Weekly win is recorded in `race_scores.is_weekly_winner`.

**Season Podium:**
- The three league members with the highest cumulative season points (sum of all race scores) are the season 1st, 2nd, and 3rd.
- Ties for any podium position: all tied players receive the same position designation.
- Season standings are updated after each race result is scored.
- Season ends after the final race of the F1 season as defined by Jolpica.
- Historical seasons are preserved in read-only state.

---

## 6.6 Epic: EPIC-006 — Standings, Stats & Live Draft Board

### FEAT-017: League Standings View

**Visible to all league members (always). Visibility to public controlled by commissioner `visibility` setting.**

**Content:**
- Season standings table: rank, team name, player username, total season points, weekly wins count, DGE count.
- Race-by-race history: expandable rows showing each race, driver picks, scores per driver, total race score, and weekly winner indicator.
- Current week: shows draft status (who has picked, who hasn't, time remaining on pick timer).
- All historical picks, scores, and driver selections are visible to all members.

**Live Draft Board (during active draft window):**
- Real-time WebSocket-powered board showing:
  - Current pick order (who is up now, who is next).
  - Timer countdown for the active player's 24h window.
  - Already-drafted drivers per player per round.
  - Available driver pool (22 total minus drafted).
- Updates in real-time as picks are submitted (< 500ms broadcast latency target).

---

## 6.7 Epic: EPIC-007 — Notification System

### FEAT-018: Notification Delivery

**Channels:**
- **HTML5 Web Push:** Via [Web Push Protocol](https://web.dev/push-notifications-web-push-protocol/). Requires browser permission grant from user. Works on desktop and mobile web. Push subscription stored per device.
- **Email:** Via SMTP (send-only). SMTP credentials configured via environment variables.

**Notification Preferences:**
- Users can enable/disable push and/or email independently in profile settings.
- Even with all notifications disabled, notifications still appear in the in-app notification history.
- Transactional emails (email verification, password reset, email change) cannot be disabled.

**In-App Notification Center:**
- Bell icon in navbar shows unread count.
- Click opens notification panel/page (`/notifications`).
- Each notification: icon, title, body, timestamp, link (if applicable), read/unread state.
- Dismissing a notification marks it as read. It remains in history permanently.
- Notification history page shows all notifications ever received by the user, most recent first.
- Pagination: 50 per page.
- Filter by: All / Unread / League-specific.

**Notification Types & Templates:**

| Type ID | Trigger | Title | Body | Link |
|---|---|---|---|---|
| NOTIF-001 | Registration complete | "Welcome to PitLane!" | "Your account is ready. Create or join a league to get started." | `/dashboard` |
| NOTIF-002 | Email verified | "Email Verified" | "Your email has been verified. You can now sign in." | `/login` |
| NOTIF-003 | Draft window opens | "Draft Now Open — [RACE NAME]" | "The [RACE NAME] draft is now open! Close: [DATETIME] UTC." | `/leagues/{id}/draft` |
| NOTIF-004 | 24h draft warning | "24 Hours Left — [RACE NAME] Draft" | "You have 24 hours to complete your draft for [RACE NAME]." | `/leagues/{id}/draft` |
| NOTIF-005 | Your turn to pick | "Your Pick — [RACE NAME]" | "It's your turn in [LEAGUE NAME]! You have 24 hours to pick." | `/leagues/{id}/draft` |
| NOTIF-006 | Pick expired | "Pick Expired — [RACE NAME]" | "Your pick timer expired. [RESOLUTION_TEXT]" | `/leagues/{id}/draft` |
| NOTIF-007 | Draft locked | "Draft Locked — [RACE NAME]" | "The [RACE NAME] draft is locked. Good luck!" | `/leagues/{id}/draft` |
| NOTIF-008 | Results published | "Race Results — [RACE NAME]" | "Results are in! You scored [X] points. [WINNER_TEXT]" | `/leagues/{id}/standings` |
| NOTIF-009 | Admin override | "Data Update — [RACE NAME]" | "An administrator has updated race data. [View details]" | `/leagues/{id}/standings` |
| NOTIF-010 | League join request | "Join Request — [LEAGUE NAME]" | "[USERNAME] wants to join your league." | `/leagues/{id}/settings/members` |
| NOTIF-011 | Join request approved | "Request Approved" | "Your request to join [LEAGUE NAME] has been approved!" | `/leagues/{id}` |
| NOTIF-012 | Join request denied | "Request Denied" | "Your request to join [LEAGUE NAME] was not approved." | `/dashboard` |
| NOTIF-013 | Driver substitution | "Driver Substitution — [RACE NAME]" | "[DRIVER NAME] has been substituted. [ACTION_TEXT]" | `/leagues/{id}/draft` |
| NOTIF-014 | Email change request | "Email Change Requested" | "A request was made to change your email. [Cancel] [Waive Hold]" | `/settings/profile` |
| NOTIF-015 | Admin sync failure | "Jolpica Sync Failed — [RACE NAME]" | "18 Jolpica checks failed. Manual data entry required." | `/admin/races/{id}` |

---

## 6.8 Epic: EPIC-008 — Admin Panel

### FEAT-019: Admin Dashboard

**Access:** Only `super_admin` role. Accessible at `/admin`.

**Sections:**
1. **Race Data Management** — view all races, sync status, last Jolpica check timestamp, manual entry/override interface.
2. **User Management** — list all users, search by email/username, view/edit profile, suspend/unsuspend, view league memberships.
3. **System Settings** — configure `email_change_hold_seconds` (default: 86400), Jolpica polling parameters, FIA scoring table.
4. **Notification Log** — searchable log of all system notifications sent.
5. **Audit Log** — searchable/filterable log of all admin actions with before/after values.
6. **Commissioner Flags** — list of issues flagged by commissioners; status tracking (open/acknowledged/resolved).

### FEAT-020: Admin Race Data Entry

**Manual result entry form (per driver per race):**

| Field | Type | Notes |
|---|---|---|
| race | dropdown | Select from imported races |
| driver | dropdown | Select from season drivers |
| finishing_position | integer (1–20) or null | Null for DNF/DNS |
| finish_status | enum | `Finished` / `DNF` / `DNS` / `DSQ` / `Other` |
| finish_status_detail | string | Optional detail, max 100 chars |
| fastest_lap | boolean | FIA scoring only |
| admin_protected | boolean | If true, Jolpica sync cannot overwrite this field |
| notes | text | Internal admin note, max 500 chars |

**Bulk entry:** Admin can paste a race result table (CSV format: `position,driver_code,status`) for quick entry.

### FEAT-021: System Configuration (Admin)

| Setting Key | Type | Default | Description |
|---|---|---|---|
| `email_change_hold_seconds` | integer | 86400 | Hold period for email changes (seconds). Min: 0, Max: 604800 (7 days). |
| `jolpica_poll_start_hours_after_race` | integer | 3 | Hours after scheduled race start before first Jolpica poll |
| `jolpica_poll_interval_hours` | integer | 2 | Hours between Jolpica polls |
| `jolpica_max_polls` | integer | 18 | Maximum poll attempts before admin alert |
| `draft_pick_timeout_hours` | integer | 24 | Hours per draft pick before timeout resolution |
| `invite_link_expiry_days` | integer | 7 | Days before an invite link expires |
| `fia_scoring_table` | JSON | See default | Position-to-points mapping for FIA scoring system |
| `max_leagues_per_user` | integer | 10 | Maximum leagues a user can belong to simultaneously |
| `max_join_cutoff_races` | integer | 3 | No new members can join after this many completed races |

---

# 7. Non-Functional Requirements

## 7.2 Service Level Objectives

| Surface | SLI | SLO Target | Measurement Window |
|---|---|---|---|
| API | Availability (non-5xx / total) | 99.5% | 30-day rolling |
| API | Latency p50 | ≤ 150ms | 7-day rolling |
| API | Latency p95 | ≤ 500ms | 7-day rolling |
| Web | LCP p75 | ≤ 2.5s | 28-day rolling |
| Web | CLS p75 | ≤ 0.1 | 28-day rolling |
| WebSocket | Draft board update latency p95 | ≤ 500ms | During active draft windows |
| Background Jobs | Jolpica poll job fire-time accuracy | ≤ 5 min late | Per scheduled job |
| Email Delivery | SMTP send success rate | ≥ 95% | 7-day rolling |

## 7.4 Capacity & Concurrency Model (MVP)

| Metric | Launch Target | 6-Month Target |
|---|---|---|
| Daily Active Users | 500 | 3,000 |
| Peak Concurrent Sessions | 100 | 500 |
| Peak API RPS | 50 | 250 |
| Active Leagues | 100 | 500 |
| DB Size | 1 GB | 10 GB |

## 7.7 Availability, Resilience & Degradation

### Tiered Feature Degradation

| Priority | Feature Disabled | User-Facing Message | System Behavior |
|---|---|---|---|
| 1 (first) | WebSocket (live draft board) | "Live updates paused. Refresh to see latest picks." | Polling fallback every 10 seconds |
| 2 | Push notifications | Silent (email still works) | Email only |
| 3 | Jolpica sync | "Race results will be delayed. We're working on it." | Queue retry |
| Never disable | Draft picks, score viewing, auth | — | Always available |

## 7.8 Data Consistency

| Operation | Consistency Model | Conflict Resolution |
|---|---|---|
| Draft pick submission | Strong (ACID) — optimistic lock on driver availability | 409 if driver taken mid-submission |
| Score calculation | Eventual (triggered after result import) | Recalculate from source; idempotent |
| Admin override | Strong (ACID) | Admin UI refresh shows latest state |
| Notification delivery | At-least-once | Idempotency key prevents duplicate push; deduplication on email |

---

# 8. UI/UX & Design System Requirements

## 8.1 Design Tokens

### Color Palette (F1-Inspired Theme)

| Token | Value (Light) | Value (Dark) | Usage |
|---|---|---|---|
| `--color-primary-500` | `#E8002D` | `#FF1E47` | F1 red — Primary CTA, links, brand |
| `--color-primary-600` | `#C40025` | `#E8002D` | Primary hover |
| `--color-primary-700` | `#A00020` | `#C40025` | Primary active/pressed |
| `--color-secondary-500` | `#1A1A2E` | `#0D0D1A` | Dark navy — secondary actions, headers |
| `--color-accent-500` | `#FFD700` | `#FFD700` | Gold — podium highlights, winner badges |
| `--color-success-500` | `#22C55E` | `#4ADE80` | Success states |
| `--color-warning-500` | `#F59E0B` | `#FBBF24` | Warning states, DNS/DNF indicators |
| `--color-error-500` | `#EF4444` | `#F87171` | Error states |
| `--color-neutral-0` | `#FFFFFF` | `#0A0A0F` | Backgrounds |
| `--color-neutral-50` | `#F8F9FA` | `#16161F` | Card backgrounds |
| `--color-neutral-900` | `#0F172A` | `#F8F9FA` | Primary text |

### Typography

| Token | Value |
|---|---|
| `--font-family-sans` | `'Inter', system-ui, -apple-system, sans-serif` |
| `--font-family-display` | `'Formula1', 'Inter', sans-serif` (load Formula1 font if licensed; fallback to Inter Bold) |

## 8.2 Screen Inventory

| Screen ID | Route | Name | Auth | Roles |
|---|---|---|---|---|
| SCR-001 | `/` | Landing Page | No | All |
| SCR-002 | `/signup` | Registration | No | Unauthenticated |
| SCR-003 | `/verify-email-sent` | Verify Email Prompt | No | All |
| SCR-004 | `/login` | Login | No | Unauthenticated |
| SCR-005 | `/forgot-password` | Forgot Password | No | All |
| SCR-006 | `/reset-password` | Reset Password | No (token) | All |
| SCR-010 | `/dashboard` | Dashboard | Yes | All |
| SCR-011 | `/leagues` | My Leagues List | Yes | All |
| SCR-012 | `/leagues/create` | Create League | Yes | All |
| SCR-013 | `/leagues/{id}` | League Home / Standings | Yes | Member+ |
| SCR-014 | `/leagues/{id}/draft` | Live Draft Board | Yes | Member+ |
| SCR-015 | `/leagues/{id}/settings` | League Settings | Yes | Commissioner |
| SCR-016 | `/leagues/{id}/settings/members` | Member Management | Yes | Commissioner |
| SCR-017 | `/join/{token}` | Join Via Invite Link | Yes | All |
| SCR-020 | `/settings/profile` | User Profile | Yes | All |
| SCR-021 | `/notifications` | Notification History | Yes | All |
| SCR-030 | `/admin` | Admin Dashboard | Yes | super_admin |
| SCR-031 | `/admin/races` | Race Data Management | Yes | super_admin |
| SCR-032 | `/admin/races/{id}` | Race Override Interface | Yes | super_admin |
| SCR-033 | `/admin/users` | User Management | Yes | super_admin |
| SCR-034 | `/admin/settings` | System Settings | Yes | super_admin |
| SCR-035 | `/admin/flags` | Commissioner Flags | Yes | super_admin |
| SCR-404 | `*` | 404 Not Found | No | All |

## 8.3 Key Screen Specifications

### SCR-014: Live Draft Board (`/leagues/{id}/draft`)

**Layout:**
```
[RACE NAME] Draft — Closes: [DATETIME UTC]         [Time Remaining: HH:MM:SS]

Pick Order:   [P1 ✓] [P2 ← YOU (12:34 left)] [P3] [P4] ... [PN]
Round:        1 of 2

Available Drivers (18 remaining)
┌──────────────────────────────────────────────────────────┐
│  #  │ Driver Name      │ Team       │ Season Pts │ Last  │
│  ←  │ MAX VERSTAPPEN   │ Red Bull   │  340       │  1st  │
│     │ LANDO NORRIS     │ McLaren    │  290       │  2nd  │
│     │ CARLOS SAINZ     │ Ferrari    │  240       │  5th  │
│ ... │ ...              │ ...        │  ...       │  ...  │
└──────────────────────────────────────────────────────────┘

Drafted This Race:
┌─────────────────────────────────────────────────────┐
│ Player      │ R1 Driver        │ R2 Driver         │
│ [P1] Marco  │ M. VERSTAPPEN ✓  │ (pending)         │
│ [P2] YOU    │ (your turn)      │ (pending)         │
│ [P3] Priya  │ (waiting)        │ (waiting)         │
└─────────────────────────────────────────────────────┘

[Set Auto-Draft Preferences]   [Draft Selected Driver]
```

**Behavior:**
- Driver list is sorted by: user's preference queue first (highlighted), then by season championship points descending.
- Drafting a driver requires selecting a row and clicking "Draft Selected Driver" → confirmation dialog → submit.
- Already-drafted drivers are shown greyed out with "Taken by [PLAYER NAME]".
- Timer counts down in real-time (JavaScript interval, synced with server every 60s).
- WebSocket connection: on disconnect, show banner "Live updates paused. Reconnecting..." and fall back to 10s polling.

---

# 9. Architecture & Tech Stack

## 9.2 System Architecture

```mermaid
C4Context
    title PitLane System Context Diagram

    Person(user, "League Member / Commissioner", "Uses web browser")
    Person(admin, "Platform Admin", "Manages data & system")

    System(pitlane, "PitLane Web App", "Next.js frontend + Fastify API + PostgreSQL + Redis")

    System_Ext(jolpica, "Jolpica F1 API", "F1 race data source")
    System_Ext(smtp, "SMTP Server", "Email delivery")
    System_Ext(vapid, "VAPID Web Push", "HTML5 push notifications")

    Rel(user, pitlane, "Uses", "HTTPS")
    Rel(admin, pitlane, "Manages", "HTTPS")
    Rel(pitlane, jolpica, "Polls for F1 data", "HTTPS/REST")
    Rel(pitlane, smtp, "Sends emails", "SMTP")
    Rel(pitlane, vapid, "Sends push", "Web Push Protocol")
```

```mermaid
C4Container
    title PitLane Container Diagram

    Container(frontend, "Next.js Frontend", "Next.js 15, React, TypeScript", "SSR/CSR web application")
    Container(api, "Fastify API", "Node.js 20, Fastify 5, TypeScript", "REST API + WebSocket server")
    Container(worker, "Job Worker", "BullMQ on Node.js", "Background jobs: Jolpica sync, draft timers, notifications")
    ContainerDb(db, "PostgreSQL 16", "Primary database", "All application data")
    ContainerDb(redis, "Redis 7", "Cache + Queue", "BullMQ queues, session cache, WS pub/sub")

    Rel(frontend, api, "REST + WebSocket", "HTTPS/WSS")
    Rel(api, db, "Reads/writes", "Prisma ORM")
    Rel(api, redis, "Cache + enqueue jobs", "ioredis")
    Rel(worker, db, "Reads/writes", "Prisma ORM")
    Rel(worker, redis, "Dequeue jobs", "BullMQ")
```

## 9.3 Tech Stack

| Layer | Choice | Version | Rationale |
|---|---|---|---|
| Frontend | Next.js | 15.x | App Router, SSR, React 19 |
| UI | shadcn/ui + Tailwind CSS | Latest | Accessible, headless, fast to build |
| State (Client) | Zustand | 5.x | Lightweight |
| State (Server) | TanStack Query | 5.x | Caching, optimistic updates |
| Forms | React Hook Form + Zod | Latest | Performance, type-safe validation |
| Language | TypeScript | 5.x | Full stack type safety |
| Backend | Fastify | 5.x | High performance, schema validation |
| ORM | Prisma | 5.x | Type-safe queries, migrations |
| Primary DB | PostgreSQL | 16.x | ACID, JSONB, proven |
| Cache/Queue | Redis 7 + BullMQ | Latest | Single system for cache + job queues + WS pub/sub |
| Auth | Custom JWT | — | RS256, access + refresh tokens |
| Email | SMTP (Nodemailer) | — | Send-only; SMTP credentials in env |
| Push | Web Push (web-push npm) | — | VAPID-based HTML5 push |
| Real-time | WebSocket (native Fastify WS) | — | Draft board live updates |
| Hosting (FE) | Vercel | — | Next.js native |
| Hosting (BE) | Railway or AWS ECS | — | Docker containers |
| CI/CD | GitHub Actions | — | Native GitHub integration |
| Error Tracking | Sentry | Latest | Source maps, session replay |
| Monitoring | Datadog or self-hosted (TBD) | — | APM + logs |

## 9.4 Environments

| Environment | Frontend URL | API URL | Purpose |
|---|---|---|---|
| local | `http://localhost:3000` | `http://localhost:3001` | Development |
| dev | `https://dev.pitlane.app` | `https://dev-api.pitlane.app` | Integration |
| staging | `https://staging.pitlane.app` | `https://staging-api.pitlane.app` | Pre-production |
| prod | `https://pitlane.app` | `https://api.pitlane.app` | Production |

---

# 10. Frontend Requirements

## 10.3 Routing & Navigation

| Route | Screen ID | Auth | Roles | Rendering |
|---|---|---|---|---|
| `/` | SCR-001 | No | All | SSG |
| `/signup` | SCR-002 | No | Unauthenticated | SSR |
| `/login` | SCR-004 | No | Unauthenticated | SSR |
| `/dashboard` | SCR-010 | Yes | All | SSR |
| `/leagues` | SCR-011 | Yes | All | SSR |
| `/leagues/create` | SCR-012 | Yes | All | CSR |
| `/leagues/{id}` | SCR-013 | Yes | Member | SSR |
| `/leagues/{id}/draft` | SCR-014 | Yes | Member | CSR (WebSocket) |
| `/leagues/{id}/settings` | SCR-015 | Yes | Commissioner | CSR |
| `/join/{token}` | SCR-017 | Yes (redirect to login if not) | All | SSR |
| `/settings/profile` | SCR-020 | Yes | All | SSR |
| `/notifications` | SCR-021 | Yes | All | SSR |
| `/admin` | SCR-030 | Yes | super_admin | SSR |
| `/admin/races` | SCR-031 | Yes | super_admin | SSR |
| `/admin/races/{id}` | SCR-032 | Yes | super_admin | CSR |

## 10.4 State Management

- **Global (Zustand):** Auth session (user ID, role, token), UI state (sidebar, modal, toast queue), notification unread count.
- **Server state (TanStack Query):** All API data. Stale time: 30s for lists, 60s for details, 5s for draft board.
- **WebSocket state:** Draft board — managed via custom hook `useDraftBoard(leagueId)`. On WS message: invalidate TanStack Query for draft state.
- **URL state:** League filters, standings sort, pagination.

---

# 11. Backend Requirements

## 11.2 Architecture

- **Pattern:** Modular Monolith — modules: `auth`, `users`, `leagues`, `drafts`, `scoring`, `f1data`, `notifications`, `admin`
- **Runtime:** Node.js 20 LTS
- **Framework:** Fastify 5
- **API Style:** REST + OpenAPI 3.1
- **Versioning:** `/api/v1/` prefix
- **WebSocket:** Fastify WS plugin; endpoint `/ws/leagues/{id}/draft`

## 11.3 Canonical Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need your attention.",
    "details": {
      "field_errors": [{ "field": "email", "message": "Please enter a valid email address." }],
      "meta": {}
    },
    "request_id": "uuid",
    "timestamp": "ISO8601"
  }
}
```

## 11.4 API Endpoint Catalog

### Auth

| ID | Method | Path | Purpose | Auth | Rate Limit |
|---|---|---|---|---|---|
| API-001 | POST | `/api/v1/auth/register` | Create account | None | 5/min/IP |
| API-002 | POST | `/api/v1/auth/login` | Authenticate | None | 10/min/IP, 5/15min/email |
| API-003 | POST | `/api/v1/auth/refresh` | Refresh token | Cookie | 30/min/IP |
| API-004 | POST | `/api/v1/auth/logout` | Revoke tokens | Bearer | 30/min/user |
| API-005 | POST | `/api/v1/auth/forgot-password` | Request reset | None | 3/hr/email |
| API-006 | POST | `/api/v1/auth/reset-password` | Set new password | Token | 5/hr/IP |
| API-007 | GET | `/api/v1/auth/verify-email` | Verify email | Token | 10/hr/token |

### Users

| ID | Method | Path | Purpose | Auth | Rate Limit |
|---|---|---|---|---|---|
| API-010 | GET | `/api/v1/users/me` | Get own profile | Bearer | 60/min |
| API-011 | PATCH | `/api/v1/users/me` | Update profile | Bearer | 20/min |
| API-012 | POST | `/api/v1/users/me/email-change` | Initiate email change | Bearer | 3/day |
| API-013 | POST | `/api/v1/users/me/email-change/cancel` | Cancel email change | Bearer | 5/hr |
| API-014 | POST | `/api/v1/users/me/email-change/waive-hold` | Waive hold period | Bearer | 5/hr |
| API-015 | POST | `/api/v1/users/me/push-subscription` | Register push subscription | Bearer | 10/min |
| API-016 | DELETE | `/api/v1/users/me/push-subscription` | Remove push subscription | Bearer | 10/min |

### F1 Data

| ID | Method | Path | Purpose | Auth | Rate Limit |
|---|---|---|---|---|---|
| API-020 | GET | `/api/v1/seasons` | List F1 seasons | Bearer | 60/min |
| API-021 | GET | `/api/v1/seasons/{year}/races` | List races for season | Bearer | 60/min |
| API-022 | GET | `/api/v1/seasons/{year}/races/{round}` | Get race details | Bearer | 60/min |
| API-023 | GET | `/api/v1/seasons/{year}/drivers` | List drivers for season | Bearer | 60/min |

### Leagues

| ID | Method | Path | Purpose | Auth | Rate Limit |
|---|---|---|---|---|---|
| API-030 | POST | `/api/v1/leagues` | Create league | Bearer | 10/day/user |
| API-031 | GET | `/api/v1/leagues` | List public leagues | Bearer | 60/min |
| API-032 | GET | `/api/v1/users/me/leagues` | My leagues | Bearer | 60/min |
| API-033 | GET | `/api/v1/leagues/{id}` | Get league | Bearer (member or public) | 60/min |
| API-034 | PATCH | `/api/v1/leagues/{id}` | Update league settings | Bearer (commissioner) | 20/min |
| API-035 | DELETE | `/api/v1/leagues/{id}` | Disband league | Bearer (commissioner) | 1/day |
| API-036 | POST | `/api/v1/leagues/{id}/join` | Join league | Bearer | 10/min |
| API-037 | POST | `/api/v1/leagues/{id}/leave` | Leave league | Bearer | 5/min |
| API-038 | GET | `/api/v1/leagues/{id}/members` | List members | Bearer (member) | 60/min |
| API-039 | DELETE | `/api/v1/leagues/{id}/members/{userId}` | Remove member | Bearer (commissioner) | 10/min |
| API-040 | POST | `/api/v1/leagues/{id}/invite-links` | Generate invite link | Bearer (commissioner or member if allowed) | 5/hr |
| API-041 | GET | `/api/v1/join/{token}` | Resolve invite link | Bearer | 20/min |
| API-042 | GET | `/api/v1/leagues/{id}/join-requests` | List join requests | Bearer (commissioner) | 60/min |
| API-043 | PATCH | `/api/v1/leagues/{id}/join-requests/{requestId}` | Approve/deny request | Bearer (commissioner) | 20/min |
| API-044 | PATCH | `/api/v1/leagues/{id}/draft-order` | Set draft order | Bearer (commissioner) | 10/min |
| API-045 | POST | `/api/v1/leagues/{id}/flag` | Flag issue to admin | Bearer (commissioner) | 5/day |

### Drafts

| ID | Method | Path | Purpose | Auth | Rate Limit |
|---|---|---|---|---|---|
| API-050 | GET | `/api/v1/leagues/{id}/drafts` | List drafts for league | Bearer (member) | 60/min |
| API-051 | GET | `/api/v1/leagues/{id}/drafts/current` | Get active draft state | Bearer (member) | 120/min |
| API-052 | POST | `/api/v1/drafts/{draftId}/picks` | Submit draft pick | Bearer (member) | 10/min |
| API-053 | GET | `/api/v1/users/me/auto-draft-preferences` | Get auto-draft preferences | Bearer | 60/min |
| API-054 | PUT | `/api/v1/users/me/auto-draft-preferences` | Set auto-draft preferences (per league per race) | Bearer | 20/min |

### Scoring & Standings

| ID | Method | Path | Purpose | Auth | Rate Limit |
|---|---|---|---|---|---|
| API-060 | GET | `/api/v1/leagues/{id}/standings` | Season standings | Bearer (member or public if public league) | 60/min |
| API-061 | GET | `/api/v1/leagues/{id}/races/{round}/scores` | Race scores | Bearer (member or public if public league) | 60/min |

### Notifications

| ID | Method | Path | Purpose | Auth | Rate Limit |
|---|---|---|---|---|---|
| API-070 | GET | `/api/v1/notifications` | List notifications (paginated) | Bearer | 60/min |
| API-071 | PATCH | `/api/v1/notifications/{id}/read` | Mark as read | Bearer | 60/min |
| API-072 | POST | `/api/v1/notifications/read-all` | Mark all as read | Bearer | 10/min |

### Admin

| ID | Method | Path | Purpose | Auth | Rate Limit |
|---|---|---|---|---|---|
| API-080 | GET | `/api/v1/admin/races` | List all races + sync status | Bearer (super_admin) | 60/min |
| API-081 | GET | `/api/v1/admin/races/{id}` | Get race + override data | Bearer (super_admin) | 60/min |
| API-082 | POST | `/api/v1/admin/races/{id}/results` | Submit/override results | Bearer (super_admin) | 20/min |
| API-083 | PATCH | `/api/v1/admin/races/{id}/results/{resultId}` | Update result override | Bearer (super_admin) | 20/min |
| API-084 | POST | `/api/v1/admin/races/{id}/sync` | Trigger manual Jolpica sync | Bearer (super_admin) | 5/min |
| API-085 | GET | `/api/v1/admin/users` | List all users | Bearer (super_admin) | 60/min |
| API-086 | PATCH | `/api/v1/admin/users/{id}` | Update user (suspend/unsuspend) | Bearer (super_admin) | 20/min |
| API-087 | GET | `/api/v1/admin/settings` | Get system settings | Bearer (super_admin) | 60/min |
| API-088 | PATCH | `/api/v1/admin/settings` | Update system settings | Bearer (super_admin) | 10/min |
| API-089 | GET | `/api/v1/admin/flags` | List commissioner flags | Bearer (super_admin) | 60/min |
| API-090 | PATCH | `/api/v1/admin/flags/{id}` | Update flag status | Bearer (super_admin) | 20/min |
| API-091 | GET | `/api/v1/admin/audit-log` | Get audit log | Bearer (super_admin) | 30/min |

## 11.5 Background Jobs (BullMQ)

| Job Name | Queue | Trigger | Description | Retry Policy |
|---|---|---|---|---|
| `jolpica.sync.results` | `jolpica` | Scheduled (cron, per-race) | Poll Jolpica for race results | 3 retries, exponential backoff 30s |
| `jolpica.sync.season` | `jolpica` | Cron (weekly on Monday 02:00 UTC) | Sync season schedule and driver list | 3 retries |
| `draft.window.open` | `draft` | Scheduled at Monday 00:00 UTC of race week | Open draft window for all leagues | 3 retries, 30s backoff |
| `draft.window.close` | `draft` | Scheduled at qualifying start OR all-picked | Close draft window | 3 retries |
| `draft.pick.timeout` | `draft` | Scheduled 24h after pick-turn-start | Resolve expired pick | 3 retries |
| `draft.auto_pick` | `draft` | On player turn start if auto-draft set | Execute auto-draft preference | 3 retries |
| `scoring.calculate` | `scoring` | After `jolpica.sync.results` success | Calculate scores for all leagues | 3 retries |
| `notification.send_push` | `notifications` | On notification create | Send Web Push to all user devices | 5 retries, exponential |
| `notification.send_email` | `notifications` | On notification create | Send email via SMTP | 5 retries, exponential |
| `email_change.apply` | `users` | Scheduled at `email_change_expires_at` | Apply pending email change | 3 retries |

---

# 12. Data Model

## 12.1 Entity Relationship Diagram

```mermaid
erDiagram
    USERS {
        string id PK
        string email UK
        string username
        string display_name
        string password_hash
        string default_team_name
        boolean email_verified
        string status
        boolean push_notifications_enabled
        boolean email_notifications_enabled
        string role
        datetime created_at
        datetime updated_at
        datetime deleted_at
    }

    SEASONS {
        string id PK
        integer year UK
        datetime created_at
    }

    RACES {
        string id PK
        string season_id FK
        integer round
        string name
        string circuit_name
        string circuit_country
        datetime scheduled_start_utc
        datetime qualifying_start_utc
        string jolpica_sync_status
        integer jolpica_check_count
        datetime last_jolpica_check_at
        datetime results_finalized_at
        datetime created_at
        datetime updated_at
    }

    DRIVERS {
        string id PK
        string season_id FK
        string jolpica_driver_id
        string code
        string first_name
        string last_name
        string nationality
        string irl_team_name
        integer permanent_number
        datetime created_at
        datetime updated_at
    }

    RACE_RESULTS {
        string id PK
        string race_id FK
        string driver_id FK
        integer finishing_position
        string finish_status
        boolean fastest_lap
        boolean admin_protected
        string jolpica_value_json
        string admin_value_json
        string overridden_by FK
        datetime overridden_at
        string notes
        datetime created_at
        datetime updated_at
    }

    LEAGUES {
        string id PK
        string season_id FK
        string commissioner_id FK
        string name
        string scoring_type
        string draft_type
        string visibility
        boolean join_approval_required
        integer target_players
        integer max_players
        boolean invite_links_by_members
        string missed_pick_resolution
        string substitution_policy
        string status
        datetime created_at
        datetime updated_at
    }

    LEAGUE_MEMBERS {
        string id PK
        string league_id FK
        string user_id FK
        string team_name
        integer draft_position
        datetime joined_at
        datetime left_at
    }

    DRAFT_WINDOWS {
        string id PK
        string league_id FK
        string race_id FK
        datetime opens_at
        datetime closes_at
        string status
        datetime created_at
        datetime updated_at
    }

    DRAFT_PICKS {
        string id PK
        string draft_window_id FK
        string league_member_id FK
        string driver_id FK
        integer round
        string resolution_method
        datetime picked_at
        datetime turn_started_at
        datetime expires_at
        datetime created_at
    }

    AUTO_DRAFT_PREFERENCES {
        string id PK
        string league_member_id FK
        string race_id FK
        json preference_order
        datetime updated_at
    }

    RACE_SCORES {
        string id PK
        string draft_window_id FK
        string league_member_id FK
        integer driver1_points
        integer driver2_points
        integer total_points
        boolean is_dge
        boolean is_weekly_winner
        integer season_rank_at_race
        datetime calculated_at
    }

    LEAGUE_MEMBER_STATS {
        string id PK
        string league_member_id FK
        integer season_total_points
        integer weekly_wins
        integer dge_count
        integer season_rank
        datetime updated_at
    }

    NOTIFICATIONS {
        string id PK
        string user_id FK
        string type
        string title
        string body
        string link
        boolean is_read
        string league_id FK
        string race_id FK
        datetime created_at
        datetime read_at
    }

    INVITE_LINKS {
        string id PK
        string league_id FK
        string created_by_id FK
        string token UK
        datetime expires_at
        datetime used_at
        string used_by_id FK
        datetime created_at
    }

    AUDIT_LOG {
        string id PK
        string actor_id FK
        string action
        string entity_type
        string entity_id
        json before_value
        json after_value
        string ip_address
        datetime created_at
    }

    SYSTEM_SETTINGS {
        string id PK
        string key UK
        string value
        string description
        datetime updated_at
        string updated_by FK
    }

    DRIVER_SUBSTITUTIONS {
        string id PK
        string race_id FK
        string original_driver_id FK
        string replacement_driver_id FK
        string reason
        string source
        datetime confirmed_at
        datetime created_at
    }

    DATA_DISCREPANCIES {
        string id PK
        string race_result_id FK
        string field_name
        string jolpica_value
        string admin_value
        boolean resolved
        datetime created_at
        datetime resolved_at
    }

    COMMISSIONER_FLAGS {
        string id PK
        string league_id FK
        string created_by_id FK
        string description
        string status
        string admin_notes
        datetime created_at
        datetime updated_at
    }

    EMAIL_CHANGE_REQUESTS {
        string id PK
        string user_id FK
        string current_email
        string new_email
        string new_email_verification_token
        boolean new_email_verified
        boolean hold_waived
        datetime hold_expires_at
        boolean cancelled
        datetime expires_at
        datetime completed_at
        datetime created_at
    }

    PUSH_SUBSCRIPTIONS {
        string id PK
        string user_id FK
        string endpoint
        string p256dh
        string auth
        datetime created_at
        datetime last_used_at
    }

    REFRESH_TOKENS {
        string id PK
        string user_id FK
        string token_hash UK
        datetime expires_at
        datetime revoked_at
        string ip_address
        string user_agent
        datetime created_at
    }

    VERIFICATION_TOKENS {
        string id PK
        string user_id FK
        string token_hash UK
        string type
        datetime expires_at
        datetime used_at
        datetime created_at
    }

    JOIN_REQUESTS {
        string id PK
        string league_id FK
        string user_id FK
        string status
        datetime created_at
        datetime reviewed_at
        string reviewed_by FK
    }

    USERS ||--o{ LEAGUE_MEMBERS : "joins"
    USERS ||--o{ LEAGUES : "creates (commissioner)"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ REFRESH_TOKENS : "has"
    USERS ||--o{ VERIFICATION_TOKENS : "has"
    USERS ||--o{ PUSH_SUBSCRIPTIONS : "has"
    USERS ||--o{ EMAIL_CHANGE_REQUESTS : "has"
    SEASONS ||--o{ RACES : "has"
    SEASONS ||--o{ DRIVERS : "has"
    SEASONS ||--o{ LEAGUES : "has"
    LEAGUES ||--o{ LEAGUE_MEMBERS : "has"
    LEAGUES ||--o{ DRAFT_WINDOWS : "has"
    LEAGUES ||--o{ INVITE_LINKS : "has"
    LEAGUES ||--o{ JOIN_REQUESTS : "has"
    LEAGUES ||--o{ COMMISSIONER_FLAGS : "has"
    RACES ||--o{ RACE_RESULTS : "has"
    RACES ||--o{ DRAFT_WINDOWS : "has"
    RACES ||--o{ DRIVER_SUBSTITUTIONS : "has"
    DRIVERS ||--o{ RACE_RESULTS : "has"
    DRIVERS ||--o{ DRAFT_PICKS : "drafted in"
    DRAFT_WINDOWS ||--o{ DRAFT_PICKS : "has"
    DRAFT_WINDOWS ||--o{ RACE_SCORES : "scores"
    LEAGUE_MEMBERS ||--o{ DRAFT_PICKS : "submits"
    LEAGUE_MEMBERS ||--o{ RACE_SCORES : "receives"
    LEAGUE_MEMBERS ||--|| LEAGUE_MEMBER_STATS : "has"
    LEAGUE_MEMBERS ||--o{ AUTO_DRAFT_PREFERENCES : "sets"
    RACE_RESULTS ||--o{ DATA_DISCREPANCIES : "has"
```

## 12.2 Prisma Schema (Complete)

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ─────────────────────────────────────────────────────

enum UserRole {
  super_admin
  member
}

enum UserStatus {
  pending_verification
  active
  suspended
}

enum LeagueStatus {
  forming     // Before first race draft
  active      // Season in progress
  completed   // Season ended
  disbanded   // Commissioner disbanded
}

enum LeagueVisibility {
  public
  private
}

enum ScoringType {
  proprietary
  linear_20
  fia_official
}

enum DraftType {
  snake
  regular
}

enum MissedPickResolution {
  random
  top_points
  no_pick
}

enum SubstitutionPolicy {
  redraft
  auto_replace
}

enum DraftWindowStatus {
  scheduled
  open
  closed
}

enum PickResolutionMethod {
  manual
  auto_preference
  random
  top_points
  no_pick
  commissioner_override
}

enum JolpicaSyncStatus {
  pending
  success
  failed
  manual_override
}

enum JoinRequestStatus {
  pending
  approved
  denied
}

enum FlagStatus {
  open
  acknowledged
  resolved
}

enum NotificationType {
  welcome
  email_verified
  draft_open
  draft_warning_24h
  draft_your_turn
  draft_pick_expired
  draft_locked
  race_results
  admin_data_override
  league_join_request
  join_request_approved
  join_request_denied
  driver_substitution
  email_change_request
  jolpica_sync_failed
  league_disbanded
  member_removed
}

// ─── Models ─────────────────────────────────────────────────────

model User {
  id                        String     @id @default(cuid())
  email                     String     @unique @db.VarChar(254)
  username                  String     @db.VarChar(30)
  display_name              String?    @db.VarChar(50)
  password_hash             String     @db.VarChar(72)
  default_team_name         String?    @db.VarChar(50)
  email_verified            Boolean    @default(false)
  status                    UserStatus @default(pending_verification)
  role                      UserRole   @default(member)
  push_notifications_enabled Boolean   @default(true)
  email_notifications_enabled Boolean  @default(true)
  failed_login_attempts     Int        @default(0)
  locked_until              DateTime?
  last_login_at             DateTime?
  created_at                DateTime   @default(now())
  updated_at                DateTime   @updatedAt
  deleted_at                DateTime?

  refresh_tokens        RefreshToken[]
  verification_tokens   VerificationToken[]
  push_subscriptions    PushSubscription[]
  email_change_requests EmailChangeRequest[]
  league_memberships    LeagueMember[]
  commissioned_leagues  League[]           @relation("LeagueCommissioner")
  notifications         Notification[]
  audit_logs            AuditLog[]         @relation("AuditActor")
  invite_links_created  InviteLink[]       @relation("InviteLinkCreator")
  race_results_overridden RaceResult[]     @relation("RaceResultOverrider")
  settings_updated      SystemSetting[]    @relation("SettingsUpdater")
  flags_created         CommissionerFlag[] @relation("FlagCreator")
  join_requests         JoinRequest[]      @relation("JoinRequestUser")
  join_requests_reviewed JoinRequest[]     @relation("JoinRequestReviewer")

  @@index([email])
  @@index([status])
  @@index([deleted_at])
  @@map("users")
}

model RefreshToken {
  id         String    @id @default(cuid())
  user_id    String
  token_hash String    @unique @db.VarChar(64)
  expires_at DateTime
  revoked_at DateTime?
  ip_address String?   @db.VarChar(45)
  user_agent String?   @db.VarChar(512)
  created_at DateTime  @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([expires_at])
  @@map("refresh_tokens")
}

model VerificationToken {
  id         String    @id @default(cuid())
  user_id    String
  token_hash String    @unique @db.VarChar(64)
  type       String    @db.VarChar(50) // 'email_verification' | 'password_reset' | 'new_email_verification'
  expires_at DateTime
  used_at    DateTime?
  created_at DateTime  @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([expires_at])
  @@map("verification_tokens")
}

model PushSubscription {
  id           String   @id @default(cuid())
  user_id      String
  endpoint     String   @db.VarChar(2048)
  p256dh       String   @db.VarChar(256)
  auth         String   @db.VarChar(64)
  created_at   DateTime @default(now())
  last_used_at DateTime?

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, endpoint])
  @@index([user_id])
  @@map("push_subscriptions")
}

model EmailChangeRequest {
  id                           String    @id @default(cuid())
  user_id                      String
  current_email                String    @db.VarChar(254)
  new_email                    String    @db.VarChar(254)
  new_email_verification_token String?   @db.VarChar(64) // token_hash
  new_email_verified           Boolean   @default(false)
  hold_waived                  Boolean   @default(false)
  hold_expires_at              DateTime
  cancelled                    Boolean   @default(false)
  expires_at                   DateTime  // 72 hours from creation
  completed_at                 DateTime?
  created_at                   DateTime  @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([expires_at])
  @@map("email_change_requests")
}

model Season {
  id         String   @id @default(cuid())
  year       Int      @unique
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  races   Race[]
  drivers Driver[]
  leagues League[]

  @@map("seasons")
}

model Race {
  id                     String            @id @default(cuid())
  season_id              String
  round                  Int
  name                   String            @db.VarChar(200)
  circuit_name           String            @db.VarChar(200)
  circuit_country        String            @db.VarChar(100)
  scheduled_start_utc    DateTime
  qualifying_start_utc   DateTime?
  jolpica_sync_status    JolpicaSyncStatus @default(pending)
  jolpica_check_count    Int               @default(0)
  last_jolpica_check_at  DateTime?
  results_finalized_at   DateTime?
  created_at             DateTime          @default(now())
  updated_at             DateTime          @updatedAt

  season              Season               @relation(fields: [season_id], references: [id])
  race_results        RaceResult[]
  draft_windows       DraftWindow[]
  driver_substitutions DriverSubstitution[]

  @@unique([season_id, round])
  @@index([season_id])
  @@index([scheduled_start_utc])
  @@map("races")
}

model Driver {
  id                String   @id @default(cuid())
  season_id         String
  jolpica_driver_id String   @db.VarChar(100)
  code              String   @db.VarChar(5)
  first_name        String   @db.VarChar(100)
  last_name         String   @db.VarChar(100)
  nationality       String   @db.VarChar(100)
  irl_team_name     String   @db.VarChar(100)
  permanent_number  Int?
  is_active         Boolean  @default(true)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  season       Season       @relation(fields: [season_id], references: [id])
  race_results RaceResult[]
  draft_picks  DraftPick[]
  subs_out     DriverSubstitution[] @relation("SubstitutedOut")
  subs_in      DriverSubstitution[] @relation("SubstitutedIn")

  @@unique([season_id, jolpica_driver_id])
  @@index([season_id])
  @@map("drivers")
}

model RaceResult {
  id                   String    @id @default(cuid())
  race_id              String
  driver_id            String
  finishing_position   Int?      // null = DNF/DNS/DSQ
  finish_status        String    @db.VarChar(100) // 'Finished' | 'DNF' | 'DNS' | 'DSQ' | other
  finish_status_detail String?   @db.VarChar(100)
  fastest_lap          Boolean   @default(false)
  admin_protected      Boolean   @default(false)
  jolpica_value_json   Json?     // raw Jolpica data snapshot
  admin_value_json     Json?     // admin override values
  overridden_by_id     String?
  overridden_at        DateTime?
  notes                String?   @db.VarChar(500)
  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt

  race         Race   @relation(fields: [race_id], references: [id])
  driver       Driver @relation(fields: [driver_id], references: [id])
  overridden_by User?  @relation("RaceResultOverrider", fields: [overridden_by_id], references: [id])
  discrepancies DataDiscrepancy[]

  @@unique([race_id, driver_id])
  @@index([race_id])
  @@map("race_results")
}

model DataDiscrepancy {
  id             String    @id @default(cuid())
  race_result_id String
  field_name     String    @db.VarChar(100)
  jolpica_value  String    @db.VarChar(500)
  admin_value    String    @db.VarChar(500)
  resolved       Boolean   @default(false)
  created_at     DateTime  @default(now())
  resolved_at    DateTime?

  race_result RaceResult @relation(fields: [race_result_id], references: [id])

  @@index([race_result_id])
  @@map("data_discrepancies")
}

model DriverSubstitution {
  id                    String   @id @default(cuid())
  race_id               String
  original_driver_id    String
  replacement_driver_id String?
  reason                String?  @db.VarChar(500)
  source                String   @db.VarChar(50) // 'jolpica' | 'admin'
  confirmed_at          DateTime?
  created_at            DateTime @default(now())

  race               Race    @relation(fields: [race_id], references: [id])
  original_driver    Driver  @relation("SubstitutedOut", fields: [original_driver_id], references: [id])
  replacement_driver Driver? @relation("SubstitutedIn", fields: [replacement_driver_id], references: [id])

  @@index([race_id])
  @@map("driver_substitutions")
}

model League {
  id                       String              @id @default(cuid())
  season_id                String
  commissioner_id          String
  name                     String              @db.VarChar(80)
  scoring_type             ScoringType         @default(proprietary)
  draft_type               DraftType           @default(snake)
  visibility               LeagueVisibility    @default(private)
  join_approval_required   Boolean             @default(false)
  target_players           Int                 @default(8)
  max_players              Int                 @default(11)
  invite_links_by_members  Boolean             @default(true)
  missed_pick_resolution   MissedPickResolution @default(top_points)
  substitution_policy      SubstitutionPolicy  @default(auto_replace)
  status                   LeagueStatus        @default(forming)
  created_at               DateTime            @default(now())
  updated_at               DateTime            @updatedAt

  season        Season          @relation(fields: [season_id], references: [id])
  commissioner  User            @relation("LeagueCommissioner", fields: [commissioner_id], references: [id])
  members       LeagueMember[]
  draft_windows DraftWindow[]
  invite_links  InviteLink[]
  join_requests JoinRequest[]
  flags         CommissionerFlag[]

  @@index([season_id])
  @@index([commissioner_id])
  @@index([status])
  @@index([visibility])
  @@map("leagues")
}

model LeagueMember {
  id             String    @id @default(cuid())
  league_id      String
  user_id        String
  team_name      String    @db.VarChar(50)
  draft_position Int       // 1-based position within league for current race
  joined_at      DateTime  @default(now())
  left_at        DateTime?

  league               League               @relation(fields: [league_id], references: [id])
  user                 User                 @relation(fields: [user_id], references: [id])
  draft_picks          DraftPick[]
  race_scores          RaceScore[]
  stats                LeagueMemberStat?
  auto_draft_prefs     AutoDraftPreference[]

  @@unique([league_id, user_id])
  @@unique([league_id, team_name]) // team name unique per league
  @@index([league_id])
  @@index([user_id])
  @@map("league_members")
}

model LeagueMemberStat {
  id                  String   @id @default(cuid())
  league_member_id    String   @unique
  season_total_points Int      @default(0)
  weekly_wins         Int      @default(0)
  dge_count           Int      @default(0)
  season_rank         Int?
  updated_at          DateTime @updatedAt

  league_member LeagueMember @relation(fields: [league_member_id], references: [id], onDelete: Cascade)

  @@map("league_member_stats")
}

model DraftWindow {
  id         String            @id @default(cuid())
  league_id  String
  race_id    String
  opens_at   DateTime
  closes_at  DateTime          // qualifying start or all picked
  status     DraftWindowStatus @default(scheduled)
  created_at DateTime          @default(now())
  updated_at DateTime          @updatedAt

  league      League      @relation(fields: [league_id], references: [id])
  race        Race        @relation(fields: [race_id], references: [id])
  draft_picks DraftPick[]
  race_scores RaceScore[]

  @@unique([league_id, race_id])
  @@index([status])
  @@index([opens_at])
  @@map("draft_windows")
}

model DraftPick {
  id                String               @id @default(cuid())
  draft_window_id   String
  league_member_id  String
  driver_id         String?              // null if no_pick resolution
  round             Int                  // 1 or 2
  resolution_method PickResolutionMethod @default(manual)
  turn_started_at   DateTime
  expires_at        DateTime
  picked_at         DateTime?
  created_at        DateTime             @default(now())

  draft_window  DraftWindow  @relation(fields: [draft_window_id], references: [id])
  league_member LeagueMember @relation(fields: [league_member_id], references: [id])
  driver        Driver?      @relation(fields: [driver_id], references: [id])

  @@unique([draft_window_id, league_member_id, round])
  @@index([draft_window_id])
  @@index([expires_at])
  @@map("draft_picks")
}

model AutoDraftPreference {
  id               String   @id @default(cuid())
  league_member_id String
  race_id          String
  preference_order Json     // Array of driver IDs in preference order: ["driver_id_1", "driver_id_2", ...]
  updated_at       DateTime @updatedAt

  league_member LeagueMember @relation(fields: [league_member_id], references: [id], onDelete: Cascade)

  @@unique([league_member_id, race_id])
  @@map("auto_draft_preferences")
}

model RaceScore {
  id               String   @id @default(cuid())
  draft_window_id  String
  league_member_id String
  driver1_points   Int      @default(0)
  driver2_points   Int      @default(0)
  total_points     Int      @default(0)
  is_dge           Boolean  @default(false)
  is_weekly_winner Boolean  @default(false)
  season_rank_at_race Int?
  calculated_at    DateTime @default(now())
  updated_at       DateTime @updatedAt

  draft_window  DraftWindow  @relation(fields: [draft_window_id], references: [id])
  league_member LeagueMember @relation(fields: [league_member_id], references: [id])

  @@unique([draft_window_id, league_member_id])
  @@index([draft_window_id])
  @@map("race_scores")
}

model InviteLink {
  id            String    @id @default(cuid())
  league_id     String
  created_by_id String
  token         String    @unique @db.VarChar(8)
  expires_at    DateTime
  used_by       InviteLinkUse[]
  created_at    DateTime  @default(now())

  league     League @relation(fields: [league_id], references: [id])
  created_by User   @relation("InviteLinkCreator", fields: [created_by_id], references: [id])

  @@index([token])
  @@index([expires_at])
  @@map("invite_links")
}

model InviteLinkUse {
  id             String   @id @default(cuid())
  invite_link_id String
  used_by_id     String
  used_at        DateTime @default(now())

  invite_link InviteLink @relation(fields: [invite_link_id], references: [id])

  @@unique([invite_link_id, used_by_id])
  @@map("invite_link_uses")
}

model JoinRequest {
  id            String           @id @default(cuid())
  league_id     String
  user_id       String
  status        JoinRequestStatus @default(pending)
  created_at    DateTime         @default(now())
  reviewed_at   DateTime?
  reviewed_by_id String?

  league      League @relation(fields: [league_id], references: [id])
  user        User   @relation("JoinRequestUser", fields: [user_id], references: [id])
  reviewed_by User?  @relation("JoinRequestReviewer", fields: [reviewed_by_id], references: [id])

  @@unique([league_id, user_id])
  @@index([league_id, status])
  @@map("join_requests")
}

model Notification {
  id         String           @id @default(cuid())
  user_id    String
  type       NotificationType
  title      String           @db.VarChar(200)
  body       String           @db.VarChar(500)
  link       String?          @db.VarChar(500)
  is_read    Boolean          @default(false)
  league_id  String?
  race_id    String?
  created_at DateTime         @default(now())
  read_at    DateTime?

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, is_read])
  @@index([user_id, created_at(sort: Desc)])
  @@map("notifications")
}

model AuditLog {
  id          String   @id @default(cuid())
  actor_id    String?
  action      String   @db.VarChar(100)
  entity_type String   @db.VarChar(100)
  entity_id   String?
  before_value Json?
  after_value  Json?
  ip_address  String?  @db.VarChar(45)
  created_at  DateTime @default(now())

  actor User? @relation("AuditActor", fields: [actor_id], references: [id])

  @@index([actor_id])
  @@index([entity_type, entity_id])
  @@index([created_at(sort: Desc)])
  @@map("audit_log")
}

model SystemSetting {
  id          String   @id @default(cuid())
  key         String   @unique @db.VarChar(100)
  value       String   @db.VarChar(1000)
  description String   @db.VarChar(500)
  updated_at  DateTime @updatedAt
  updated_by_id String?

  updated_by User? @relation("SettingsUpdater", fields: [updated_by_id], references: [id])

  @@map("system_settings")
}

model CommissionerFlag {
  id             String     @id @default(cuid())
  league_id      String
  created_by_id  String
  description    String     @db.VarChar(1000)
  status         FlagStatus @default(open)
  admin_notes    String?    @db.VarChar(1000)
  created_at     DateTime   @default(now())
  updated_at     DateTime   @updatedAt

  league     League @relation(fields: [league_id], references: [id])
  created_by User   @relation("FlagCreator", fields: [created_by_id], references: [id])

  @@index([status])
  @@map("commissioner_flags")
}
```

## 12.5 Index Strategy

| Table | Index Name | Columns | Query Pattern |
|---|---|---|---|
| users | `idx_users_email` | `(email)` | Login, uniqueness check |
| races | `idx_races_season_round` | `(season_id, round)` UNIQUE | Race lookup |
| races | `idx_races_scheduled_start` | `(scheduled_start_utc)` | Job scheduling |
| race_results | `idx_race_results_race` | `(race_id)` | Get all results for a race |
| draft_windows | `idx_dw_status_opens` | `(status, opens_at)` | Job: find windows to open |
| draft_picks | `idx_dp_expires` | `(expires_at)` WHERE `picked_at IS NULL` | Job: find expired picks |
| notifications | `idx_notif_user_unread` | `(user_id, is_read)` | Unread count, bell badge |
| league_members | `idx_lm_league_user` | `(league_id, user_id)` UNIQUE | Member lookup |

## 12.7 Seed Data (Dev/Staging)

1. 1 `super_admin`: `admin@pitlane.dev` / `SeedAdmin123!`
2. 1 F1 Season (2026) with races imported from Jolpica (or mocked if unavailable)
3. 22 drivers for 2026 season (real or mocked)
4. 5 regular member users: `member1@pitlane.dev` through `member5@pitlane.dev` / `SeedMember123!`
5. 1 test league with member1 as commissioner, all 5 members joined, scoring_type=proprietary, draft_type=snake
6. 1 completed race with picks and scores for testing standings

## 12.8 Caching Strategy

| Cache Key | Data | TTL | Invalidation |
|---|---|---|---|
| `user:{id}:profile` | User profile | 300s | PATCH /users/me |
| `league:{id}` | League details | 120s | PATCH /leagues/{id} |
| `draft:{id}:state` | Draft window state | 5s | Any pick submitted (WS broadcast also) |
| `standings:{leagueId}` | Season standings | 60s | After score calculation job |
| `season:{year}:races` | Race schedule | 3600s | After Jolpica season sync |
| `season:{year}:drivers` | Driver list | 3600s | After Jolpica season sync |

---

# 13. Authentication & Authorization

## 13.1 Auth Mechanism

- **Access Token:** JWT, RS256, 15-minute TTL. Stored in JavaScript memory (not localStorage or sessionStorage). Attached as `Authorization: Bearer {token}` to API requests.
- **Refresh Token:** JWT, RS256, 30-day TTL. Stored in httpOnly, Secure, SameSite=Strict cookie. Used at `/api/v1/auth/refresh`.
- **Token Rotation:** New refresh token issued on every refresh. Old token revoked immediately.
- **CSRF Protection:** SameSite=Strict cookie + custom header `X-Requested-With: XMLHttpRequest` verification for state-changing endpoints.

## 13.2 RBAC Permissions Matrix

| Action | `super_admin` | `commissioner` (own league) | `member` (own league) | Unauthenticated |
|---|---|---|---|---|
| View public league | ✓ | ✓ | ✓ | ✓ |
| View private league | ✓ | ✓ | ✓ (if member) | ✗ |
| Create league | ✓ | ✓ | ✓ | ✗ |
| Edit league settings | ✓ | ✓ | ✗ | ✗ |
| Disband league | ✓ | ✓ | ✗ | ✗ |
| Remove member | ✓ | ✓ | ✗ | ✗ |
| Generate invite link | ✓ | ✓ | ✓ (if allowed) | ✗ |
| Submit draft pick | ✓ | ✓ | ✓ (when it's their turn) | ✗ |
| View draft board | ✓ | ✓ | ✓ | ✗ (✓ if public league) |
| View standings | ✓ | ✓ | ✓ | ✗ (✓ if public league) |
| Flag issue to admin | ✓ | ✓ | ✗ | ✗ |
| Override race data | ✓ | ✗ | ✗ | ✗ |
| View admin panel | ✓ | ✗ | ✗ | ✗ |
| Suspend user | ✓ | ✗ | ✗ | ✗ |
| Edit system settings | ✓ | ✗ | ✗ | ✗ |

---

# 14. Security, Compliance & Privacy

## 14.1 OWASP Top 10 Mitigations

| Risk | Mitigation |
|---|---|
| A01 Broken Access Control | RBAC enforced per endpoint; resource ownership validated server-side; commissioner scope limited to own league |
| A02 Cryptographic Failures | TLS 1.3 minimum; bcrypt cost 12 for passwords; RS256 JWT; tokens stored in httpOnly cookies or memory only |
| A03 Injection | All DB queries via Prisma ORM (parameterized); Zod validation on all inputs |
| A04 Insecure Design | Threat model reviewed; admin cannot override league scores directly; commissioner cannot override app-wide data |
| A05 Security Misconfiguration | Helmet.js headers; CORS restricted to allowed origins; no debug info in prod errors |
| A06 Vulnerable Components | `npm audit` in CI; Snyk scanning; dependency updates automated (Dependabot) |
| A07 Auth Failures | Account lockout at 5 failures/15min; refresh token rotation; logout invalidates all tokens |
| A08 Data Integrity | Admin overrides require confirmation; audit log immutable; idempotency keys on write endpoints |
| A09 Logging/Monitoring | Structured JSON logs; all admin actions audited; Sentry error tracking; alerts on anomalous rate spikes |
| A10 SSRF | Jolpica polling URL is static and config-controlled; no user-supplied URLs used in server-side requests |

## 14.2 PII Inventory

| Field | Classification | Storage | Encrypted at Rest? | Retention | Access |
|---|---|---|---|---|---|
| email | PII | `users.email` | DB-level encryption | Until deletion + 90 days | auth, admin |
| password_hash | Sensitive | `users.password_hash` | DB-level encryption | Until deletion | Never exposed |
| push endpoint | PII | `push_subscriptions.endpoint` | DB-level | Until unsubscribed | System only |
| IP address | PII | `audit_log.ip_address`, `refresh_tokens.ip_address` | None | 90 days | admin |

## 14.3 Data Retention & Deletion

- User accounts: Soft delete on `DELETE /users/me`. Data purged after 90 days.
- Audit logs: Retained 2 years (legal requirement).
- Notifications: Retained indefinitely (user-visible history).
- Race data: Retained indefinitely (historical seasons, read-only).
- Refresh tokens: Expired tokens purged after 7 days via scheduled job.
- Verification tokens: Expired/used tokens purged after 48 hours.

---

# 15. Integrations & Third-Party Services

## 15.1 Jolpica F1 API

| Attribute | Value |
|---|---|
| Base URL | `https://api.jolpi.ca/ergast/f1/` |
| Auth | None (public API) |
| Rate Limit | Refer to Jolpica docs; implement conservative polling (≥ 2hr intervals for results) |
| Timeout | 30 seconds per request |
| Retry Policy | Exponential backoff: 30s, 60s, 120s for transient errors. No retry for 4xx (except 429). |
| Fallback | Admin manual entry after 18 consecutive failures |
| Data Format | JSON (Ergast-compatible format) |
| Key Endpoints Used | `/f1/{year}/races.json`, `/f1/{year}/drivers.json`, `/f1/{year}/{round}/results.json`, `/f1/{year}/driverStandings.json` |

**Polling Job pseudocode:**
```
function jolpicaResultsPollJob(raceId):
  race = db.races.findById(raceId)
  if race.jolpica_check_count >= system_settings.jolpica_max_polls:
    notify all super_admins (NOTIF-015)
    return
  
  response = fetch(jolpica_results_url, timeout=30s)
  race.last_jolpica_check_at = now()
  race.jolpica_check_count++
  
  if response.ok and has_results(response):
    import_results(race, response)
    race.jolpica_sync_status = 'success'
    trigger scoring job
  else:
    race.jolpica_sync_status = 'failed'
    schedule next check in jolpica_poll_interval_hours
  
  db.races.save(race)
```

## 15.2 SMTP (Email)

| Attribute | Value |
|---|---|
| Library | Nodemailer |
| Transport | SMTP (configurable host, port, user, pass via env vars) |
| Mode | Send-only |
| From Address | `noreply@pitlane.app` (configurable via env) |
| Timeout | 10 seconds per send |
| Retry Policy | 5 retries, exponential backoff (1s, 2s, 4s, 8s, 16s) via BullMQ job retries |
| Fallback | None in MVP; on failure after all retries, log error and mark notification as failed |

**Required email templates (plain text + HTML):**

| Template ID | Subject | Used By |
|---|---|---|
| TMPL-001 | "Verify your PitLane email address" | Registration |
| TMPL-002 | "Reset your PitLane password" | Password reset |
| TMPL-003 | "Email change requested — action required" | Email change (current address) |
| TMPL-004 | "Verify your new PitLane email address" | Email change (new address) |
| TMPL-005 | "[RACE NAME] draft is now open!" | Draft open |
| TMPL-006 | "It's your turn to draft — [RACE NAME]" | Draft pick turn |
| TMPL-007 | "[RACE NAME] race results are in!" | Score published |
| TMPL-008 | "Race data updated — [RACE NAME]" | Admin override |
| TMPL-009 | "You've been added to [LEAGUE NAME]" | League join approved |
| TMPL-010 | "[DRIVER] has been substituted — action required" | Substitution (redraft) |

## 15.3 Web Push (VAPID)

| Attribute | Value |
|---|---|
| Library | `web-push` npm package |
| Auth | VAPID key pair (generated once, stored in env vars) |
| Payload | JSON: `{ title, body, icon: '/icon-192x192.png', badge: '/badge-72x72.png', data: { url } }` |
| Timeout | 15 seconds |
| Retry Policy | 5 retries with exponential backoff via BullMQ |
| Expiry | Push subscriptions that return 410 Gone are automatically deleted |

---

# 16. Testing Strategy

## 16.1 Testing Pyramid

| Test Type | Tool | Coverage Target | Gate |
|---|---|---|---|
| Unit (FE) | Vitest + RTL | ≥ 80% branch | Required on every PR |
| Unit (BE) | Vitest | ≥ 80% branch | Required on every PR |
| Integration (API) | Supertest + test DB | ≥ 75% endpoints | Required on every PR |
| E2E | Playwright | All core flows | Required on merge to main |
| Contract | Spectral | All public APIs | Required on every PR |
| Performance | k6 | NFR thresholds | Nightly + pre-release |
| Security (SAST) | `npm audit` + Snyk | Zero high/critical | Required on every PR |
| Accessibility | axe-playwright | WCAG 2.2 AA | Required on every PR |

## 16.2 Required E2E Tests

| Test ID | Flow | Key Assertions |
|---|---|---|
| E2E-001 | Registration → verification → login | Account created, email sent, verified, login succeeds |
| E2E-002 | Login → locked after 5 failures | Lock message shown, lock lifted after 15 min |
| E2E-003 | Create league → set draft order → invite members | League created, invite link works, members joined |
| E2E-004 | Draft window opens → pick submitted → board updates | Pick recorded, WS board reflects pick in < 1s |
| E2E-005 | Auto-draft preference → auto-pick fires on turn | Highest available preference auto-selected |
| E2E-006 | 24h timer expires → missed_pick_resolution fires | Pick resolved per league setting, player notified |
| E2E-007 | Race results import → scores calculated → standings update | Standings reflect correct scores |
| E2E-008 | Admin override → discrepancy logged → commissioners notified | Override stored, discrepancy visible, notification sent |
| E2E-009 | DGE: both drivers DNF → DGE flagged | `race_scores.is_dge = true`, DGE count incremented |
| E2E-010 | Email change full flow with hold period | Current email notified, new email verified, hold elapses, change applies |
| E2E-011 | Email change cancelled | Current email cancels, request reverted, confirmation sent |
| E2E-012 | Public league visibility | Unauthenticated user can view public league standings |
| E2E-013 | Mobile responsive: 375px draft board | All touch targets ≥ 44px, no horizontal scroll |

---

# 17. Deployment, DevOps & Operations

## 17.2 CI/CD (GitHub Actions)

**Branch strategy:** `main` (production) ← `staging` ← feature branches

**Pipeline gates:**
1. Lint + typecheck → 2. Unit tests → 3. Integration tests → 4. Security scan → 5. Accessibility scan → 6. Build → 7. E2E (on staging/main merge only) → 8. Deploy

**Environments:** Deploy to staging on merge to `staging` branch. Deploy to production on merge to `main` (requires manual approval in GitHub Environments).

## 17.3 Monitoring & Alerting

| Alert | Condition | Severity | Notification |
|---|---|---|---|
| API p99 > 2s | 5-min rolling | High | Slack #alerts |
| Error rate > 1% | 5-min rolling | High | Slack #alerts |
| Error rate > 5% | 1-min rolling | Critical | PagerDuty |
| Uptime check fails (2 consecutive) | — | Critical | PagerDuty |
| Jolpica sync failed 18 checks | Per race | High | Email to all super_admins |
| Draft pick timer missed > 5min | Per job | Medium | Slack #alerts |
| BullMQ DLQ depth > 10 | 5-min | High | Slack #alerts |

## 17.4 Backup & Recovery

| Data | Method | Frequency | Retention | RTO | RPO |
|---|---|---|---|---|---|
| PostgreSQL | Automated snapshots | Daily | 30 days | 1 hour | 24 hours |
| PostgreSQL | WAL archiving | Continuous | 7 days | 15 min | 5 min |
| Redis | RDB snapshot | Hourly | 7 days | 15 min | 1 hour |

---

# 18. Assumptions, Dependencies, Risks & Mitigations

## 18.1 Assumptions

| ID | Assumption | Owner | If False |
|---|---|---|---|
| A-001 | Jolpica API remains publicly available and maintains Ergast-compatible format | Engineering | Pivot to alternate F1 data source; admin manual entry covers gap |
| A-002 | 22 drivers per F1 season is stable (no expansion beyond 22) | Product | League size rules may need adjustment |
| A-003 | F1 season schedule (race dates/qualifying times) is accurately reflected in Jolpica with ≥ 1 week lead time | Engineering | Add manual schedule override in admin panel |
| A-004 | SMTP deliverability is ≥ 90% from MVP infrastructure | Engineering | Migrate to dedicated transactional email service (Resend, Postmark) |
| A-005 | HTML5 Web Push is sufficient for mobile engagement (no native app needed in MVP) | Product | Expedite native app development |

## 18.3 Risk Register

| ID | Risk | Probability | Impact | Mitigation | Contingency |
|---|---|---|---|---|---|
| R-001 | Jolpica goes down or changes API format | Medium | Critical | Admin manual entry fallback; periodic API compatibility tests | Identify backup F1 data source |
| R-002 | Draft timer jobs fail silently | Medium | High | BullMQ DLQ monitoring; alerts on queue depth | Manual commissioner override tools |
| R-003 | WebSocket disconnections during draft cause players to miss turn | Medium | High | 10s polling fallback; visible reconnection banner | Extend pick timer on reconnect |
| R-004 | Score calculation bug leads to incorrect results | Low | Critical | Unit tests for all scoring permutations; double-check via job | Admin override + recalculate |
| R-005 | SMTP blacklisting | Low | High | SPF/DKIM/DMARC configured from day 1; send from verified domain | Switch SMTP provider; use backup provider |

---

# 19. Glossary

| Term | Definition |
|---|---|
| Commissioner | The user who created a league and has full control over its settings |
| Constructor | A player's two-driver team for a single race, assembled via the draft |
| DGE (Double Goose Egg) | When both of a player's drafted drivers score 0 points in the same race |
| DNF | Did Not Finish — driver retired from the race; scores 0 points |
| DNS | Did Not Start — driver did not start the race; scores 0 points |
| DSQ | Disqualified — driver disqualified post-race; scores 0 points |
| Draft Window | The period each week when players can submit their driver picks |
| Jolpica | The F1 data API used as the golden source for all race, driver, and result data |
| Missed Pick Resolution | The strategy applied when a player's 24h pick timer expires |
| Proprietary Scoring | PitLane's default scoring where 10th place = 10 pts, declining symmetrically |
| Snake Draft | Draft format where Round 2 order reverses: P1→P2→...→PN (R1), PN→...→P1 (R2) |
| Regular Draft | Draft format where both rounds follow the same order: P1→P2→...→PN |
| Season Podium | The 1st, 2nd, and 3rd place finishers in season cumulative points |
| Substitution Policy | Commissioner-set rule for how IRL driver substitutions after draft lock are handled |
| VAPID | Voluntary Application Server Identification for Web Push authentication |
| Weekly Winner | The player with the highest score in a single race weekend |

---

# 20. Appendices

## Appendix C: Environment Variables

```bash
# ── App ────────────────────────────────────────────────────────
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
PORT=3001

# ── Database ───────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/pitlane_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ── Redis ──────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Auth ───────────────────────────────────────────────────────
JWT_ACCESS_SECRET=[RS256 private key base64]
JWT_ACCESS_PUBLIC=[RS256 public key base64]
JWT_REFRESH_SECRET=[RS256 private key base64]
JWT_REFRESH_PUBLIC=[RS256 public key base64]
JWT_ACCESS_EXPIRES_IN=900            # 15 minutes
JWT_REFRESH_EXPIRES_IN=2592000       # 30 days

# ── SMTP ───────────────────────────────────────────────────────
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false                    # true for 465
SMTP_USER=your@email.com
SMTP_PASS=yourpassword
SMTP_FROM=noreply@pitlane.app
SMTP_FROM_NAME=PitLane

# ── Web Push (VAPID) ───────────────────────────────────────────
VAPID_PUBLIC_KEY=[generated public key]
VAPID_PRIVATE_KEY=[generated private key]
VAPID_SUBJECT=mailto:admin@pitlane.app

# ── Jolpica ────────────────────────────────────────────────────
JOLPICA_BASE_URL=https://api.jolpi.ca/ergast/f1
JOLPICA_TIMEOUT_MS=30000

# ── Monitoring ─────────────────────────────────────────────────
SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project]
SENTRY_ENVIRONMENT=development

# ── Rate Limiting ──────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60

# ── Feature Flags ──────────────────────────────────────────────
FEATURE_WEB_PUSH=true

# ── Misc ───────────────────────────────────────────────────────
LOG_LEVEL=debug
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

## Appendix D: API Golden Files

### POST /api/v1/auth/register

**Request:**
```json
{
  "email": "marco@example.com",
  "password": "SecurePass123!",
  "username": "marco_f1",
  "agreed_to_terms": true
}
```

**Response 201:**
```json
{
  "data": {
    "user": {
      "id": "cm_abc123",
      "email": "marco@example.com",
      "username": "marco_f1",
      "status": "pending_verification",
      "created_at": "2026-03-01T10:00:00Z"
    },
    "message": "Account created. Please check your email to verify your address."
  }
}
```

**Response 409:**
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "An account with this email already exists.",
    "details": { "field_errors": [{ "field": "email", "message": "An account with this email already exists." }], "meta": {} },
    "request_id": "uuid",
    "timestamp": "2026-03-01T10:00:00Z"
  }
}
```

### POST /api/v1/drafts/{draftId}/picks

**Request:**
```json
{
  "driver_id": "cm_driver_verstappen",
  "round": 1
}
```

**Response 201:**
```json
{
  "data": {
    "pick": {
      "id": "cm_pick_001",
      "round": 1,
      "driver_id": "cm_driver_verstappen",
      "driver_name": "Max Verstappen",
      "driver_code": "VER",
      "resolution_method": "manual",
      "picked_at": "2026-03-10T14:32:00Z"
    },
    "next_turn": {
      "league_member_id": "cm_member_002",
      "username": "priya_racer",
      "round": 1,
      "expires_at": "2026-03-11T14:32:00Z"
    }
  }
}
```

**Response 409 (driver taken):**
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "This driver has already been drafted by another player.",
    "details": { "field_errors": [{ "field": "driver_id", "message": "Max Verstappen has already been drafted." }], "meta": {} },
    "request_id": "uuid",
    "timestamp": "2026-03-10T14:32:00Z"
  }
}
```

---

# Final Consistency Checklist

- [x] All screens map to at least one flow in §5
- [x] All features map to endpoints in §11 and tables in §12
- [x] Prisma schema covers all entities
- [x] Auth rules defined per screen (§8) and per endpoint (§13)
- [x] Jolpica integration has fallback and retry behavior (§15)
- [x] Scoring logic fully specified for all 3 systems (§6.5)
- [x] DGE defined with precise business rules (§6.5)
- [x] Draft rotation rule specified (§6.4)
- [x] Snake vs regular draft sequences specified (§6.4)
- [x] 24h pick timer specified with per-player-per-round behavior (§6.4)
- [x] Auto-draft fires immediately on turn start (§6.4)
- [x] Email change hold period is admin-configurable (§6.1, §6.8)
- [x] Email uniqueness enforced; username not required unique (§6.1)
- [x] Team name unique per league, not globally (§6.3)
- [x] Notification history permanent; dismissed ≠ deleted (§6.7)
- [x] Admin override surfaced to commissioners + optional member notification (§6.2, §6.8)
- [x] Jolpica protected fields not overwritten; discrepancies logged (§6.2)
- [x] No vague adjectives — all latency, limits, and rules are numeric
- [x] Environment variables listed in Appendix C
