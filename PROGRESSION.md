# PROGRESSION.md - MediaFast Clone MVP Tracker

> **Last Updated**: 2026-02-15
> **Target**: `mediafast_clone_system_design_report.md`  
> **Current Estimate**: ~35-40% of MVP parity complete

---

## 1) What Is Already Done

### Foundation

- [x] Next.js app with public + app route groups.
- [x] Supabase auth wiring (client/server/middleware provider pattern).
- [x] Workspace-aware auth guard (`requireWorkspaceSession`).
- [x] Prisma + Postgres schema with core MVP entities.
- [x] Redis integration and BullMQ queue base setup.

### Core APIs Implemented

- [x] Auth: register, sync, NextAuth compatibility route.
- [x] Workspaces: current workspace endpoint.
- [x] Projects: list/create/get/update/archive.
- [x] Roadmaps: list/create/get/list tasks.
- [x] Tasks: get/update status.
- [x] Drafts: list/create/get/update/archive + request-approval/approve/reject lifecycle.
- [x] RED-63: Draft structure validation API coverage (`GET /api/drafts/:id?includeStructure=1`, `PATCH /api/drafts/:id` revalidation on content edits, `POST /api/drafts/:id/validate-structure`).
- [x] Reddit OAuth: start/callback + accounts list/disconnect.

### Security / Compliance Baseline

- [x] Reddit tokens encrypted at rest (`tokenCrypto` AES-256-GCM format).
- [x] Reddit OAuth state cookie protection.
- [x] Workspace scoping applied across implemented APIs.
- [x] Human approval state machine for drafts before scheduling path.

### Queue + Worker Baseline

- [x] Queues present: `reddit.publish`, `reddit.metrics_fetch`, `subreddit.ingest`, `subreddit.compute_time_windows`, `dead.letter`.
- [x] Deterministic job IDs for idempotency.
- [x] Worker process bootstrapping + DLQ forwarding for failed jobs.
- [x] Unit tests for queue helpers and worker stubs.
- [x] RED-63: content worker persists `structureValidation` (grade, score, warnings, rewriteSuggestions) on generated drafts.

### UI Surface Present (MVP skeleton)

- [x] Public pages: home, pricing, login, signup.
- [x] Public tools pages: post generator, subreddit analyzer, shadowban check.
- [x] App pages: dashboard, projects, roadmaps, content, approvals, scheduling, analytics, health, opportunities.
- [x] SEO route scaffold: `/seo/[type]/[slug]`.
- [x] RED-63: Post structure panel with grade/score, warnings, rewrite suggestions (copy action), good/bad examples, and `/docs/post-structure` public doc route.

### Tests Present

- [x] Unit tests: token crypto, Reddit errors/rate-limit, queue helpers, worker processors.
- [x] Integration tests: projects, roadmaps/tasks, drafts approval flow, Reddit OAuth endpoints.

---

## 2) What Is Partial

- [~] Roadmap generation exists, but currently creates stub tasks (not recommendation/intel-driven).
- [~] Scheduling UI exists, but backend scheduling/publish pipeline is not implemented end-to-end.
- [~] Analytics UI exists, but report-level analytics APIs/pipeline are not implemented.
- [~] Subreddit intelligence models exist in schema, but ingest/compute jobs and APIs are missing.

---

## 3) What Is Remaining (Complete TODO to Reach Report MVP)

## P0 - Must Build Next (Core MVP Execution Path)

- [x] Implement scheduling APIs (`/api/scheduled-posts` create/list/cancel/delete).
- [x] Enforce “approved draft only” when scheduling posts.
- [x] Persist scheduled jobs with strong idempotency keys.
- [x] Implement real `reddit.publish` worker (preflight checks, Reddit submit, `published_items` write, scheduled status/error updates).
- [x] Implement real `reddit.metrics_fetch` worker (score/comments/upvote-ratio fetch, snapshot writes, removal signal updates).
- [x] Implement analytics APIs: `/api/analytics/projects/:id`, `/api/analytics/accounts/:id`, `/api/analytics/dashboard`.

## P1 - Recommendations + Intel (Required by Report Flows)

- [x] Add recommendation data model support (project↔subreddit recommendations with fit/risk/reasons).
- [ ] Build recommendation endpoints: `POST /projects/:id/recommend-subreddits`, `GET /projects/:id/recommendations`, `POST /projects/:id/recommendations/select`.
- [ ] Implement `subreddit.ingest` queue + worker.
- [ ] Implement rules ingestion + parser into derived policy flags.
- [ ] Implement subreddit stats aggregation (daily stats + freshness timestamps).
- [ ] Implement `subreddit.compute_time_windows` queue + worker.
- [ ] Return “best 5 subreddit recommendations” based on project + risk + time windows.

## P2 - AI Content Pipeline (Report-Parity APIs)

- [ ] Add task-centric content endpoints: `POST /tasks/:id/generate-content`, `GET /tasks/:id/content`, `PATCH /tasks/:id/content`.
- [ ] Implement `content.generate` queue + worker.
- [ ] Connect OpenAI generation to subreddit rules + project voice.
- [ ] Generate 3+ variants with risk reasons + suggested fixes.
- [ ] Add rewrite mode and compliance transformation endpoint.

## P3 - Account Health + Visibility Checks

- [x] Add health snapshot + visibility check persistence if missing in schema.
- [x] Implement `risk.account_health` queue + worker.
- [x] Implement `risk.visibility_check` queue + worker.
- [x] Build APIs: `GET /reddit/accounts/:id/health`, `POST /reddit/accounts/:id/visibility-check`.
- [ ] Surface health warnings in app UX (blocking high-risk publish attempts).

## P4 - Free Tools Backend + Rate Limiting

- [ ] Implement free tool APIs: `POST /tools/post-generate`, `GET /tools/subreddit-analyzer`, `POST /tools/shadowban-check`.
- [ ] Add per-IP and per-user rate limiting for public tools.
- [ ] Connect tool responses to real intel/risk services instead of static/demo behavior.

## P5 - Billing / Entitlements

- [ ] Implement Stripe checkout + webhook processing.
- [ ] Enforce plan quotas (projects, Reddit accounts, scheduled posts, AI generations).
- [ ] Add entitlement checks on all quota-sensitive APIs.

## P6 - Admin/Ops Essentials

- [ ] Basic job monitor endpoints + internal status page.
- [ ] Ingestion status/lag visibility.
- [ ] Prompt template management (minimum internal CRUD or config-based versioning).
- [ ] Alerting hooks for failed publish and queue backlog.

## P7 - Missing Queue/Cron Parity from Report

- [ ] Add queues: `recommendations.generate`, `roadmap.generate`, `content.generate`, `subreddit.ingest`, `subreddit.compute_time_windows`, `risk.account_health`, `risk.visibility_check`.
- [ ] Add cron triggers: daily ingest, daily time-window compute, 30-min metrics refresh, daily reminders.

## P8 - Test Coverage to Support MVP Confidence

- [x] Integration tests for scheduled-post APIs and publish lifecycle.
- [x] Integration tests for analytics endpoints.
- [ ] Integration tests for recommendations + content generation flow.
- [ ] Worker tests for retry behavior and failure classification.
- [ ] E2E smoke flow: signup/login -> create project -> connect Reddit -> generate roadmap -> generate draft -> approve -> schedule -> publish -> view analytics.

---

## 4) Sprint Priority (Updated 2026-02-15)

### Tier 1 - Must Ship First (In Todo on Linear)
1. RED-30: Subreddit rules fetch + cache (DONE - Reddit fetch + Redis/memory cache + fallback)
2. RED-29: Account health snapshot (DONE - snapshot scoring + tier updates + stale refresh queueing)
3. RED-35: Distributed locks + rate limits
4. RED-39: OpenAI client + prompt templates
5. RED-40: Draft generation + compliance scoring
6. RED-48: Value-check scoring
7. RED-63: Post structure validator
8. RED-55: Comment-first mode for new accounts

### Tier 2 - Differentiation (Backlog, High priority)
- RED-62: Subreddit discovery tool
- RED-53: Tone classifier
- RED-41: Draft rewrite
- RED-49: Subreddit fit score
- RED-51: Anti-pattern detector
- RED-56: Pain point extractor
- RED-50: Community engagement threshold

### Tier 3 - Polish (Backlog, Medium priority)
- RED-54, RED-57, RED-59, RED-60, RED-61

### Tier 4 - Post-MVP (Backlog, Low priority)
- RED-36/37/38 (analytics pipeline), RED-52 (Reddit Ads), RED-58 (landing page gen)

### Remaining from Original Plan
- P5: Billing/entitlements (Stripe)
- P6: Admin/ops
- P7: Queue/cron parity
- P8: Test coverage

---

## 5) Definition of “MVP Working” (for this repo)

- [ ] User can sign up/login and sync workspace user.
- [ ] User can create project and connect Reddit.
- [ ] User gets recommendations + roadmap tasks.
- [ ] User can generate/edit draft variants and request/approve.
- [ ] User can schedule approved draft and worker publishes successfully.
- [ ] Metrics are ingested and visible in analytics.
- [ ] Risk checks block unsafe posting attempts.
- [ ] Free tools endpoints are live and rate-limited.
