# Launch QA Checklist (Left-Nav App Routes)

Last updated: 2026-02-21
Owner epic: RED-83

## How to use

For each route below, verify:
- Load state renders and recovers
- Empty state explains next step
- Error state is actionable
- Success state reflects real backend data
- Primary CTA is clear and works
- No static/demo/hardcoded fake data

Mark each checkbox only after manual browser validation on localhost with worker running.

## Global prerequisites

- [ ] `docker compose up -d`
- [ ] `npm run check:launch` passes (no FAIL)
- [ ] `npm run dev` running
- [ ] `npm run worker:dev` running

## Routes

### Dashboard (`/dashboard`)
- [ ] Stats reflect live workspace data
- [ ] Priority tasks list uses live tasks
- [ ] Primary next action is obvious

### Projects (`/projects`, `/projects/[id]`, `/projects/[id]/settings`)
- [ ] Create/edit flow persists to DB
- [ ] Empty state CTA routes correctly
- [ ] Detail/settings render live project values

### Onboarding (`/onboarding`, `/onboarding/create-project`, `/onboarding/connect-reddit`)
- [ ] Step statuses reflect real completion
- [ ] Create project handles validation and success redirect
- [ ] Connect Reddit uses real OAuth and account list

### Roadmaps (`/roadmaps`, `/roadmaps/generate`, `/roadmaps/[id]`)
- [ ] Generation uses live API and handles missing prerequisites
- [ ] Generated roadmap/task list renders from DB
- [ ] Error states are explicit

### Content (`/content`, `/tasks/[id]`, `/content/drafts/[id]`)
- [ ] Draft list is API-backed
- [ ] Task->generate content flow works
- [ ] Draft edit/request-approval/approve cycle works end-to-end

### Approvals (`/approvals`)
- [ ] Reviewing drafts load correctly
- [ ] Approve action updates state and messaging
- [ ] Empty state links to next valid step

### Scheduling (`/scheduling`, `/scheduling/calendar`, `/scheduling/queue`)
- [ ] Approved drafts can be scheduled
- [ ] Queue shows correct status transitions
- [ ] Cancel/delete actions enforce state guards

### Analytics (`/analytics`, `/analytics/projects/[id]`)
- [ ] Data source shown correctly (rollup/live)
- [ ] Empty/entitlement states are clear
- [ ] Charts/trends reflect backend payloads

### Health (`/health`)
- [ ] Account cards use live snapshots/checks
- [ ] Action buttons are wired or explicitly disabled
- [ ] Guardrail copy matches backend behavior

### Opportunities (`/opportunities`)
- [ ] Feed is live API-backed (no hardcoded rows)
- [ ] Create-from-opportunity action works
- [ ] Error/empty states are actionable

### Brand Monitoring (`/brand-monitoring`)
- [ ] Project scope switch works
- [ ] Snapshot/cards/mentions are live
- [ ] Entitlement gating is correct

### Landing Pages (`/landing-pages`)
- [ ] Generate action creates draft via API
- [ ] Archive action updates list correctly
- [ ] Empty/error states are clear

### Reddit Ads (`/ads`)
- [ ] Campaign create/list/update actions work
- [ ] Validation errors are specific
- [ ] State transitions enforce backend guards

### Settings (`/settings`)
- [ ] Sign-out ends real session and redirects
- [ ] No demo-reset functionality remains

## Regression commands

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test:core-loop`
- [ ] `npm run test:integration -- --runInBand --testPathPattern='projects|roadmaps|reddit-oauth|scheduled-posts|e2e-smoke'`

## Notes

Use this file as PR acceptance criteria for RED-84..RED-91.
