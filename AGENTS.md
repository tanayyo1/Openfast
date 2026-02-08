# AGENTS.md - Fast MVP Execution Guide

> **Last Updated**: 2026-02-08  
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

## 4) MVP Build Order (From Report)

1. Foundation: auth, projects, Reddit OAuth, workspace scoping, rate limits.
2. Subreddit intel + recommendations.
3. Roadmap + AI draft generation.
4. Scheduling + publish worker + metrics pipeline.
5. Analytics dashboards and endpoints.
6. Risk/account health and visibility checks.
7. Free tools APIs + SEO surfaces.

---

## 5) Definition of Done for Each Feature

- Feature works from UI to API to DB/worker path.
- Error states are handled with clear API responses.
- Basic tests cover critical behavior.
- `PROGRESSION.md` updated: marked done + remaining follow-ups.
