# Contributing to ReditFast

Thank you for your interest in contributing to ReditFast! This document contains **strict workflow rules** that must be followed. Violations will be blocked by automated systems.

---

## MANDATORY WORKFLOW (ZERO EXCEPTIONS)

### 1. The Golden Rules

**NEVER:**

- Commit directly to `main` or `develop` branches
- Push code without a Linear issue
- Skip the quality gates (lint, typecheck, test)
- Merge your own PR without review
- Commit secrets, tokens, or passwords

**ALWAYS:**

- Create feature branches with Linear issue IDs
- Run quality checks before committing
- Get at least 1 human review before merging
- Update Linear issue status when PR is opened/merged
- Test your changes thoroughly

---

### 2. Workflow Overview

```
Linear Issue Created
        ↓
git checkout -b feature/LIN-XXX-description
        ↓
Make Changes + Write Tests
        ↓
Run Quality Gates (all must pass):
  npm run lint
  npm run typecheck
  npm run test:unit
        ↓
git commit -m "LIN-XXX: Description"
        ↓
git push origin feature/LIN-XXX-description
        ↓
Create Pull Request (use template)
        ↓
Request Review
        ↓
Address Feedback
        ↓
All Checks Pass + Approved
        ↓
Merge to main
        ↓
Deploy to Staging
        ↓
Deploy to Production
```

---

### 3. Branch Naming Convention (STRICT)

**Format:** `type/LIN-XXX-short-description`

**Types:**

- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical production fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates

**Examples:**

```bash
# Good
feature/LIN-123-add-scheduler
bugfix/LIN-456-fix-oauth-timeout
docs/LIN-789-update-api-reference

# Bad (will be rejected)
feature/add-scheduler          # Missing Linear ID
LIN-123-add-scheduler          # Missing type
my-feature                     # Missing type and Linear ID
feature/lin-123-add-scheduler  # lowercase 'lin'
```

**Command:**

```bash
git checkout -b feature/LIN-XXX-your-description
```

---

### 4. Commit Message Format (ENFORCED)

**Format:**

```
LIN-XXX: Brief imperative description (50 chars max)

- Detailed explanation if needed (wrap at 72 chars)
- Include what changed and why
- Reference related issues or PRs

Refs: LIN-XXX
```

**Good Examples:**

```bash
# Simple commit
LIN-123: Add scheduler service for delayed posts

# Detailed commit
LIN-456: Fix Reddit OAuth token refresh failure

- Updated token refresh logic to handle 401s
- Added retry with fallback to reconnect flow
- Improved error logging for debugging

Refs: LIN-456
```

**Bad Examples:**

```bash
# Missing Linear ID
Added scheduler service

# Wrong format (past tense)
LIN-123: Added scheduler service

# Wrong format (lowercase)
lin-123: add scheduler service

# Wrong format (no space after colon)
LIN-123:Add scheduler service
```

**Git Hook Enforcement:**
The commit-msg hook will reject invalid formats. If you need to bypass (emergency only):

```bash
git commit -m "LIN-XXX: Message" --no-verify  # WARNING: Only in emergencies
```

---

### 5. Pre-Commit Checklist

**Before every commit, run:**

```bash
# 1. Check branch name
git branch --show-current  # Should be: feature/LIN-XXX-description

# 2. Pull latest changes
git pull origin main

# 3. Run quality gates
npm run lint          # ESLint - zero errors
npm run typecheck     # TypeScript - zero errors
npm run test:unit     # All tests pass
npm run format:check  # Prettier formatting

# 4. Check for forbidden patterns
# - No console.log
# - No debugger statements
# - No hardcoded secrets
```

**All checks must pass before committing.** The pre-commit hook will block commits that fail.

---

### 6. Creating a Pull Request

**Step 1: Push your branch**

```bash
git push origin feature/LIN-XXX-description
```

**Step 2: Create PR on GitHub**

- Use the PR template (automatically populated)
- Title format: `[LIN-XXX] Brief description`
- Fill out all sections
- Link Linear issue: `Closes LIN-XXX` or `Relates to LIN-XXX`

**Step 3: Request review**

- Assign at least 1 reviewer
- Tag relevant team members
- Add appropriate labels

**Step 4: Address feedback**

- Make requested changes
- Commit with same format: `LIN-XXX: Address review feedback`
- Push updates
- Re-request review

**Step 5: Merge**

- Only after:
  - All CI checks pass
  - At least 1 approval
  - No conflicts with main
  - Linear issue linked
  - PR template complete

**Merge options:**

- Use "Squash and merge" for clean history
- Use "Merge commit" for feature branches with multiple logical commits
- NEVER use "Rebase and merge" (it breaks Linear linking)

---

### 7. Quality Gates (NON-NEGOTIABLE)

**These must pass before any PR can be merged:**

```bash
# 1. Linting
npm run lint
# Zero ESLint errors

# 2. TypeScript
npm run typecheck
# Zero TypeScript errors

# 3. Unit Tests
npm run test:unit
# Minimum 80% coverage for services
# All tests must pass

# 4. Integration Tests
npm run test:integration
# All tests must pass

# 5. Formatting
npm run format:check
# All files properly formatted

# 6. Security
npm audit --audit-level=moderate
# No high/critical vulnerabilities
```

**If checks fail:**

1. Fix the issues
2. Commit fixes
3. Push updates
4. Checks will re-run automatically

---

### 8. Security Requirements

**FORBIDDEN (will result in immediate rejection):**

- Committing `.env` files
- Hardcoding API keys, tokens, or passwords
- Logging sensitive data (tokens, PII)
- Disabling auth checks for "testing"
- Skipping encryption for sensitive data
- Testing against real Reddit in development

**REQUIRED:**

- Encrypt Reddit tokens at rest (AES-256)
- Hash IP addresses in logs
- Scope all DB queries by `workspace_id`
- Validate all inputs with Zod
- Use parameterized queries (Prisma)
- Sanitize user-generated content
- Never expose stack traces in production

**Security Checklist for every PR:**

- [ ] No secrets in code
- [ ] No sensitive data in logs
- [ ] Workspace isolation maintained
- [ ] Input validation added
- [ ] Rate limiting considered

---

### 9. Testing Requirements

**Test Coverage Minimums:**

| Component      | Minimum Coverage | Test Types        |
| -------------- | ---------------- | ----------------- |
| Services       | 80%              | Unit tests        |
| Utilities      | 90%              | Unit tests        |
| API Routes     | 70%              | Integration tests |
| UI Components  | 50%              | Unit + E2E        |
| Critical Flows | 100%             | E2E tests         |

**Running Tests:**

```bash
# Unit tests
npm run test:unit

# Unit tests with coverage
npm run test:unit -- --coverage

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test
```

**Test File Locations:**

```
tests/
├── unit/
│   └── services/
│       └── scheduler.service.test.ts
├── integration/
│   └── api/
│       └── projects.test.ts
└── e2e/
    └── flows/
        └── complete-workflow.spec.ts
```

**NEVER test against real Reddit:**

- Use mocks for Reddit API
- Use test database for integration tests
- Never use production credentials in tests

---

### 10. Code Standards

**TypeScript:**

- Strict mode enabled
- No `any` types (unless absolutely necessary with justification)
- Proper typing for all function parameters and returns
- Interfaces for object shapes

**Naming:**

- Files: `kebab-case.ts` (e.g., `roadmap-service.ts`)
- Components: `PascalCase.tsx` (e.g., `Dashboard.tsx`)
- Functions: `camelCase` (e.g., `generateRoadmap()`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `MAX_POSTS_PER_DAY`)
- Types/Interfaces: `PascalCase` with descriptive names

**Documentation:**

- JSDoc for all public functions
- Comments for complex business logic
- README updates for user-facing changes
- API documentation for new endpoints

**Error Handling:**

```typescript
// Good
throw new AppError("Failed to generate roadmap", "ROADMAP_GENERATION_FAILED", {
  projectId,
  error: error.message,
});

// Bad
throw error;
console.log(error); // Never use console.log
```

---

### 11. Documentation Updates

**When to update documentation:**

- [ ] AGENTS.md - If workflow patterns change
- [ ] docs/API.md - If endpoints change
- [ ] docs/DECISIONS.md - If architectural decisions made
- [ ] README.md - If user-facing features added
- [ ] CHANGELOG.md - For releases

**Documentation Checklist:**

- [ ] New features documented
- [ ] API changes documented with examples
- [ ] Environment variables added to .env.example
- [ ] Breaking changes noted with migration guide

---

### 12. Database Changes

**Adding/modifying database schema:**

1. Update `prisma/schema.prisma`
2. Generate migration:
   ```bash
   npx prisma migrate dev --name descriptive_name
   ```
3. Test migration locally:
   ```bash
   npx prisma migrate reset  # WARNING: Destroys data
   ```
4. Include migration file in PR
5. Document breaking changes
6. Provide rollback plan

**Naming migrations:**

- Good: `add_scheduled_posts_table`, `add_risk_score_to_drafts`
- Bad: `migration1`, `update`, `fix`

---

### 13. Emergency Procedures

**If you commit to main by accident:**

```bash
# DON'T PANIC - Don't push more changes
# 1. Notify team immediately in Slack
# 2. Team lead will handle revert
# 3. Do NOT try to fix it yourself
```

**If you commit secrets:**

```bash
# 1. IMMEDIATELY notify security team
# 2. Rotate the exposed secret immediately
# 3. Follow incident response plan
# 4. NEVER try to hide it
```

**If CI checks fail:**

```bash
# 1. Check the error message
# 2. Fix the issue locally
# 3. Commit the fix
# 4. Push - checks will re-run
# 5. NEVER disable checks to "get it through"
```

**If you need to bypass hooks (EMERGENCY ONLY):**

```bash
# WARNING: Only in true emergencies
# Must get approval from team lead first
git commit -m "LIN-XXX: Emergency fix" --no-verify
```

---

### 14. Common Mistakes to Avoid

**Branch Management:**

- DO NOT: Working directly on main
- DO NOT: Long-lived feature branches (>1 week)
- DO NOT: Not pulling main before creating branch
- DO: Short, focused branches
- DO: Regular rebasing on main

**Commits:**

- DO NOT: Committing broken code "to save progress"
- DO NOT: Giant commits with 20+ files
- DO NOT: Commit messages like "fix" or "update"
- DO: Atomic commits (one logical change)
- DO: Descriptive commit messages

**PRs:**

- DO NOT: PRs with 1000+ lines changed
- DO NOT: Mixing unrelated changes
- DO NOT: Missing Linear issue link
- DO: Single concern per PR
- DO: Proper description and context

**Testing:**

- DO NOT: "I'll add tests later"
- DO NOT: Testing only happy path
- DO NOT: Not running tests locally
- DO: Tests with the feature
- DO: Edge case coverage

---

### 15. Getting Help

**If you're stuck:**

1. Check AGENTS.md for patterns
2. Check docs/DECISIONS.md for architecture
3. Ask in Slack #dev-questions
4. Comment on the Linear issue
5. Schedule pair programming session

**Before asking:**

- [ ] Read relevant documentation
- [ ] Search existing code for examples
- [ ] Try to solve it yourself first
- [ ] Prepare specific questions

---

### 16. Setup Checklist for New Contributors

**Initial Setup:**

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/ReditFast.git
cd ReditFast

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Set up database
npx prisma migrate dev
npx prisma db seed

# 5. Set up git hooks
npm run prepare

# 6. Verify setup
npm run lint
npm run typecheck
npm run test:unit

# 7. Start development
npm run dev
```

**Verify hooks are working:**

```bash
# Try committing to main (should fail)
git checkout main
git commit -m "test"  # Expected: blocked

# Try invalid branch (should fail)
git checkout -b my-feature
git commit -m "test"  # Expected: blocked

# Try invalid commit message (should fail)
git checkout -b feature/LIN-999-test
git commit -m "bad message"  # Expected: blocked

# Try valid workflow (should work)
git commit -m "LIN-999: Add test feature"  # Expected: pass
```

---

### 17. Tools & Resources

**Development Tools:**

- **Cursor IDE** - Reads `.cursorrules` automatically
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Type checking
- **Husky** - Git hooks
- **Jest** - Unit testing
- **Playwright** - E2E testing

**Documentation:**

- AGENTS.md - Project context for AI
- docs/ARCHITECTURE.md - System design
- docs/API.md - API reference
- docs/DECISIONS.md - ADRs

**External Services:**

- Linear - Issue tracking
- GitHub - Code hosting
- Vercel - Frontend hosting
- Railway/Render - Backend hosting
- Supabase/Neon - Database
- Upstash - Redis

---

### 18. Recognition

Contributors will be:

- Listed in README.md contributors section
- Mentioned in release notes
- Invited to team Discord/Slack
- Given shoutouts in community updates

**First-time contributors:**

- Welcome message in PR
- Extra review guidance
- Help with any questions

---

### 19. License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Quick Reference Card

**Create Branch:**

```bash
git checkout -b feature/LIN-XXX-description
```

**Quality Gates:**

```bash
npm run lint && npm run typecheck && npm run test:unit
```

**Local CI (required before PR):**

```bash
npm run ci:local
```

Prerequisites for `ci:local` (integration tests require these):

```bash
docker compose up -d
npx prisma migrate deploy
npm run db:seed
```

If these are missing, `ci:local` can fail with setup errors unrelated to your code changes.

Note: `test:ci-local` currently includes `--detectOpenHandles --forceExit`.
`--detectOpenHandles` keeps leaks visible in output; `--forceExit` is a temporary guard so local CI can finish reliably while remaining open handles are cleaned up.

**Commit:**

```bash
git commit -m "LIN-XXX: Description"
```

**Push & PR:**

```bash
git push origin feature/LIN-XXX-description
# Create PR on GitHub with template
```

**Emergency:**

```bash
# Contact team lead immediately
# Don't try to fix alone
```

---

**Questions?** Check AGENTS.md or ask in Slack #dev-questions

**Last Updated:** 2026-01-30
