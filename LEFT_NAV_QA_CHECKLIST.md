# LEFT_NAV_QA_CHECKLIST.md

## RED-91 Left-Nav Route QA

Use this checklist before merge when navigation labels, routes, or page layouts change.

### 1. Automated Regression

- Run `npm run typecheck`.
- Run `npx jest tests/unit/lib/navConfig.test.ts tests/unit/lib/navRouteCoverage.test.ts --runInBand`.

### 2. Desktop Sidebar QA

- Verify each section renders in this order: `Plan`, `Execution`, `Growth`, `Insights`.
- Verify each link routes correctly and marks as active:
  - `/dashboard`
  - `/onboarding`
  - `/projects`
  - `/roadmaps`
  - `/content`
  - `/approvals`
  - `/scheduling`
  - `/opportunities`
  - `/landing-pages`
  - `/ads`
  - `/analytics`
  - `/brand-monitoring`
  - `/health`
- Verify quick links route correctly and mark active:
  - `/settings`
  - `/seo/guides/support`

### 3. Mobile Menu QA

- Open mobile nav and verify same sections/route labels as desktop.
- Verify active state updates after navigation.
- Verify menu closes after route change.

### 4. Edge-Case Checks

- Nested routes should keep parent link active (for example `/content/drafts/[id]` keeps `/content` active).
- `/dashboard/*` should not mark dashboard active unless pathname is exactly `/dashboard`.
- No duplicate hrefs in nav config.
