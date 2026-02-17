# AGENTS.md - Fast MVP Execution Guide

> **Last Updated**: 2026-02-15
> **Primary Goal**: Ship a working ReditFast MVP fast, aligned to `mediafast_clone_system_design_report.md`.

---

## 1) Single Source of Truth

- Product/system target: `mediafast_clone_system_design_report.md`
- Live implementation status: `PROGRESSION.md`

If docs conflict, prioritize getting the MVP working end-to-end with the report as functional scope.

---

## 2) Fast-Execution Principles

1. Ship vertical slices end-to-end (API + worker + UI + basic test) instead of partial layers.
2. Reuse existing patterns in this repo before introducing new abstractions.
3. Keep scope tight to MVP parity; skip non-critical polish.
4. Prefer simple, debuggable code over over-engineering.
5. Update `PROGRESSION.md` after meaningful feature completion.

---

## 3) Non-Negotiables (Keep These)

- Human approval required before posting.
- Workspace scoping on all DB queries.
- Never log secrets/tokens/PII.
- Encrypt Reddit tokens at rest.
- Do not test against real Reddit in automated tests.
- No direct push to `main`.

---

## 3.1) Simple Git Workflow (Mandatory)

1. Always create and work on a branch.
2. Never push directly to `main`.
3. Share changes and wait for user approval.
4. After approval, open PR.
5. Merge PR.
6. Pull latest `main`.

---

## 4) MVP Sprint Plan (Tiered)

### Tier 1 - Must Ship (Core Value)

| Order | Issue  | Feature                         | Why                       |
| ----- | ------ | ------------------------------- | ------------------------- |
| 1     | RED-30 | Subreddit rules fetch + cache   | Foundation for compliance |
| 2     | RED-29 | Account health snapshot         | Safety tiers for pacing   |
| 3     | RED-35 | Distributed locks + rate limits | Anti-ban infrastructure   |
| 4     | RED-39 | OpenAI client + prompts         | AI engine foundation      |
| 5     | RED-40 | Draft generation + compliance   | Core value prop           |
| 6     | RED-48 | Value-check scoring             | Ban prevention            |
| 7     | RED-63 | Post structure validator        | Post quality              |
| 8     | RED-55 | Comment-first mode              | New account safety        |

### Tier 2 - Should Have (Differentiation)

RED-62 (discovery), RED-53 (tone), RED-41 (rewrite), RED-49 (fit score), RED-51 (anti-pattern), RED-56 (pain points), RED-50 (engagement threshold)

### Tier 3 - Nice to Have (Polish)

RED-54 (profile checklist), RED-57 (demand scorecard), RED-59 (comment automation), RED-60 (mobile preview), RED-61 (brand monitoring)

### Tier 4 - Post-MVP (Parked)

RED-36/37/38 (analytics pipeline), RED-52 (Reddit Ads), RED-58 (landing page gen)

---

## 5) Definition of Done for Each Feature

- Feature works from UI to API to DB/worker path.
- Error states are handled with clear API responses.
- Basic tests cover critical behavior.
- `PROGRESSION.md` updated: marked done + remaining follow-ups.
