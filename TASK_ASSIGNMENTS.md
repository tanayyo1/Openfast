# Task Assignments - ReditFast Auth & Setup Phase

> **Status**: Post-PR Merge Task Distribution  
> **Date**: 2026-02-01  
> **Branch**: feature/LIN-001-strict-workflow-rules → main

---

## ✅ COMPLETED (In Current PR)

### Authentication System (100% Complete)

- [x] Supabase Auth integration
- [x] Login/Signup pages migrated
- [x] User sync API (`/api/auth/sync`)
- [x] Middleware for route protection
- [x] Session management with SupabaseProvider

### Database Architecture (100% Complete)

- [x] Hybrid database setup (local dev + Supabase prod)
- [x] Prisma schema updated with authId field
- [x] Environment configuration (.env, .env.local, .env.production)
- [x] pgvector extension enabled in Supabase

### Documentation (100% Complete)

- [x] TODO.md created with project tracking
- [x] .env.example updated with Supabase vars
- [x] AGENTS.md updated with auth status
- [x] Database architecture documented

---

## 📝 TASK ASSIGNMENTS

### **@frontend-dev** - UI/UX Improvements

**Priority**: High | **Due**: This week

- [ ] **Loading States** (2 hrs)
  - Add loading spinners to login/signup buttons
  - Show skeleton screens while auth state loads
  - Handle "checking session" state gracefully

- [ ] **Error Handling** (3 hrs)
  - Better error messages for auth failures
  - Network error retry logic
  - Session expiration UI ("Your session expired, please login again")

- [ ] **Auth Guards** (2 hrs)
  - Protect /dashboard, /projects, /settings routes
  - Redirect unauthenticated users to /login with `?next=` param
  - Handle 403/401 errors

**Files to modify**:

- `src/app/(public)/login/page.tsx`
- `src/app/(public)/signup/page.tsx`
- `src/middleware.ts` (enhance redirects)
- `src/components/ui/loading.tsx` (create)

---

### **@backend-dev** - API & Integration

**Priority**: High | **Due**: This week

- [ ] **Email Confirmation Flow** (4 hrs)
  - Configure email provider in Supabase (Resend)
  - Create /verify-email page
  - Handle confirmed vs unconfirmed users
  - Test email delivery

- [ ] **Password Reset** (3 hrs)
  - Create /forgot-password page
  - Create /reset-password page
  - Integrate Supabase password reset API
  - Test full flow

- [ ] **User Profile API** (3 hrs)
  - PATCH /api/user/profile (update name, email)
  - POST /api/user/change-password
  - DELETE /api/user/account (with confirmation)

**Files to create/modify**:

- `src/app/(public)/forgot-password/page.tsx`
- `src/app/(public)/reset-password/page.tsx`
- `src/app/(public)/verify-email/page.tsx`
- `src/app/api/user/*` (new routes)

---

### **@reddit-dev** - Reddit OAuth Integration

**Priority**: Medium | **Due**: Next week

- [ ] **Configure Reddit OAuth in Supabase** (1 hr)
  - Add Reddit as OAuth provider in Supabase Dashboard
  - Configure redirect URI: `http://localhost:3000/api/auth/callback/reddit`
  - Get Reddit app credentials from https://www.reddit.com/prefs/apps

- [ ] **Refactor Reddit OAuth Flow** (4 hrs)
  - Update `/api/reddit/oauth/start` to use Supabase
  - Update `/api/reddit/oauth/callback` to use Supabase
  - Store Reddit tokens in our database (encrypted)
  - Link Reddit accounts to users

- [ ] **Reddit Account Management** (2 hrs)
  - UI to connect/disconnect Reddit accounts
  - Show connected Reddit usernames
  - Handle token refresh

**Files to modify**:

- `src/app/api/reddit/oauth/start/route.ts`
- `src/app/api/reddit/oauth/callback/route.ts`
- `src/app/(app)/settings/page.tsx` (add Reddit connection UI)

---

### **@qa-dev** - Testing & Verification

**Priority**: High | **Due**: This week

- [ ] **Auth Flow Testing** (3 hrs)
  - Test signup with email/password
  - Test login with valid credentials
  - Test login with invalid credentials (error handling)
  - Test logout
  - Test protected routes

- [ ] **Database Sync Testing** (2 hrs)
  - Verify user created in Supabase Auth
  - Verify user synced to local database
  - Verify workspace created automatically
  - Check auth_id linking

- [ ] **Integration Tests** (4 hrs)
  - Write tests for `/api/auth/sync`
  - Write tests for login flow
  - Write tests for protected routes
  - Add to `tests/integration/api/`

**Commands**:

```bash
npm run test:integration
npm run test:e2e
```

---

### **@devops-dev** - Production Setup

**Priority**: Medium | **Due**: Next week

- [ ] **Production Database Verification** (1 hr)
  - Confirm Supabase production database has all tables
  - Run `npx prisma db push` on production
  - Verify pgvector extension enabled

- [ ] **Environment Variables Setup** (1 hr)
  - Add production env vars to Vercel/Railway
  - Verify DATABASE_URL uses Supabase pooler
  - Test production build locally

- [ ] **Backup Strategy** (2 hrs)
  - Document Supabase backup settings
  - Set up automated backups in Supabase Dashboard
  - Test restore process

---

## 🎯 CURRENT SPRINT GOAL

**Complete auth system + user management by end of week**

**Definition of Done**:

- [ ] User can signup with email/password
- [ ] User can login/logout
- [ ] User can reset password
- [ ] Email confirmation works (if enabled)
- [ ] Protected routes work correctly
- [ ] All tests passing
- [ ] Documentation updated

---

## 🚨 BLOCKERS / DEPENDENCIES

- **@frontend-dev** needs auth API endpoints from @backend-dev for error handling
- **@reddit-dev** needs Supabase OAuth configured before coding
- **@qa-dev** can start testing once @frontend-dev completes UI

---

## 📞 DAILY STANDUP QUESTIONS

1. What did you complete yesterday?
2. What are you working on today?
3. Any blockers or need help?

---

## 📚 RESOURCES

- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth
- **TODO.md**: See remaining tasks in detail
- **.env.example**: Environment variable reference
- **scripts/verify-auth.ts**: Run to check setup

---

## ✅ ACCEPTANCE CRITERIA

Before marking task complete:

- [ ] Code follows project conventions (see AGENTS.md)
- [ ] Tests written and passing
- [ ] PR created with Linear issue reference
- [ ] Reviewed by at least 1 teammate
- [ ] No console errors
- [ ] Works in both dev and production modes

---

**Questions?** Ask in Slack #dev-questions or comment on Linear issues.
