# Architecture Decision Records (ADRs)

This document tracks major architectural decisions and their rationale.

## ADR-001: Human-in-the-Loop for All Reddit Posts

**Status:** Accepted  
**Date:** 2026-01-30

### Context

We need to prevent user bans on Reddit while still providing automation value.

### Decision

All posts require explicit user approval before scheduling. No auto-posting by default.

### Rationale

- Reddit mods can ban for "spammy" behavior even if technically allowed
- Automation without approval feels inauthentic
- Legal/compliance risk if we auto-post without consent
- Differentiates us from "bot" tools

### Consequences

- Positive: Safer, more compliant, better UX
- Negative: Users must actively engage with tool daily
- Mitigation: Mobile app for quick approvals (future)

### Alternatives Considered

- Auto-post with high safety threshold (rejected: still risky)
- Opt-in auto-post for trusted accounts (rejected: complexity)

---

## ADR-002: Prisma ORM Over Raw SQL

**Status:** Accepted  
**Date:** 2026-01-30

### Context

Need to choose database access layer for PostgreSQL.

### Decision

Use Prisma ORM with TypeScript client.

### Rationale

- Type-safe queries
- Auto-generated migrations
- Excellent DX with schema-first approach
- Built-in connection pooling
- Strong ecosystem integration with Next.js

### Consequences

- Positive: Faster development, fewer bugs, team onboarding
- Negative: Less control over complex queries (mitigation: raw queries when needed)

### Alternatives Considered

- Drizzle (newer, less mature)
- Knex (more manual, less type-safe)
- Raw SQL (error-prone)

---

## ADR-003: BullMQ for Job Queue

**Status:** Accepted  
**Date:** 2026-01-30

### Context

Need reliable background job processing for roadmap generation, publishing, analytics.

### Decision

Use BullMQ (Redis-based) for job queues.

### Rationale

- Mature, well-maintained
- BullMQ Pro has rate limiting built-in
- Excellent observability (RedisInsight, Arena UI)
- Idempotent job support
- Delayed jobs (critical for scheduling)

### Consequences

- Positive: Reliable scheduling, horizontal scaling, good monitoring
- Negative: Redis dependency (acceptable, we use Redis anyway)

### Alternatives Considered

- Inngest (serverless functions, less control)
- Temporal (heavy, complex)
- SQS/RabbitMQ (more infra overhead)

---

## ADR-004: pgvector for Vector Search

**Status:** Accepted  
Date: 2026-01-30

### Context

Need vector similarity search for subreddit matching, duplicate detection.

### Decision

Use pgvector (PostgreSQL extension) instead of dedicated vector DB.

### Rationale

- One less database to manage
- ACID compliance with relational data
- Good enough performance for our scale (10K-100K vectors)
- Simpler backups, one source of truth

### Consequences

- Positive: Simpler stack, consistent backups, joins with relational data
- Negative: May need migration if scale > 1M vectors (future problem)

### Alternatives Considered

- Pinecone (managed, more expensive)
- Weaviate (more features than needed)
- Milvus (too heavy)

---

## ADR-005: Next.js App Router

**Status:** Accepted  
Date: 2026-01-30

### Context

Choosing Next.js routing paradigm.

### Decision

Use Next.js 14 App Router, not Pages Router.

### Rationale

- Server Components by default (better performance)
- Built-in layouts and loading states
- Server Actions for mutations
- Future of Next.js

### Consequences

- Positive: Better performance, simpler data fetching
- Negative: Learning curve, some libraries not compatible yet
- Mitigation: Mix of App Router and API routes for external webhooks

### Alternatives Considered

- Pages Router (legacy, less performant)
- Remix (different paradigm, less ecosystem)
- SvelteKit (smaller ecosystem)

---

## ADR-006: shadcn/ui Component Library

**Status:** Accepted  
Date: 2026-01-30

### Context

Need UI component library for consistent design.

### Decision

Use shadcn/ui (copy-paste components) over installed library.

### Rationale

- Full control over components
- No dependency hell
- Tailwind-based, customizable
- Accessible by default (Radix UI primitives)
- Matches modern SaaS aesthetic

### Consequences

- Positive: Full customization, no breaking changes from updates
- Negative: More manual work for updates, larger bundle if not careful
- Mitigation: Tree-shaking, selective component imports

### Alternatives Considered

- Material UI (too opinionated, heavy)
- Chakra UI (v2/v3 transition pains)
- Ant Design (too enterprise-y)

---

## ADR-007: Reddit OAuth2 Over App-Only Auth

**Status:** Accepted  
Date: 2026-01-30

### Context

Reddit API authentication strategy.

### Decision

Use OAuth2 flow (user grants permission) rather than app-only script.

### Rationale

- Required for posting/commenting as user
- Users control their account
- More legitimate, less likely to be banned
- Better rate limits (60/min vs 100/min shared)

### Consequences

- Positive: Legitimate access, user trust, better limits
- Negative: OAuth complexity, token management, refresh logic
- Mitigation: Encrypted storage, auto-refresh, clear disconnect UI

### Alternatives Considered

- App-only script (rejected: can't post as user)
- Both (rejected: unnecessary complexity)

---

## ADR-008: Zod for Validation

**Status:** Accepted  
Date: 2026-01-30

### Context

Need runtime type validation for API inputs.

### Decision

Use Zod for all input validation.

### Rationale

- TypeScript-first, infers types
- Great error messages
- Composable schemas
- Works with React Hook Form
- Growing ecosystem

### Consequences

- Positive: Type safety end-to-end, great DX
- Negative: Runtime overhead (negligible)

### Alternatives Considered

- Yup (less TypeScript friendly)
- Joi (heavy, older)
- io-ts (complex)

---

## ADR-009: Stripe for Payments

**Status:** Accepted  
Date: 2026-01-30

### Context

Need payment processing for subscriptions.

### Decision

Use Stripe for all billing.

### Rationale

- Industry standard
- Excellent developer experience
- Built-in invoicing, tax (Stripe Tax)
- Webhook reliability
- Strong ecosystem

### Consequences

- Positive: Reliable, feature-rich, good support
- Negative: Fees, dependency on external service
- Mitigation: Webhook idempotency, local entitlements cache

### Alternatives Considered

- LemonSqueezy (simpler, less control)
- Paddle (geared toward EU)
- Custom (rejected: too much work)

---

## ADR-010: Redis for Cache + Queue + Rate Limit

**Status:** Accepted  
Date: 2026-01-30

### Context

Need caching, job queues, and rate limiting.

### Decision

Use single Redis instance for all three (Upstash managed).

### Rationale

- Simpler infrastructure
- Cost-effective at our scale
- Fast and reliable
- Managed service handles ops

### Consequences

- Positive: One service, consistent performance
- Negative: Single point of failure (mitigation: Redis Cluster/ Sentinel)
- Mitigation: Upstash replication, monitoring

### Alternatives Considered

- Separate services (rejected: unnecessary complexity)
- Memcached (no persistence)
- RabbitMQ (only queues, not cache)

---

## ADR-011: TanStack Query (React Query)

**Status:** Accepted  
Date: 2026-01-30

### Context

Need data fetching and caching in React.

### Decision

Use TanStack Query v5 (React Query).

### Rationale

- Excellent caching and background refetching
- Dev tools
- Works with Server Components
- Optimistic updates
- Pagination helpers

### Consequences

- Positive: Robust data layer, great UX
- Negative: Learning curve, bundle size (acceptable)

### Alternatives Considered

- SWR (similar, less features)
- RTK Query (Redux-based, too heavy)
- Apollo Client (GraphQL-specific)

---

## ADR-012: Resend for Email

**Status:** Accepted  
Date: 2026-01-30

### Context

Need transactional email service.

### Decision

Use Resend for email delivery.

### Rationale

- Built for developers
- Great deliverability
- Simple API
- React Email support
- Cost-effective

### Consequences

- Positive: Easy integration, good deliverability
- Negative: Newer service, smaller ecosystem than SendGrid
- Mitigation: Keep email templates simple, fallback ready

### Alternatives Considered

- SendGrid (more mature, more expensive)
- Postmark (good, pricier)
- AWS SES (complex setup)

---

## ADR-013: Separate Worker Deployment

**Status:** Accepted  
Date: 2026-01-30

### Context

Need to run background jobs reliably.

### Decision

Deploy workers as separate service (Railway/Render), not in Next.js.

### Rationale

- Next.js not designed for long-running processes
- Workers can scale independently
- Better resource allocation
- Easier monitoring
- No Vercel function timeout limits

### Consequences

- Positive: Reliable job processing, independent scaling
- Negative: More infrastructure, separate deploys
- Mitigation: Railway/Render auto-deploy from same repo

### Alternatives Considered

- Next.js API routes (timeout limits)
- Vercel Cron (limited frequency)
- Inngest (managed, less control)

---

## ADR-014: OpenAI GPT-4 for Content Generation

**Status:** Accepted  
Date: 2026-01-30

### Context

Need LLM for draft generation.

### Decision

Use OpenAI GPT-4 (turbo) as primary LLM.

### Rationale

- Best-in-class reasoning
- Good at following complex instructions
- JSON mode for structured output
- Reliable API
- Cost-effective at our scale

### Consequences

- Positive: High quality drafts, good compliance
- Negative: Cost, dependency, rate limits
- Mitigation: Caching, request batching, fallback to GPT-3.5 for simple tasks

### Alternatives Considered

- Claude 3.5 (similar quality, higher cost)
- Llama 2/3 (self-hosting complexity)
- Gemini (newer, less proven)

---

## Pending Decisions

### ADR-015: Multi-Platform Support (LinkedIn, X)

**Status:** Under consideration  
**Context:** Users asking for other platforms.

**Options:**

1. Build LinkedIn integration
2. Build X integration
3. Both
4. Neither (focus on Reddit excellence)

**Considerations:**

- Different APIs, different rules
- User demand vs. focus
- Engineering bandwidth

---

### ADR-016: Team/Agency Mode

**Status:** Under consideration  
**Context:** Users want to manage client accounts.

**Options:**

1. Build agency features (multiple clients, reporting)
2. Stay solo-founder focused
3. Partner with existing agency tools

---

## How to Add New ADRs

1. Create new section with format: `ADR-XXX: Title`
2. Include: Status, Date, Context, Decision, Rationale, Consequences
3. Consider and document alternatives
4. Update this document via PR
5. Tag with `adr` label

---

Last updated: 2026-01-30
