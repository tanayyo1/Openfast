# ReditFast Setup Checklist

Complete checklist for setting up the ReditFast development environment and workflow.

---

## Phase 1: Repository Setup (One-time)

### 1.1 Clone Repository

- [ ] Fork repository (if contributing)
- [ ] Clone to local machine:
  ```bash
  git clone https://github.com/tanayyo1/ReditFast.git
  cd ReditFast
  ```
- [ ] Verify you're on main branch:
  ```bash
  git branch --show-current  # Should show: main
  ```

### 1.2 Install Dependencies

- [ ] Install Node.js (version 18+):
  ```bash
  node --version  # Should be v18.x.x or higher
  ```
- [ ] Install project dependencies:
  ```bash
  npm install
  ```
- [ ] Verify installation:
  ```bash
  ls node_modules  # Should exist and have packages
  ```

### 1.3 Set Up Environment Variables

- [ ] Copy environment template:
  ```bash
  cp .env.example .env.local
  ```
- [ ] Edit `.env.local` and fill in:
  - [ ] Database URL (PostgreSQL)
  - [ ] Redis URL
  - [ ] Reddit OAuth credentials (create app at https://www.reddit.com/prefs/apps)
  - [ ] OpenAI API key
  - [ ] Stripe keys (if testing payments)
  - [ ] NextAuth secret (generate random string)
  - [ ] Resend API key (for emails)

### 1.4 Set Up Database

- [ ] Ensure PostgreSQL is running (version 14+)
- [ ] Create database:
  ```bash
  createdb reditfast
  # Or use your database tool
  ```
- [ ] Run migrations:
  ```bash
  npx prisma migrate dev
  ```
- [ ] Generate Prisma client:
  ```bash
  npx prisma generate
  ```
- [ ] Seed database (optional):
  ```bash
  npx prisma db seed
  ```
- [ ] Verify database connection:
  ```bash
  npx prisma studio  # Should open browser with database view
  ```

### 1.5 Set Up Redis

- [ ] Ensure Redis is running (version 6+)
  ```bash
  redis-cli ping  # Should return: PONG
  ```
- [ ] Or sign up for Upstash (managed Redis)
- [ ] Update REDIS_URL in .env.local

### 1.6 Set Up Git Hooks

- [ ] Install husky hooks:
  ```bash
  npm run prepare
  ```
- [ ] Verify hooks are executable:
  ```bash
  ls -la .husky/
  # Should see: pre-commit, commit-msg, pre-push
  ```

---

## Phase 2: Verification (Before First Commit)

### 2.1 Run Setup Verification Script

- [ ] Run verification:
  ```bash
  ./scripts/verify-setup.sh
  ```
- [ ] Fix any issues reported
- [ ] Re-run until all checks pass

### 2.2 Test Quality Gates

- [ ] Run linting:
  ```bash
  npm run lint
  ```
- [ ] Run TypeScript check:
  ```bash
  npm run typecheck
  ```
- [ ] Run unit tests:
  ```bash
  npm run test:unit
  ```
- [ ] All checks should pass ✅

### 2.3 Test Git Hooks

- [ ] Test branch naming enforcement:
  ```bash
  git checkout -b test-branch
  git commit -m "test" --allow-empty
  # Should fail: "Invalid branch name"
  git checkout main
  git branch -D test-branch
  ```
- [ ] Test commit message format:
  ```bash
  git checkout -b feature/LIN-999-test
  git commit -m "bad message" --allow-empty
  # Should fail: "Invalid commit message format"
  ```
- [ ] Test valid workflow:
  ```bash
  git commit -m "LIN-999: Test feature" --allow-empty
  # Should succeed
  git checkout main
  git branch -D feature/LIN-999-test
  ```

### 2.4 Test Application

- [ ] Start development server:
  ```bash
  npm run dev
  ```
- [ ] Open http://localhost:3000
- [ ] Verify page loads without errors
- [ ] Check console for any warnings

---

## Phase 3: GitHub Configuration (Repository Admin)

### 3.1 Set Up Branch Protection

- [ ] Go to GitHub → Settings → Branches
- [ ] Add rule for `main`:
  - [ ] Require PR before merging
  - [ ] Require 1 approval
  - [ ] Require status checks:
    - [ ] validate-branch-name
    - [ ] lint-and-typecheck
    - [ ] unit-tests
    - [ ] integration-tests
    - [ ] security-scan
    - [ ] pr-validation
  - [ ] Include administrators
  - [ ] Block force pushes
- [ ] Add rule for `develop` (same, but may allow auto-merge)
- [ ] See docs/BRANCH_PROTECTION.md for detailed steps

### 3.2 Set Up Linear Integration

- [ ] Go to Linear → Settings → Integrations
- [ ] Install GitHub integration
- [ ] Connect to repository
- [ ] Configure status mapping:
  - [ ] PR Opened → In Review
  - [ ] PR Approved → Ready to Merge
  - [ ] PR Merged → Done
- [ ] Enable branch creation from Linear
- [ ] See docs/LINEAR_INTEGRATION.md for detailed steps

### 3.3 Configure Repository Settings

- [ ] Disable wiki (if not using)
- [ ] Enable issues (for bug reports)
- [ ] Enable discussions (for Q&A)
- [ ] Set up issue templates
- [ ] Add repository description and topics
- [ ] Upload social preview image

---

## Phase 4: Team Onboarding (Per Developer)

### 4.1 Access Setup

- [ ] Added to GitHub repository (with appropriate permissions)
- [ ] Added to Linear workspace
- [ ] Added to team Slack/Discord channels:
  - [ ] #general
  - [ ] #dev-questions
  - [ ] #deployments
- [ ] Added to Vercel team (if deploying)
- [ ] Added to Railway/Render team (for workers)

### 4.2 Tool Setup

- [ ] IDE configured:
  - [ ] Cursor IDE (recommended) - reads `.cursorrules`
  - [ ] VS Code with extensions:
    - [ ] ESLint
    - [ ] Prettier
    - [ ] Prisma
    - [ ] Tailwind CSS IntelliSense
    - [ ] TypeScript Hero
- [ ] Git configured:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "your.email@example.com"
  ```
- [ ] GitHub CLI installed (optional but helpful):
  ```bash
  gh auth login
  ```

### 4.3 Read Documentation

- [ ] Read AGENTS.md (project context)
- [ ] Read CONTRIBUTING.md (workflow rules)
- [ ] Read docs/ARCHITECTURE.md (system design)
- [ ] Read docs/API.md (API reference)
- [ ] Read docs/DECISIONS.md (architecture decisions)
- [ ] Read README.md (project overview)

### 4.4 First Contribution

- [ ] Pick a "good first issue" from Linear
- [ ] Create branch using helper script:
  ```bash
  ./scripts/create-branch.sh LIN-XXX "description"
  ```
- [ ] Make small change (e.g., update README)
- [ ] Run quality gates:
  ```bash
  ./scripts/quality-check.sh
  ```
- [ ] Commit with proper format:
  ```bash
  git commit -m "LIN-XXX: Your description"
  ```
- [ ] Push and create PR
- [ ] Get review and merge
- [ ] Celebrate first contribution! 🎉

---

## Phase 5: CI/CD Setup (DevOps)

### 5.1 GitHub Actions

- [ ] Verify CI workflow file exists: `.github/workflows/ci.yml`
- [ ] Check workflow runs on PRs
- [ ] Ensure all jobs pass
- [ ] Set up required secrets (if needed):
  - [ ] GitHub → Settings → Secrets and variables → Actions

### 5.2 Deployment Configuration

- [ ] Vercel project created and linked
- [ ] Environment variables set in Vercel:
  - [ ] Production environment
  - [ ] Preview environment
- [ ] Railway/Render project created for workers
- [ ] Deployment pipeline tested:
  - [ ] Push to develop → Deploy to staging
  - [ ] Push to main → Deploy to production (manual approval)

### 5.3 Monitoring Setup

- [ ] Sentry project created
- [ ] Sentry DSN added to environment
- [ ] PostHog project created
- [ ] PostHog key added to environment
- [ ] Error alerting configured

---

## Phase 6: Security & Compliance

### 6.1 Security Setup

- [ ] Reddit OAuth app created (not sharing with other apps)
- [ ] API keys stored securely (never in code)
- [ ] Database credentials rotated
- [ ] Redis auth enabled (if not using Upstash)
- [ ] HTTPS enforced (Vercel does this automatically)

### 6.2 Compliance

- [ ] Privacy policy created
- [ ] Terms of service created
- [ ] GDPR compliance checklist completed
- [ ] Data retention policy defined
- [ ] User data deletion process documented

### 6.3 Audit Logging

- [ ] Audit log table created (prisma/schema.prisma)
- [ ] Audit logging enabled for sensitive actions
- [ ] Log retention policy configured
- [ ] Access to logs restricted

---

## Phase 7: Testing & Quality Assurance

### 7.1 Test Coverage

- [ ] Unit tests passing (80%+ coverage for services)
- [ ] Integration tests passing (70%+ coverage for APIs)
- [ ] E2E tests created for critical flows:
  - [ ] User registration → Project creation → Roadmap generation
  - [ ] Draft creation → Approval → Scheduling → Publishing
  - [ ] Analytics viewing
- [ ] All tests running in CI

### 7.2 Code Quality

- [ ] ESLint rules configured
- [ ] Prettier formatting configured
- [ ] TypeScript strict mode enabled
- [ ] No TypeScript `any` types (except justified)
- [ ] All quality gates passing in CI

### 7.3 Security Testing

- [ ] npm audit passes (no high/critical vulnerabilities)
- [ ] Secrets scanning enabled (TruffleHog)
- [ ] No hardcoded secrets in codebase
- [ ] Workspace isolation verified (all queries scoped)

---

## Phase 8: Documentation & Communication

### 8.1 Documentation Complete

- [ ] README.md updated with current info
- [ ] API documentation complete (docs/API.md)
- [ ] Architecture documented (docs/ARCHITECTURE.md)
- [ ] ADRs created for major decisions (docs/DECISIONS.md)
- [ ] Contributing guide complete (CONTRIBUTING.md)
- [ ] Branch protection documented (docs/BRANCH_PROTECTION.md)
- [ ] Linear integration documented (docs/LINEAR_INTEGRATION.md)
- [ ] Changelog started (CHANGELOG.md)

### 8.2 Team Communication

- [ ] Slack/Discord channels created
- [ ] Team roles defined:
  - [ ] Project owner
  - [ ] Lead developer
  - [ ] Backend developers
  - [ ] Frontend developers
  - [ ] DevOps/infra
- [ ] Onboarding guide shared with team
- [ ] Code review assignments defined
- [ ] Deployment schedule communicated

### 8.3 External Communication

- [ ] Social media accounts created (Twitter, LinkedIn)
- [ ] Landing page deployed
- [ ] Waitlist/signup form working
- [ ] Support email configured
- [ ] Status page created (optional)

---

## Phase 9: Launch Preparation

### 9.1 Pre-Launch Checklist

- [ ] All critical features implemented
- [ ] No known blocking bugs
- [ ] Performance tested (load times < 3s)
- [ ] Security audit passed
- [ ] Legal docs complete (privacy, terms)
- [ ] Payment processing tested (Stripe)
- [ ] Email delivery tested (Resend)

### 9.2 Soft Launch

- [ ] Deploy to production
- [ ] Invite beta users (10-50 people)
- [ ] Monitor error rates
- [ ] Collect feedback
- [ ] Iterate based on feedback

### 9.3 Public Launch

- [ ] Product Hunt launch prepared
- [ ] Twitter/LinkedIn announcement ready
- [ ] Press kit prepared (if applicable)
- [ ] Support system ready
- [ ] Onboarding flow optimized

---

## Daily Development Checklist

Use this before starting work each day:

- [ ] Pull latest changes from main
  ```bash
  git checkout main && git pull origin main
  ```
- [ ] Check Linear for assigned issues
- [ ] Create feature branch (if starting new work)
  ```bash
  ./scripts/create-branch.sh LIN-XXX "description"
  ```
- [ ] Or checkout existing branch
  ```bash
  git checkout feature/LIN-XXX-description
  ```
- [ ] Read relevant documentation
- [ ] Start development server
  ```bash
  npm run dev
  ```

---

## Pre-Commit Checklist

Run this before every commit:

- [ ] Code compiles without errors
- [ ] Run quality gates:
  ```bash
  ./scripts/quality-check.sh
  ```
  Or manually:
  - [ ] `npm run lint` passes
  - [ ] `npm run typecheck` passes
  - [ ] `npm run test:unit` passes
- [ ] No `console.log` or `debugger` statements
- [ ] Commit message follows format: `LIN-XXX: Description`
- [ ] Commit includes only related changes
- [ ] Tests added/updated for new code

---

## Pre-PR Checklist

Before creating a Pull Request:

- [ ] Branch is up to date with main
  ```bash
  git pull origin main
  ```
- [ ] All quality gates pass
- [ ] No merge conflicts
- [ ] Linear issue linked in PR title: `[LIN-XXX] Description`
- [ ] PR template filled out completely
- [ ] Description includes: `Closes LIN-XXX`
- [ ] Tests added for new features
- [ ] Documentation updated (if needed)
- [ ] Screenshots added (for UI changes)
- [ ] PR size reasonable (<500 lines)

---

## Troubleshooting Common Issues

### "Permission denied" when running scripts

```bash
chmod +x scripts/*.sh
```

### "Cannot find module" errors

```bash
npm install
```

### Git hooks not running

```bash
npm run prepare
```

### Database connection errors

- Check PostgreSQL is running
- Verify DATABASE_URL in .env.local
- Run: `npx prisma migrate dev`

### Redis connection errors

- Check Redis is running: `redis-cli ping`
- Verify REDIS_URL in .env.local

### TypeScript errors

```bash
npm run typecheck
# Fix errors, don't use @ts-ignore without justification
```

### Tests failing

```bash
npm run test:unit -- --verbose
# Check test output for details
```

---

## Resources & Quick Links

**Documentation:**

- AGENTS.md - Project context for AI
- CONTRIBUTING.md - Workflow rules
- docs/ARCHITECTURE.md - System design
- docs/API.md - API reference
- docs/DECISIONS.md - Architecture decisions

**External Services:**

- Linear: https://linear.app
- GitHub: https://github.com/tanayyo1/ReditFast
- Vercel: https://vercel.com
- Railway: https://railway.app
- Upstash: https://upstash.com

**Help:**

- Team Slack: #dev-questions
- GitHub Issues: https://github.com/tanayyo1/ReditFast/issues
- GitHub Discussions: https://github.com/tanayyo1/ReditFast/discussions

---

**Setup Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

**Last Updated:** 2026-01-30

**Questions?** Check AGENTS.md or ask in team chat.
