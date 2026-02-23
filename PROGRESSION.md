# PROGRESSION.md - MediaFast Clone MVP Tracker

> **Last Updated**: 2026-02-23
> **Target**: `mediafast_clone_system_design_report.md`
> **Current Estimate**: ~99% of overall parity complete (MVP complete; Tier 2 complete; Tier 3 complete for planned scope; Tier 4 planned items shipped; remaining work is optional hardening/polish)

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
- [x] Analytics ingest hardened with auth/source validation, required anonymous session IDs, and dedicated ingest rate limits.

### Queue + Worker Baseline

- [x] Queues present: `reddit.publish`, `reddit.metrics_fetch`, `reddit.ads_sync`, `subreddit.ingest`, `subreddit.compute_time_windows`, `dead.letter`.
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

### Recent Hardening Batch (Merged 2026-02-20, PR #101)

- [x] Cron backlog checks made resilient to queue resolver failures and partial task failures.
- [x] Billing checkout redirect handling tightened (success + cancel validation against allowed origins).
- [x] Polar webhook workspace resolution hardened against ambiguous subscription identity lookups.
- [x] Provider-level unique constraint enforced for subscription identity (`provider`, `provider_subscription_id`).
- [x] Stripe webhook moved to explicit deprecated behavior (default `410`) with optional temporary legacy ack flag.
- [x] Demo rewrite flow made consistent for `mode/tone/length` propagation and persisted rewrite params.

### Recent Launch Readiness + Auth UX Hardening Batch (2026-02-20)

- [x] Added launch readiness command (`npm run check:launch`) with DB/Redis/Supabase/reddit-redirect/migration/token-key validation.
- [x] Hardened auth bootstrap and login/signup flows with friendly network/auth error mapping (including Supabase fetch/DNS failures).
- [x] Added auth error mapping unit coverage and setup verification script improvements to reduce false-positive "healthy" reports.
- [x] Updated setup docs/examples to include required Reddit callback path and token encryption key requirements.

### Recent Public Tool Wiring (2026-02-21)

- [x] Wired `/tools/post-generator` page to live API flow with request validation UX, result rendering, and error handling.
- [x] Wired `/tools/subreddit-analyzer` page to live API flow with queue/cached-state handling, risk/policy display, and input validation.
- [x] Wired `/tools/shadowban-check` page to live API flow with visibility diagnostics, validation/error handling, and route-level edge-case tests.

### Recent Activation Instrumentation + Core-Loop Gate (2026-02-23)

- [x] Added client analytics event emitter (`/api/analytics/events`) wiring for homepage view, signup start/completion, onboarding step completions, and roadmap generation completion.
- [x] Added workspace funnel `ttfv` (time-to-first-value) metrics (`sampleSize`, `avg/p50/p90/min/max` in minutes) to `/api/analytics/funnel`.
- [x] Added mandatory `test:core-loop` CI job as a dedicated release gate that runs `tests/integration/api/e2e-smoke.test.ts` with DB + Redis.

### Recent Activation UX 3-Step Flow (OAK-913, 2026-02-23)

- [x] Added shared 3-step onboarding flow header (`OnboardingFlowHeader`) with progress bar and deterministic step links.
- [x] Updated onboarding step pages (`/onboarding/create-project`, `/onboarding/connect-reddit`) to use guided step framing and reduced cognitive load copy.
- [x] Added dedicated onboarding step-3 route (`/onboarding/generate-roadmap`) and wired onboarding CTA flow to use it.
- [x] Updated onboarding progress routing to prefer onboarding step-3 path before completion, then route completed users to `/roadmaps`.
- [x] Added regression coverage for new onboarding step-3 routing and onboarding-mode roadmap form behavior.

### Recent Public Surface Repositioning (OAK-915, 2026-02-23)

- [x] Repositioned homepage messaging around safety, low ban risk, and speed-to-value for founders.
- [x] Updated homepage proof cards, value pillars, and CTA copy to reflect conversion-first positioning.
- [x] Tightened free-tool positioning copy across post generator, subreddit analyzer, and shadowban checker.
- [x] Added conversion bridge sections on all public tools with direct CTA into signup/pricing and next-step tool flow.

### Recent ICP + Pricing Packaging V1 (OAK-912, 2026-02-23)

- [x] Reworked `/pricing` package copy around explicit ICP fit (`best for` / `not for`) to reduce ambiguous plan selection.
- [x] Aligned public plan feature bullets with real backend entitlement limits from `limitsForPlan` to prevent pricing drift.
- [x] Added shared safety baseline messaging (compliance checks + mandatory human approval) across both public plans.
- [x] Wired Pro CTA to live billing checkout API with robust unauthenticated fallback to signup and explicit provider/config error messaging.
- [x] Added unit coverage for pricing CTA checkout edge cases (unauthorized redirect, provider/config failures, duplicate-click race lock).

### Recent Core App Live-Data Wiring (2026-02-21)

- [x] Replaced `useDemoStore` on `/dashboard`, `/projects`, `/projects/[id]`, and `/projects/[id]/settings` with workspace-scoped server-side data from Prisma.
- [x] Added page-level unit coverage for auth guard propagation, empty workspace state, and project not-found handling.
- [x] Replaced `useDemoStore` on `/roadmaps`, `/roadmaps/[id]`, and `/roadmaps/generate` with workspace-scoped live data and API-backed roadmap generation.
- [x] Replaced `useDemoStore` on `/content`, `/content/drafts/[id]`, `/tasks/[id]`, and `/approvals` with live API-backed draft/task/approval lifecycle flows and state-guarded actions.
- [x] Replaced scheduling demo flows with live API actions on `/scheduling`, `/scheduling/calendar`, and `/scheduling/queue` (schedule, cancel, delete, and live status summaries).

### Recent Opportunities Live-Wiring (RED-84)

- [x] Wired `/opportunities` page to live workspace/project APIs (`/api/projects`, `/api/projects/:id/opportunities`, `/api/tasks/from-opportunity`) with loading, empty, and actionable error states.
- [x] Added stale-state hardening for create-from-opportunity flows (handles `OPPORTUNITY_NOT_AVAILABLE` and `OPPORTUNITY_NOT_FOUND`, refreshes live feed, and avoids cross-project race updates).
- [x] Added UX guard to prevent project-scope switching while a create action is in flight, reducing accidental race conditions.
- [x] Added regression coverage for RED-84 page behavior and opportunities query validation (`tests/unit/components/OpportunitiesPage.test.tsx`, `tests/unit/api/projectOpportunitiesRoute.test.ts`).

### Recent Health Actions Hardening (RED-85)

- [x] Added live `Refresh health snapshot` account action on `/health` cards (calls `GET /api/reddit/accounts/:id/health`) with explicit queued/fresh/no-snapshot feedback.
- [x] Hardened health-card action states so visibility checks are explicitly disabled when permalink is missing and all account actions lock while a request is in flight.
- [x] Improved `/health` empty state with direct CTA to connect a Reddit account (`/onboarding/connect-reddit`) so action flow stays explicit.
- [x] Aligned guardrail API behavior for restricted accounts (`recommendCommentsOnly: true`) and added edge-case coverage for restricted/inactive + low-health scenarios.
- [x] Added RED-85 regression tests for health actions UI and risk-health APIs (`tests/unit/components/HealthAccountActions.test.tsx`, `tests/unit/api/redditAccountHealthRoute.test.ts`, `tests/integration/api/risk-health-tools.test.ts`).
- [x] Completed follow-up strict audit fixes: robust non-JSON API error handling in health actions, duplicate-click race lock, delayed refresh to preserve notices, future-dated snapshot requeue logic, invalid snapshot-score handling, and workspace-membership account resolution.

### Recent Onboarding Progress Hardening (RED-86)

- [x] Replaced static onboarding checklist with workspace-backed progress states (complete/current/blocked) on `/onboarding`.
- [x] Added deterministic next-step CTA driven by live workspace data (projects, active Reddit accounts, active roadmaps).
- [x] Added workspace-missing guard state to prevent confusing dead-end actions while membership sync is incomplete.
- [x] Added onboarding progress unit coverage (`tests/unit/lib/onboardingProgress.test.ts`) for all step transition edge cases.

### Recent Dashboard Continue-Flow Hardening (RED-87)

- [x] Added deterministic continuation logic (`src/lib/dashboardContinueAction.ts`) that prioritizes setup, approvals, scheduling, draft edits, task execution, queue monitoring, and analytics fallback.
- [x] Wired `/dashboard` to render a live "Continue where you left off" card and dynamic primary CTA from workspace state.
- [x] Added unit coverage (`tests/unit/lib/dashboardContinueAction.test.ts`) plus dashboard data loader coverage for continuation precedence/output.

### Recent Header UX Cleanup (RED-88)

- [x] Replaced placeholder workspace switcher/search/notifications with live workspace identity and functional actions only on the app header.
- [x] Added mobile navigation menu (`src/components/app/AppMobileMenu.tsx`) and moved sidebar navigation to desktop-only rendering in `AppShell`.
- [x] Centralized app navigation config in `src/components/app/navConfig.ts` to keep sidebar and mobile menu consistent.
- [x] Added unit coverage for header data loading/plan labeling edge cases (`tests/unit/lib/appHeaderData.test.ts`).

### Recent Copy + IA Cleanup (RED-89)

- [x] Reorganized app navigation into grouped IA sections (Plan, Execution, Growth, Insights) with centralized config used by both sidebar and mobile menu.
- [x] Standardized route/page naming to title case for key surfaces (`Brand Monitoring`, `Account Health`, `Workspace Actions`).
- [x] Replaced ambiguous demo wording with explicit local-mode wording on auth/onboarding/settings flows to reduce user confusion during non-production runs.
- [x] Added navigation config unit coverage (`tests/unit/lib/navConfig.test.ts`) for section order, route uniqueness, and critical label assertions.

### Recent Queue/Worker Visibility Hardening (RED-90)

- [x] Added workspace-scoped queue health API (`GET /api/scheduling/queue-health`) with strict workspace auth and resilient error handling.
- [x] Added queue health service (`src/lib/ops/workspaceQueueHealth.ts`) that computes status counts, due/overdue/stale signals, and severity (`OK/WARNING/CRITICAL`) with configurable thresholds.
- [x] Wired `/scheduling` and `/scheduling/queue` pages to display live queue health status/reasons alongside existing scheduling metrics.
- [x] Added unit coverage for queue health severity derivation and route auth/error behavior (`tests/unit/lib/workspaceQueueHealth.test.ts`, `tests/unit/api/schedulingQueueHealthRoute.test.ts`).

### Recent Left-Nav Route QA Hardening (RED-91)

- [x] Added deterministic active-route matching helper (`isNavItemActive`) shared by desktop and mobile navigation.
- [x] Updated desktop sidebar to show active route state (`aria-current="page"`) and keep quick-link highlight behavior consistent with the mobile menu.
- [x] Expanded nav config tests with explicit nested-route activation assertions.
- [x] Added route-coverage regression test (`tests/unit/lib/navRouteCoverage.test.ts`) to fail when any left-nav link points to a non-existent app route template.
- [x] Added `LEFT_NAV_QA_CHECKLIST.md` manual QA checklist for desktop/mobile navigation route verification.

### Recent Free Tool Post-Generator Quality Upgrade

- [x] Switched `/api/tools/post-generate` to OpenAI-first generation with deterministic fallback only when LLM output is unavailable/insufficient.
- [x] Added explicit generation source reporting (`openai` vs `fallback`) and surfaced that state in the public tool UI.
- [x] Upgraded public post generator inputs with goal selection (`awareness`, `feedback`, `launch`, `case-study`) and persisted input memory in local storage.
- [x] Reworked fallback output quality using distinct angle templates and discussion-oriented copy to avoid repetitive placeholder-style phrasing.
- [x] Added route-level regression coverage for OpenAI success path and fallback enforcement (`tests/unit/api/postGenerateToolRoute.test.ts`).

### Recent Project Scope + Quota Hardening (RED-97/RED-98)

- [x] Enforced workspace-scoped DB writes for project PATCH/DELETE by switching to workspace-filtered write guards.
- [x] Hardened project creation quota checks against concurrent request races via per-workspace transactional locking.
- [x] Added integration coverage for cross-workspace write rejection and concurrent create quota behavior.

### Recent Recommendation Quality Batch (Merged 2026-02-20, PR #106)

- [x] RED-62 discovery ranking quality pass merged (intent weighting, broad-audience penalty refinement, reason quality improvements).
- [x] Ranking edge-case hardening merged (constraint-negation handling, 2-letter niche tokens like `ai`, unknown-policy conservative risk handling).
- [x] Compatibility hardening merged for roadmap reason summaries when recommendation reasons are stored as arrays.
- [x] Added regression tests for ranking + roadmap reason edge cases.

### Recent Comment Automation Batch (RED-59)

- [x] Added Smart Post Finder opportunity feed API: `GET /api/projects/:id/opportunities` (workspace-scoped project access + recommendation-scoped thread filtering + score/risk/velocity labels).
- [x] Added automation API: `POST /api/tasks/from-opportunity` (creates COMMENT task from opportunity, creates COMMENT draft scaffold, and queues content generation variants).
- [x] Added route-level tests for both opportunity feed and task-from-opportunity flows, including queue-unavailable fallback behavior.

### Recent Analytics Rollup Batch (RED-36)

- [x] Added reusable dashboard snapshot computation service (`src/lib/analytics/dashboardSnapshot.ts`) to isolate workspace-wide dashboard metrics aggregation.
- [x] Added daily workspace rollup persistence/read path on `analytics_events` (`src/lib/analytics/rollups.ts`) with deterministic rollup IDs and strict payload validation.
- [x] Updated dashboard analytics API to prefer recent rollups with live-compute fallback (`GET /api/analytics/dashboard` returns `source: "rollup" | "live"` and `generatedAt`).
- [x] Wired daily rollup execution into cron scheduler (`daily_analytics_rollups`) with partial-failure alerting.
- [x] Added regression tests for rollup persistence/batch edge cases and dashboard route stale-rollup fallback.

### Recent Analytics UI Live Data Batch (RED-37)

- [x] Replaced `/analytics` page demo-store metrics with workspace-scoped server-backed analytics data using rollup/live fallback source metadata.
- [x] Replaced `/analytics/projects/:id` demo-store view with live project analytics from published item snapshots and scheduled status aggregates.
- [x] Extracted shared analytics libraries for reuse across API + UI (`src/lib/analytics/dashboardData.ts`, `src/lib/analytics/projectSnapshot.ts`) to keep route/page data logic consistent.
- [x] Updated analytics route tests and reran analytics + e2e smoke coverage after refactor.

### Recent Analytics Time-Series Batch (RED-38)

- [x] Added daily trend services for workspace/project performance snapshots with bounded day windows and one-snapshot-per-item-per-day aggregation (`src/lib/analytics/trends.ts`).
- [x] Extended dashboard analytics loaders/API with trend series payload (`trend[]`) and optional `days` query support.
- [x] Extended project analytics loaders/API with trend series while preserving paginated item payload (`limit`, `cursor`, `days`).
- [x] Upgraded `/analytics` and `/analytics/projects/:id` pages to render backend-driven trend sparklines from time-series data.
- [x] Added and updated analytics unit tests for trend clamping/mapping and loader integration (`tests/unit/lib/trends.test.ts`, `tests/unit/lib/dashboardData.test.ts`, `tests/unit/lib/projectSnapshot.test.ts`).

### Recent Reddit Ads Foundation Batch (RED-52)

- [x] Added Reddit Ads campaign data model + migration (`reddit_ad_campaigns`) with workspace/project/account relations and status/objective enums.
- [x] Added workspace-scoped campaign APIs: list/create/get/update with cursor pagination, transition guards, and activation requirements.
- [x] Added in-app Reddit Ads management surface (`/ads`) with campaign creation and lifecycle actions.
- [x] Added RED-52 unit + integration test coverage, including archived-project activation and inactive-account pause edge cases.

### Recent Reddit Ads External Sync Batch (RED-52 follow-up)

- [x] Added `reddit.ads_sync` queue plumbing + deterministic job IDs and enqueue helpers for campaign lifecycle/config sync events.
- [x] Added async external sync worker path (`processRedditAdsSyncJob`) with stale-job protection, DLQ forwarding, and persisted `syncError` diagnostics.
- [x] Added external sync adapter (`src/lib/redditAds/externalSync.ts`) with deterministic mock mode by default and optional webhook mode via env vars.
- [x] Wired campaign PATCH flow to enqueue sync on meaningful ACTIVE/PAUSED/COMPLETED/ARCHIVED changes and expose sync state in `/ads` UI (`externalCampaignId`, `syncError`).
- [x] Extended RED-52 tests for sync enqueue behavior and queue/id helper coverage.

### Recent Onboarding Reliability Batch (RED-92/RED-93)

- [x] Replaced `/onboarding/create-project` demo-store writes with workspace API persistence (`POST /api/projects`) plus in-flight/save-error UX.
- [x] Added URL normalization guardrails for project create/update APIs (trim + auto-https + explicit URL validation errors).
- [x] Added workspace-scoped local-mode Reddit connect endpoint (`POST /api/reddit/accounts/dev-connect`) with encrypted placeholder tokens for pre-API onboarding.
- [x] Reworked `/onboarding/connect-reddit` to use live account API data instead of demo store, including refresh/retry and continue gating from persisted accounts.

### Recent Landing Page Generator Batch (RED-58)

- [x] Added landing page draft data model + migration (`landing_page_drafts`) with workspace/project scoping.
- [x] Added workspace-scoped project APIs for landing page generation/list/update (`/api/projects/:id/landing-pages` and `/api/projects/:id/landing-pages/:landingPageId`).
- [x] Added reusable generation service (`src/lib/landingPages/generate.ts`) with OpenAI-first generation and deterministic fallback mode.
- [x] Added app surface at `/landing-pages` for generating, reviewing, and archiving landing page drafts.
- [x] Added RED-58 unit + integration tests, including includeArchived query parsing regression coverage.

---

## 2) What Is Partial

- [x] ~~Roadmap generation exists, but currently creates stub tasks~~ → Roadmap generate worker + cron integrated.
- [x] ~~Scheduling UI exists, but backend scheduling/publish pipeline is not implemented~~ → Full scheduling + publish pipeline done.
- [x] ~~Analytics UI exists, but report-level analytics APIs/pipeline are not implemented~~ → Dashboard + project + account + funnel + validation APIs done.
- [x] ~~Subreddit intelligence models exist in schema, but ingest/compute jobs and APIs are missing~~ → Ingest worker + rules parser + policy extraction + time windows all done.

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
- [x] Build recommendation endpoints: `POST /projects/:id/recommend-subreddits`, `GET /projects/:id/recommendations`, `POST /projects/:id/recommendations/select`.
- [x] Implement `subreddit.ingest` queue + worker.
- [x] Implement rules ingestion + parser into derived policy flags (rulesParser.ts → SubredditPolicy with promo/link/flair/text-only flags).
- [x] Implement subreddit stats aggregation (daily stats via cron ingest + synthetic time-window estimation from subscriber/active-user signals).
- [x] Implement `subreddit.compute_time_windows` queue + worker.
- [x] Return “best 5 subreddit recommendations” based on project + risk + time windows.

## P2 - AI Content Pipeline (Report-Parity APIs)

- [x] Add task-centric content endpoints: `POST /tasks/:id/generate-content`, `GET /tasks/:id/content`, `PATCH /tasks/:id/content`.
- [x] Implement `content.generate` queue + worker.
- [x] Connect OpenAI generation to subreddit rules + project voice.
- [x] Generate 3+ variants with risk reasons + suggested fixes.
- [x] Add rewrite mode and compliance transformation endpoint.

## P3 - Account Health + Visibility Checks

- [x] Add health snapshot + visibility check persistence if missing in schema.
- [x] Implement `risk.account_health` queue + worker.
- [x] Implement `risk.visibility_check` queue + worker.
- [x] Build APIs: `GET /reddit/accounts/:id/health`, `POST /reddit/accounts/:id/visibility-check`.
- [x] Surface health warnings in app UX (blocking high-risk publish attempts).

## P4 - Free Tools Backend + Rate Limiting

- [x] Implement free tool APIs: `POST /tools/post-generate`, `GET /tools/subreddit-analyzer`, `POST /tools/shadowban-check`.
- [x] Add per-IP and per-user rate limiting for public tools.
- [x] Connect tool responses to real intel/risk services instead of static/demo behavior.

## P5 - Billing / Entitlements

- [x] Implement billing checkout + webhook processing (Polar primary, Stripe deprecated endpoint retained for compatibility).
- [x] Enforce plan quotas (projects, Reddit accounts, scheduled posts, AI generations).
- [x] Add entitlement checks on all quota-sensitive APIs (quotas: projects, reddit_accounts, scheduled_posts, ai_generations; flags: hasAdvancedAnalytics on 5 analytics routes, hasSmartFinder on discover/recommend, roadmapDays on roadmap creation).

## P6 - Admin/Ops Essentials

- [x] Basic job monitor endpoints + internal status page.
- [x] Ingestion status/lag visibility.
- [x] Prompt template management (minimum internal CRUD or config-based versioning).
- [x] Alerting hooks for failed publish and queue backlog (emitOpsAlert on all 9 worker failure handlers + periodic 10-min backlog/failed-accumulation checks in cron scheduler).

## P7 - Missing Queue/Cron Parity from Report

- [x] Add queues: `recommendations.generate`, `roadmap.generate`, `content.generate`, `subreddit.ingest`, `subreddit.compute_time_windows`, `risk.account_health`, `risk.visibility_check`.
- [x] Add cron triggers: daily ingest, daily time-window compute, 30-min metrics refresh, daily reminders.

## P8 - Test Coverage to Support MVP Confidence

- [x] Integration tests for scheduled-post APIs and publish lifecycle.
- [x] Integration tests for analytics endpoints.
- [x] Integration tests for recommendations + content generation flow.
- [x] Worker tests for retry behavior and failure classification.
- [x] E2E smoke flow: create project → connect Reddit → generate roadmap → create draft → approve → schedule → publish → view analytics → health check (tests/integration/api/e2e-smoke.test.ts).

---

## 4) Sprint Priority (Updated 2026-02-15)

### Tier 1 - Must Ship First (In Todo on Linear)

1. RED-30: Subreddit rules fetch + cache (DONE - Reddit fetch + Redis/memory cache + fallback)
2. RED-29: Account health snapshot (DONE - snapshot scoring + tier updates + stale refresh queueing)
3. RED-35: Distributed locks + rate limits (DONE - Redis locks in publish worker + fallback rate-limit enforcement)
4. RED-39: OpenAI client + prompt templates (DONE - OpenAI wrapper + DB-backed prompt template service + content worker LLM path)
5. RED-40: Draft generation + compliance scoring (DONE - variant-level compliance scoring + safest-variant selection)
6. RED-48: Value-check scoring (DONE - value density scoring integrated into compliance risk penalties)
7. RED-63: Post structure validator (DONE - grade/score/warnings/rewrite suggestions + public docs)
8. RED-55: Comment-first mode for new accounts (DONE - UI + API + safety tier gating)

### Tier 2 - Differentiation (Completed for current scope)

- RED-62: Subreddit discovery tool (DONE - discovery API + ingest queueing + ranking quality hardening + edge-case tests)
- RED-53: Tone classifier (DONE - classifier + worker integration + unit tests)
- RED-41: Draft rewrite (DONE - rewrite API flow + queue/worker handling + unit/integration tests)
- RED-49: Subreddit fit score (DONE - fit/risk/time weighted ranking and recommendation scoring outputs)
- RED-51: Anti-pattern detector (DONE - vote manipulation / engagement-gating / repetition signals added to draft compliance scoring)
- RED-56: Pain point extractor (DONE - project/subreddit pain-point extraction from thread candidates + persisted insights + API endpoints)
- RED-50: Community engagement threshold (DONE - subreddit-level comment threshold gate at schedule + publish with explicit API/worker errors)

### Tier 3 - Polish (Backlog, Medium priority)

- RED-54: Reddit profile optimization checklist and guide (DONE - checklist scoring API + onboarding guide section)
- RED-57: Demand scorecard (DONE - project demand scorecard API from recommendation + pain-point signals + onboarding guide)
- RED-59: Comment automation (DONE - backend opportunity feed + create comment task/draft automation APIs + tests; additional UI polish can continue in Tier 3)
- RED-60: Mobile preview (DONE - draft editor now includes a Reddit-style mobile preview card for post/comment drafts, with component tests)
- RED-61: Brand monitoring (DONE - `GET /api/projects/:id/brand-monitoring` with workspace + entitlement guardrails, keyword/sentiment/urgency scoring from thread candidates, and app surface at `/brand-monitoring`)

### Tier 4 - Post-MVP (Backlog, Low priority)

- RED-36: Analytics rollup foundation (DONE - daily workspace rollups + dashboard rollup read/fallback + cron trigger + tests)
- RED-37: Analytics UI live data (DONE - dashboard + project analytics pages now server-backed, no demo-store dependency)
- RED-38: Analytics time-series follow-up (DONE - daily workspace/project trend services + API surfaces + UI sparkline integration + tests)
- RED-52 (DONE - campaign planning/lifecycle + external sync queue/worker path + sync-state surfacing), RED-58 (DONE - landing page generator API + app UI + tests)

### Remaining from Original Plan

- ~~P5: Billing/entitlements (Stripe)~~ DONE (migrated to Polar)
- ~~P6: Admin/ops~~ DONE
- ~~P7: Queue/cron parity~~ DONE
- ~~P8: Test coverage~~ DONE

---

## 5) Definition of "MVP Working" (for this repo)

- [x] User can sign up/login and sync workspace user.
- [x] User can create project and connect Reddit.
- [x] User gets recommendations + roadmap tasks.
- [x] User can generate/edit draft variants and request/approve.
- [x] User can schedule approved draft and worker publishes successfully.
- [x] Metrics are ingested and visible in analytics.
- [x] Risk checks block unsafe posting attempts.
- [x] Free tools endpoints are live and rate-limited.

> **All MVP checkboxes complete as of 2026-02-20.** Remaining work is Tier 4 backlog and ongoing hardening/perf polish.
