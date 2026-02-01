# ReditFast - Project Status & TODO

> **Last Updated**: 2026-02-01  
> **Current Focus**: Supabase Auth Integration (Phase 1 Complete)

---

## Completed

### Authentication (Supabase)

- [x] Install Supabase packages (`@supabase/supabase-js`, `@supabase/ssr`)
- [x] Configure environment variables (URL + Anon Key)
- [x] Create Supabase clients (browser, server, middleware)
- [x] Implement SupabaseProvider for auth context
- [x] Update middleware for route protection
- [x] Migrate login page to Supabase Auth
- [x] Migrate signup page to Supabase Auth
- [x] Create user sync API (`/api/auth/sync`)
- [x] Update Prisma schema (add `authId` field)
- [x] Run database migration

### Infrastructure

- [x] Set up local PostgreSQL with pgvector for development
- [x] Generate Prisma client with updated schema
- [x] Start dev server successfully

---

## In Progress / Partial

### Database Connection (IPv6 Issue)

**Status**: Blocked for production deployment  
**Issue**: Supabase uses IPv6 for direct database connections, current environment doesn't support IPv6  
**Impact**: Can't connect to Supabase hosted Postgres directly from local/dev environment

**Solutions:**

1. **Enable IPv4 in Supabase** (Recommended)
   - Go to: Supabase Dashboard → Project Settings → Database
   - Enable "IPv4" add-on (free tier available)
   - Update connection string in `.env`
2. **Use Supabase REST API instead of Prisma** (Alternative)
   - Refactor all database queries to use PostgREST
   - More complex, requires significant code changes
3. **Hybrid Development Approach** (Current)
   - Local PostgreSQL for development ✓
   - Supabase Auth for authentication ✓
   - Production: Deploy to Vercel (supports IPv6)

---

## TODO - High Priority

### Auth & User Management

- [ ] **Test full auth flow**
  - Sign up with email/password
  - Verify user created in Supabase Auth
  - Verify user synced to local database
  - Verify workspace created automatically
  - Test login flow
  - Test protected routes (middleware)

- [ ] **Email Confirmation Setup**
  - Configure email provider in Supabase (Resend/SES)
  - Test email confirmation flow
  - Handle confirmed vs unconfirmed users

- [ ] **Password Reset**
  - Create forgot password page
  - Implement reset password flow
  - Test email delivery

- [ ] **User Profile Management**
  - Allow users to update name/email
  - Allow password change
  - Delete account functionality

### Reddit OAuth Integration

- [ ] **Configure Reddit OAuth in Supabase**
  - Add Reddit as OAuth provider in Supabase Dashboard
  - Configure redirect URI
  - Test OAuth flow

- [ ] **Update Reddit OAuth Flow**
  - Refactor `/api/reddit/oauth/start` to use Supabase
  - Refactor `/api/reddit/oauth/callback` to use Supabase
  - Store Reddit tokens securely

- [ ] **Reddit Account Management**
  - Link Reddit accounts to users
  - Handle token refresh
  - Disconnect Reddit account

### Database & Backend

- [ ] **Production Database Setup**
  - Decide: Supabase Postgres vs separate hosting
  - If Supabase: Enable IPv4 connection
  - Update DATABASE_URL for production

- [ ] **Database Security**
  - Set up Row Level Security (RLS) policies in Supabase
  - Configure proper user permissions
  - Audit database access patterns

- [ ] **Backup Strategy**
  - Automate database backups
  - Test restore process
  - Document backup/restore procedures

### Frontend & UI

- [ ] **Loading States**
  - Add loading indicators for auth operations
  - Handle auth state transitions smoothly

- [ ] **Error Handling**
  - Better error messages for auth failures
  - Network error handling
  - Session expiration handling

- [ ] **Auth Guards**
  - Protect all app routes properly
  - Handle unauthenticated users gracefully
  - Redirect logic improvements

### Testing

- [ ] **Unit Tests**
  - Test Supabase client functions
  - Test auth sync API
  - Test middleware

- [ ] **Integration Tests**
  - Test full signup flow
  - Test login flow
  - Test OAuth flow
  - Test protected routes

- [ ] **E2E Tests**
  - Playwright tests for critical auth flows

---

## Future Improvements (Nice to Have)

### Features

- [ ] Magic Link Authentication (passwordless)
- [ ] Social Logins (Google, GitHub, Twitter)
- [ ] Two-Factor Authentication (2FA)
- [ ] Team/Organization Support (multiple users per workspace)
- [ ] Audit Logging for all auth events
- [ ] Rate Limiting on auth endpoints
- [ ] Account Lockout after failed attempts
- [ ] Session Management (view active sessions, revoke)

### Technical Debt

- [ ] Remove NextAuth.js dependencies (if fully migrated)
- [ ] Clean up unused auth routes
- [ ] Remove demo auth cookie code (when auth is stable)
- [ ] Refactor error handling to be consistent
- [ ] Add comprehensive logging

### Performance

- [ ] Optimize database queries
- [ ] Add caching layer for auth sessions
- [ ] Implement connection pooling for production
- [ ] CDN setup for static assets

---

## Known Issues

### Critical

- **IPv6 Connection Issue**: Can't connect to Supabase Postgres directly from local environment
  - **Workaround**: Using local PostgreSQL for dev
  - **Fix**: Enable IPv4 in Supabase Dashboard or deploy to IPv6-capable platform

### Minor

- **Deprecation Warnings**: npm packages with deprecated dependencies
  - Impact: Low (development only)
  - Fix: Update packages gradually

- **Next.js Config Warning**: `experimental.serverActions` is deprecated
  - Impact: None (just a warning)
  - Fix: Remove from `next.config.js`

---

## Quick Commands Reference

```bash
# Start development
npm run dev

# Database
npx prisma migrate dev      # Create migration
npx prisma db push          # Push schema changes
npx prisma generate         # Regenerate client
npx prisma studio           # Open Prisma Studio

# Local PostgreSQL (Docker)
docker start postgres-reditfast
docker stop postgres-reditfast

# Testing
npm run test
npm run test:integration

# Lint & Format
npm run lint
npm run format
```

---

## Documentation Links

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Prisma with Supabase](https://supabase.com/partners/integrations/prisma)
- [Next.js App Router](https://nextjs.org/docs/app)
- [ReditFast AGENTS.md](./AGENTS.md)

---

## Current Sprint Goal

**Complete authentication system with Supabase + verify all flows work correctly**

**Definition of Done:**

- User can sign up with email/password
- User can login
- User is created in both Supabase Auth and local database
- Protected routes work correctly
- Session management works
- Ready for Reddit OAuth integration

---

## Notes

- **Supabase Project**: https://jurqrtflthffrirxpiyf.supabase.co
- **Local Dev URL**: http://localhost:3000
- **Database**: Local PostgreSQL (dev) / Supabase Postgres (prod - pending IPv4)

**Next immediate action**: Test the signup/login flow and verify user sync works
