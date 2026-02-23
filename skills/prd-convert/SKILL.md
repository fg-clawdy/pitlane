# PRD → Ralph prd.json Converter (Ralph Loop Standard)

**Purpose**  
This skill turns a human-readable PRD (exactly like the F1ntasy v1.0 PRD) into a machine-executable `prd.json` that drives the Ralph Wiggum autonomous coding loop. The resulting JSON contains:
- Full original metadata and spec for reference
- A complete, dependency-ordered `userStories` array (the atomic tasks Ralph will pick one-by-one)
- Clear acceptance criteria, test gates, and status tracking so the loop can self-validate and stop when everything is complete.

## When Claude Should Use This Skill
- User pastes or attaches a full PRD Markdown (especially one with sections 1–20, tables, Gherkin, Mermaid, Prisma, etc.)
- User explicitly asks to prepare the PRD for Ralph / autonomous coding / prd.json
- User says “make this Ralph-ready” or “convert PRD to JSON for the loop”

## Output Requirement (Strict)
Always write the final result to `./prd.json` (or the root of the current workspace) as valid JSON.  
Never output partial JSON.  
If the PRD is extremely large, process it section-by-section internally but deliver one complete file.

## JSON Schema (Ralph Standard)
```json
{
  "meta": {
    "title": string,
    "version": string,
    "documentId": string,
    "targetRelease": string,
    "lastUpdated": string,
    "originalPRDHash": string   // for change detection
  },
  "vision": { "statement": string, "elevatorPitch": string, ... },
  "scope": {
    "inScope": string[],
    "outOfScope": string[]
  },
  "personas": [...],
  "coreFlows": [...],           // extracted from section 5
  "scoringModes": { ... },      // full scoring tables
  "technical": {
    "stack": [...],
    "architecture": string,
    "prismaSchema": string      // full Prisma code block
  },
  "userStories": [
    {
      "id": "US-001",                    // stable kebab-case or FR-xxx
      "title": string,
      "epic": string,                    // e.g. "EPIC-001 — Authentication"
      "description": string,
      "acceptanceCriteria": string[],    // one per Gherkin scenario or rule
      "dependencies": string[],          // other US- ids
      "priority": number,                // 1 = highest
      "status": "pending" | "in-progress" | "done",
      "passes": false,
      "notes": string,
      "testGates": string[]              // e.g. ["TypeScript compiles", "Unit tests pass", "E2E passes"]
    }
  ],
  "ralphConfig": {
    "stopCondition": "All userStories have passes: true AND no open data-flags",
    "defaultBranch": "ralph/main",
    "maxIterationsPerStory": 15
  },
  "fullSpecReference": string          // optional compact summary of the entire original PRD
}
```

## Step-by-Step Conversion Process (Ralph Loop Mindset)
1. **Read the entire PRD** – Treat the provided Markdown as the single source of truth.
2. **Extract metadata** (Section 1) → `meta` object.
3. **Extract vision, problem, solution, scope** (Section 2) → top-level keys.
4. **Map every traceable item**:
   - FR-xxx → one user story
   - FLOW-xxx + Gherkin scenarios → one story with acceptanceCriteria array
   - Each table row (business rules, validations, scoring) → acceptanceCriteria
   - Each screen / API endpoint / DB model → dedicated story
   - Commissioner/Admin flows, notifications, jobs → separate stories
5. **Build dependency graph** (natural order from the PRD):
   - Auth & Identity first
   - Data models & Jolpica sync
   - Leagues & members
   - Draft system (most complex → break into many small stories)
   - Scoring engine
   - Notifications, UI screens, Admin panel last
6. **Make acceptance criteria testable and atomic** – Pull directly from Gherkin, business rules, data validations, edge cases, and “Gherkin” blocks. Add Ralph-style gates (“TypeScript compiles”, “All unit tests pass”, “Playwright E2E passes”, “No console errors”).
7. **Handle special blocks**:
   - Mermaid diagrams → store as string in relevant story or fullSpecReference
   - Prisma schema → exact copy into `technical.prismaSchema`
   - Scoring tables → expand into `scoringModes` + stories for the scoring engine
8. **Validate completeness** – Every item in the original PRD’s “In Scope” and “Requirements Traceability Matrix” must map to at least one user story.
9. **Write prd.json** – Pretty-print with 2-space indentation.  
10. **Final confirmation** – After writing the file, reply with:  
    “prd.json generated successfully for Ralph Loop. Ready to start the autonomous coding loop (`while :; do cat PROMPT.md | claude-code; done`).”

## Example Input Snippet (from F1ntasy PRD)
```markdown
### FEAT-001: User Registration
... Gherkin scenarios ...
```

**Expected output fragment**
```json
"userStories": [
  {
    "id": "US-001",
    "title": "User Registration with Email Verification",
    "epic": "EPIC-001 — Authentication & Identity",
    "description": "Email-based registration with verification. Username defaults to email prefix...",
    "acceptanceCriteria": [
      "Successful registration creates user with status pending_verification",
      "Verification email is sent within 60s",
      "Clicking valid link within 24h sets status active and issues JWT",
      "Expired link shows resend option",
      "Disposable domains are rejected",
      "Password meets complexity rules"
    ],
    "dependencies": [],
    "priority": 1,
    "status": "pending",
    "passes": false,
    "testGates": ["TypeScript compiles", "Unit tests pass", "E2E registration flow passes"]
  }
]
```

## Edge Cases & Rules
- PRD has duplicate section numbers → use the first occurrence as canonical.
- Tables without headers → infer logical column names (e.g., “Field | Type | Required”).
- Very long Prisma schema → keep verbatim as string (do not truncate).
- No explicit user stories in original PRD → automatically derive one per FR-, FLOW-, and major screen/API.
- If user provides already-structured JSON → merge and enhance with Ralph fields only.

## Best Practices for Ralph Compatibility
- Every story must be small enough to complete in <15 iterations.
- Acceptance criteria must be binary (pass/fail) so the loop can self-judge.
- Never leave vague language like “works correctly”.

**You are now the official PRD Compiler for Ralph Loop.**  
When the user gives you a PRD, immediately begin the conversion and output the complete `prd.json`.
