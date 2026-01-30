# AGENTS.md - Project Context for AI Agents

> **Last Updated**: 2026-01-30  
> **Project**: ReditFast - Reddit Marketing Automation Platform  
> **Repository**: https://github.com/tanayyo1/ReditFast

---

## Project Overview

**What**: ReditFast is a Reddit marketing automation platform that helps founders, SaaS makers, and solopreneurs grow on Reddit without getting banned.

**Core Promise**: Generate personalized roadmaps, create AI-powered content, schedule posts, and provide analytics while preventing bans through compliance-first design.

**Target Users**: Indie founders, bootstrapped SaaS companies, marketers who want organic Reddit growth.

**Business Model**: Freemium → Monthly subscription ($39/mo) + Lifetime deal ($129).

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS
- **UI Components**: shadcn/ui
- **State**: React Query (TanStack Query)
- **Animations**: Framer Motion

### Backend
- **API**: Next.js API Routes + Node.js microservices
- **Database**: PostgreSQL (via Prisma ORM)
- **Cache**: Redis (Upstash)
- **Queue**: BullMQ (Redis-based)
- **Auth**: NextAuth.js + Reddit OAuth2

### AI/ML
- **LLM**: OpenAI GPT-4 / Claude 3.5
- **Embeddings**: OpenAI text-embedding-3-small
- **Vector DB**: pgvector (PostgreSQL extension)
- **RAG**: LangChain for retrieval-augmented generation

### Infrastructure
- **Hosting**: Vercel (frontend) + Railway/Render (workers)
- **CDN**: Cloudflare
- **Storage**: Cloudflare R2 (media)
- **Email**: Resend
- **Payments**: Stripe
- **Monitoring**: Sentry + PostHog

---

## Architecture Patterns

### Service Boundaries
1. **Auth Service** - User auth, sessions, workspace membership
2. **Project Service** - Project CRUD, brand voice, goals
3. **Reddit Service** - OAuth, token management, rate limiting
4. **Roadmap Service** - Strategy generation, task planning
5. **Content Service** - AI draft generation, compliance scoring
6. **Scheduler Service** - Job queue, publishing, retries
7. **Analytics Service** - Performance tracking, attribution
8. **Notification Service** - Email, in-app alerts

### Data Flow Patterns
- **Sync**: REST API for immediate responses (CRUD, queries)
- **Async**: Job queues for background work (roadmap gen, publishing)
- **Realtime**: WebSocket/SSE for live updates (notifications, progress)

### Critical Design Decisions
- **Human-in-the-loop**: All Reddit posts require user approval before scheduling
- **Compliance-first**: Rate limiting, rule checking, ban prevention built-in
- **Workspace isolation**: Every query scoped by workspace_id
- **Idempotency**: All publish jobs use idempotency keys
- **Pacing tiers**: New accounts = conservative, established = moderate

---

## Directory Structure

```
ReditFast/
├── AGENTS.md                 # This file - AI context
├── README.md                 # Project documentation
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── next.config.js            # Next.js config
├── tailwind.config.ts        # Tailwind config
├── .env.example              # Environment template
├── .gitignore                # Git ignore rules
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/              # API routes
│   │   │   ├── auth/         # Auth endpoints
│   │   │   ├── projects/     # Project CRUD
│   │   │   ├── roadmaps/     # Roadmap generation
│   │   │   ├── drafts/       # Content generation
│   │   │   ├── scheduled-posts/  # Scheduling
│   │   │   ├── analytics/    # Analytics endpoints
│   │   │   └── webhooks/     # Stripe, etc.
│   │   ├── dashboard/        # Dashboard pages
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Landing page
│   ├── components/           # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── forms/            # Form components
│   │   └── dashboard/        # Dashboard-specific
│   ├── lib/                  # Utility libraries
│   │   ├── prisma.ts         # Database client
│   │   ├── redis.ts          # Redis client
│   │   ├── openai.ts         # OpenAI client
│   │   └── auth.ts           # Auth utilities
│   ├── services/             # Business logic
│   │   ├── auth.service.ts
│   │   ├── project.service.ts
│   │   ├── reddit.service.ts
│   │   ├── roadmap.service.ts
│   │   ├── content.service.ts
│   │   ├── scheduler.service.ts
│   │   ├── analytics.service.ts
│   │   └── notification.service.ts
│   ├── workers/              # Background job processors
│   │   ├── roadmap.worker.ts
│   │   ├── publisher.worker.ts
│   │   ├── analytics.worker.ts
│   │   └── index.ts          # Worker entry point
│   ├── types/                # TypeScript types
│   │   ├── index.ts
│   │   ├── project.ts
│   │   ├── roadmap.ts
│   │   └── reddit.ts
│   └── utils/                # Helper functions
│       ├── helpers.ts
│       ├── validators.ts
│       └── constants.ts
├── public/                   # Static assets
│   ├── images/
│   └── fonts/
├── docs/                     # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── DECISIONS.md
├── tests/                    # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── scripts/                  # Utility scripts
    ├── seed.ts
    └── migrate.ts
```

---

## Key Constraints & Guardrails

### Reddit API Limits
- **OAuth**: 60 requests per minute per user
- **Read**: 100 requests per minute per OAuth app
- **Actions**: Account-specific (varies by karma/age)

### Security Requirements
- Encrypt Reddit tokens at rest (AES-256 + KMS)
- Never log Reddit tokens or PII
- Workspace isolation on every query
- Rate limiting: API + Reddit + LLM
- Audit logs for all posting actions

### Ban Prevention System
- **Pacing tiers**:
  - New accounts (<100 karma): Max 1-2 posts/day, focus on comments
  - Established (100-1000 karma): 3-5 posts/day
  - High karma (1000+): 5-10 posts/day
- **Subreddit rules**: Preflight check before every post
- **Duplication control**: Block similar content across subreddits
- **Promo language detection**: Flag hard CTAs, over-claims
- **Human approval required**: Default mode for all posts

### Data Retention
- Reddit tokens: Until user disconnects or refresh fails
- Post content: 90 days after project deletion
- Analytics: 1 year (then aggregate only)
- Audit logs: 2 years

---

## Development Rules

### Code Standards
1. **TypeScript strict mode** - No `any` types
2. **Workspace scoping** - Every DB query must include `workspace_id`
3. **Never log secrets** - Reddit tokens, API keys redacted
4. **Idempotency** - All mutating operations include idempotency keys
5. **Error handling** - Structured errors with actionable messages
6. **Testing** - Unit tests for services, integration for APIs, E2E for flows

### Database Patterns
- Use Prisma for all DB operations
- Soft deletes where possible
- Partition large tables by date (clicks, snapshots)
- Index heavily on: workspace_id, project_id, scheduled_at

### API Patterns
- RESTful design with clear resource naming
- Consistent error format: `{ error: string, code: string, details?: object }`
- Pagination: Cursor-based for large lists
- Rate limiting headers: X-RateLimit-*

### Job Queue Patterns
- Use BullMQ with Redis
- Jobs must be idempotent
- Implement exponential backoff for retries
- Dead letter queue for permanent failures
- Distributed locks for concurrent operations

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
DIRECT_URL="postgresql://user:pass@host:5432/dbname"

# Redis
REDIS_URL="redis://host:6379"

# Reddit OAuth
REDDIT_CLIENT_ID="your_client_id"
REDDIT_CLIENT_SECRET="your_client_secret"
REDDIT_REDIRECT_URI="http://localhost:3000/api/auth/callback/reddit"

# OpenAI
OPENAI_API_KEY="sk-..."

# Stripe
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PUBLISHABLE_KEY="pk_..."

# Auth (NextAuth)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="random_secret_key"

# Email
RESEND_API_KEY="re_..."

# App
NODE_ENV="development"
APP_URL="http://localhost:3000"
```

---

## Common Tasks for AI Agents

### 1. Generate Roadmap for Project
```
Input: project_id
Flow:
1. Fetch project details + constraints
2. Retrieve candidate subreddits (vector similarity)
3. Apply filters: rules, policy, user tier
4. Generate daily tasks with best times
5. Store roadmap + tasks
Output: roadmap object with tasks[]
```

### 2. Create Draft for Task
```
Input: task_id, subreddit_id, knobs (tone, length, variant_count)
Flow:
1. Retrieve: subreddit rules + examples + brand voice
2. LLM generates title/body + variants
3. Compliance check: rules, promo language, duplication
4. Score risk (0-100) with reasons
5. Suggest fixes if needed
Output: drafts[] with risk_score + fixes
```

### 3. Schedule Post
```
Input: draft_id, reddit_account_id, scheduled_at
Flow:
1. Validate: token valid, pacing ok, quota available
2. Create scheduled_posts row with idempotency_key
3. Queue delayed job for publish
4. Return scheduled_post_id
Output: confirmation + job_id
```

### 4. Publish Post (Background)
```
Input: scheduled_post_id
Flow:
1. Acquire lock on reddit_account_id
2. Preflight: pacing, duplication, rules, token
3. Submit to Reddit API
4. Store published_item
5. Update status + release lock
6. Enqueue analytics refresh
Output: published_item or error classification
```

### 5. Refresh Analytics
```
Input: published_item_id
Flow:
1. Fetch Reddit post status
2. Update performance snapshot (score/comments)
3. Detect removals
4. Update account health metrics
5. Trigger notifications if anomalies
Output: updated snapshot + health score
```

### 6. Smart Thread Discovery
```
Input: project_id
Flow:
1. Ingest hot/new posts in target subreddits
2. Score: relevance, velocity, comment gap, risk
3. Filter top opportunities
4. Generate comment draft suggestions
Output: thread_candidates[] with drafts
```

---

## Testing Strategy

### Unit Tests (Jest/Vitest)
- Services: Business logic isolation
- Utilities: Helper functions
- Validators: Input validation

### Integration Tests
- API routes: Full request/response
- Database: Prisma operations
- External APIs: Mocked Reddit/OpenAI

### E2E Tests (Playwright)
- Critical user flows:
  - Sign up → Create project → Connect Reddit → Generate roadmap
  - Approve draft → Schedule post → Verify published
  - View analytics → Export report
- NEVER test against real Reddit (use mocks)

### Test Data
- Use factories (faker.js)
- Seed script for development
- Separate test database

---

## Monitoring & Observability

### Metrics to Track
- **Business**: Roadmaps generated, drafts created, posts published, conversion rate
- **Performance**: API latency, job queue depth, LLM cost per workspace
- **Reliability**: Publish success rate, Reddit API error rate, token refresh failures
- **Compliance**: Removal rate, risk score distribution, pacing violations

### Logging
- Structured JSON logs
- Request correlation IDs
- Sensitive data redaction
- Log levels: ERROR, WARN, INFO, DEBUG

### Alerting (PagerDuty/Slack)
- Queue backlog > 1000 jobs
- Publish failure rate > 5%
- Reddit OAuth callback errors
- Token refresh failures
- Database connection issues

---

## Security Checklist

- [ ] Encrypt Reddit tokens at rest (KMS)
- [ ] HTTPS everywhere (TLS 1.3)
- [ ] Rate limiting: API + Redis + Reddit
- [ ] Input validation (Zod schemas)
- [ ] SQL injection protection (Prisma)
- [ ] XSS protection (React escaping)
- [ ] CSRF tokens for state-changing ops
- [ ] Content Security Policy headers
- [ ] Audit logs for sensitive actions
- [ ] Data retention policies enforced
- [ ] GDPR/CCPA compliance (deletion flows)

---

## Deployment Strategy

### Development
```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### Staging
- Branch: `develop`
- Auto-deploy on push
- Test against staging Reddit app
- Full test suite runs

### Production
- Branch: `main`
- Manual approval required
- Blue/green deployment
- Database migrations: Run before deploy
- Feature flags for gradual rollout

### Infrastructure
```
Vercel (Next.js frontend + API)
  ↓
Railway/Render (Worker services)
  ↓
Supabase/Neon (PostgreSQL)
  ↓
Upstash (Redis)
  ↓
Cloudflare R2 (Object storage)
```

---

## API Surface Reference

### Auth
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
```

### Projects
```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id
```

### Reddit
```
GET  /api/reddit/oauth/start
GET  /api/reddit/oauth/callback
GET  /api/reddit/accounts
DELETE /api/reddit/accounts/:id
```

### Roadmaps
```
POST /api/roadmaps/generate
GET  /api/roadmaps/:id
GET  /api/roadmaps/:id/tasks
```

### Drafts
```
POST   /api/drafts
POST   /api/drafts/:id/rewrite
PATCH  /api/drafts/:id
DELETE /api/drafts/:id
```

### Scheduled Posts
```
POST   /api/scheduled-posts
GET    /api/scheduled-posts
PATCH  /api/scheduled-posts/:id/cancel
DELETE /api/scheduled-posts/:id
```

### Analytics
```
GET /api/analytics/projects/:id
GET /api/analytics/accounts/:id
GET /api/analytics/dashboard
```

### Webhooks
```
POST /api/webhooks/stripe
```

---

## Feature Flags & Tiers

### Free Tier
- 1 project
- 1 Reddit account
- Basic roadmap (7 days)
- 10 drafts/month
- Manual posting only
- Basic analytics

### Pro ($39/mo)
- 5 projects
- 3 Reddit accounts
- Full roadmap (30 days)
- Unlimited drafts
- Scheduling
- Advanced analytics
- Smart thread finder

### Lifetime ($129)
- Unlimited projects
- Unlimited accounts
- All Pro features
- Priority support
- Early access to new features

---

## Troubleshooting Guide

### Common Issues

**"Rate limit exceeded"**
- Check Redis rate limit counters
- Verify Reddit token hasn't expired
- Review pacing tier for account

**"Failed to publish"**
- Check preflight logs for rule violations
- Verify subreddit still exists and allows posts
- Confirm idempotency key hasn't changed

**"Roadmap generation slow"**
- Check LLM API rate limits
- Review vector DB query performance
- Consider caching popular subreddit matches

**"Analytics not updating"**
- Verify analytics worker is running
- Check Reddit API availability
- Review snapshot table for data

---

## Resources & References

### Documentation
- Reddit API: https://www.reddit.com/dev/api
- Reddit OAuth: https://github.com/reddit-archive/reddit/wiki/OAuth2
- Prisma: https://www.prisma.io/docs
- Next.js: https://nextjs.org/docs
- BullMQ: https://docs.bullmq.io/

### Design Inspiration
- MediaFast (https://www.mediafa.st/)
- Buffer (scheduling UX)
- Hootsuite (dashboard design)

---

## Changelog

- **2026-01-30**: Initial AGENTS.md creation
- Project structure defined
- Architecture patterns documented
- API surface outlined

---

## Contact & Support

- **Repository**: https://github.com/tanayyo1/ReditFast
- **Issues**: Use GitHub Issues
- **Discussions**: Use GitHub Discussions

---

> **Note for AI Agents**: When modifying this codebase, always:
> 1. Read this file first for context
> 2. Check `/docs/DECISIONS.md` for architectural decisions
> 3. Follow the directory structure conventions
> 4. Maintain workspace isolation in all DB queries
> 5. Never bypass the human-in-the-loop approval flow for posting
