# CLAUDE.md - Rules for Claude Code

> **Last Updated**: 2026-02-05
> **Project**: ReditFast - Reddit Marketing Automation Platform
> **Linear Team**: RED (RedditFast)

---

## CRITICAL: Read Before ANY Work

**STOP. Before touching any code:**

1. Read `AGENTS.md` for full project context
2. Check Linear issue for requirements
3. Verify you're on a feature branch (NOT main)
4. Pull latest: `git pull origin main`

---

## Git Workflow (ABSOLUTE - NO EXCEPTIONS)

### NEVER Commit to Main

**ALWAYS create a feature branch:**

```bash
git checkout main
git pull origin main
git checkout -b feature/RED-XXX-description
```

### Branch Naming (STRICT)

| Type | Format | Example |
|------|--------|---------|
| Feature | `feature/RED-XXX-desc` | `feature/RED-46-error-boundary` |
| Bugfix | `bugfix/RED-XXX-desc` | `bugfix/RED-99-oauth-fix` |
| Hotfix | `hotfix/RED-XXX-desc` | `hotfix/RED-101-critical` |
| Docs | `docs/RED-XXX-desc` | `docs/RED-50-api-docs` |

### Workflow

```
Linear Issue
    ↓
git checkout -b feature/RED-XXX-desc
    ↓
Make changes + Write tests
    ↓
npm run lint && npm run typecheck && npm run test
    ↓
git commit -m "RED-XXX: Description"
    ↓
git push origin feature/RED-XXX-desc
    ↓
Create PR → Request Review → Wait for Approval
    ↓
Merge after approval
```

---

## Before Opening PR (MANDATORY)

Run ALL of these - they MUST pass:

```bash
npm run typecheck    # Zero TypeScript errors
npm run lint         # Zero ESLint errors
npm run test         # All tests pass
npm run format:check # Prettier formatting
```

---

## Commit Messages

**Format:**
```
RED-XXX: Brief imperative description

- Detail 1
- Detail 2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Examples:**
```
RED-46: Add root error boundary and not-found components

- Add src/app/error.tsx for root-level error handling
- Add src/app/not-found.tsx for 404 pages

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## PR Format

```markdown
## Summary
- What changed and why

## Linear Issue
Closes RED-XXX

## Changes
- Change 1
- Change 2

## Test Plan
- [ ] Tested locally
- [ ] Unit tests pass
- [ ] Integration tests pass

## Checklist
- [ ] Branch named correctly (feature/RED-XXX-desc)
- [ ] All quality gates pass
- [ ] Documentation updated (if needed)
```

---

## Linear Integration

### API Access

Linear API key is in `.env.local`:
```bash
LINEAR_API_KEY="lin_api_..."
```

### Status Updates

| Action | Linear Status |
|--------|---------------|
| Start work | "In Progress" |
| Open PR | "In Review" |
| PR merged | "Done" |

### Workflow State IDs (for API calls)

- Backlog: `2a66d404-78ea-42a2-97aa-92793f16deb8`
- Todo: `92e9be21-abd4-428d-b544-fc2a072fab69`
- In Progress: `69ce9fef-6bf3-4c3d-b1ef-fe4b15cfa227`
- In Review: `1cdde51c-75f5-456c-a53f-1458056df176`
- Done: `51500d5d-3522-4ad5-b528-e32fa786c9d0`

---

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── api/              # API routes
│   ├── (app)/            # Authenticated app pages
│   └── (public)/         # Public pages
├── components/           # React components
│   └── ui/               # shadcn/ui components
├── lib/                  # Utility libraries
│   ├── prisma.ts         # Database client
│   ├── redis.ts          # Redis client
│   ├── auth.ts           # Auth utilities
│   └── reddit/           # Reddit integration
├── services/             # Business logic (if exists)
└── workers/              # Background job processors
```

---

## Tech Stack Quick Reference

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL (Prisma ORM) via Supabase
- **Cache/Queue**: Redis + BullMQ
- **Auth**: Supabase Auth + Reddit OAuth
- **Styling**: TailwindCSS + shadcn/ui
- **AI**: OpenAI GPT-4

---

## Security Rules (ZERO TOLERANCE)

### NEVER

- Commit `.env` or `.env.local`
- Log tokens, passwords, API keys, or PII
- Bypass workspace isolation in DB queries
- Disable auth checks
- Store plaintext tokens
- Commit directly to main

### ALWAYS

- Encrypt Reddit tokens at rest
- Scope DB queries by `workspace_id`
- Validate inputs with Zod
- Use parameterized queries (Prisma)

---

## Code Quality Rules

- **TypeScript strict mode** - No `any` types
- **No console.log** in production (use logger)
- **No debugger statements**
- **No commented-out code** (delete it)
- **No hardcoded secrets**
- **JSDoc comments** for public functions

---

## Forbidden Patterns

These will be rejected:

- Committing to main directly
- `any` types in TypeScript
- `// @ts-ignore` without explanation
- Hardcoded API keys or secrets
- console.log in production code
- Skipping tests
- PRs > 500 lines without justification

---

## Testing Requirements

```bash
npm run test           # All tests
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests
```

**NEVER test against real Reddit** - use mocks.

---

## Common Commands

```bash
# Development
npm run dev            # Start dev server
npm run db:studio      # Open Prisma Studio
npm run db:migrate     # Run migrations

# Quality checks
npm run typecheck      # TypeScript check
npm run lint           # ESLint
npm run format         # Prettier format
npm run format:check   # Check formatting

# Testing
npm run test           # Run all tests
```

---

## Quick Checklist Before Any PR

- [ ] On feature branch (NOT main)
- [ ] Branch named: `feature/RED-XXX-desc`
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] Commits reference Linear ID
- [ ] PR links to Linear issue
- [ ] Requested review

---

## If You Mess Up

**Committed to main by accident:**
1. Don't panic, don't push more
2. Tell the user immediately
3. They will handle the revert

**Committed secrets:**
1. IMMEDIATELY notify user
2. Secret must be rotated
3. Never try to hide it

---

## References

- Full project context: `AGENTS.md`
- Architecture details: `docs/ARCHITECTURE.md`
- API documentation: `docs/API.md`
- Decisions log: `docs/DECISIONS.md`
- Linear setup: `.linear/README.md`

---

> **Remember**: Branch → PR → Review → Merge. Never skip steps.
