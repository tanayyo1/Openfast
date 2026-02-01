# Developer Quick Reference

> **⚡ TL;DR**: New dev? Run `./scripts/setup-local.sh` and you're done in 5 minutes.

---

## 🚀 New Developer? Start Here!

**Just joined the team?** Follow this in order:

1. **📖 Read**: This file (5 min)
2. **⚙️ Setup**: Run `./scripts/setup-local.sh` (5 min)
3. **✅ Verify**: Run `npx tsx scripts/verify-auth.ts` (30 sec)
4. **🎯 Start**: Check [TASK_ASSIGNMENTS.md](./TASK_ASSIGNMENTS.md) for your tasks

**Total time to first commit**: ~15 minutes

---

## 📚 Documentation Map

| File                          | Purpose                          | Read When             |
| ----------------------------- | -------------------------------- | --------------------- |
| **README.md**                 | Project overview, quick start    | First thing           |
| **SETUP.md**                  | Detailed setup instructions      | If setup script fails |
| **QUICKSTART.md** (this file) | Quick reference, cheat sheet     | Daily reference       |
| **AGENTS.md**                 | Technical architecture, patterns | Before coding         |
| **TASK_ASSIGNMENTS.md**       | Team tasks, who does what        | When picking up work  |
| **TODO.md**                   | Project status, blockers         | For project overview  |
| **CONTRIBUTING.md**           | How to contribute, git workflow  | Before first PR       |

---

## 💻 Daily Development Commands

```bash
# Start everything
npm run dev

# Check if setup is working
npx tsx scripts/verify-auth.ts

# Database stuff
npx prisma studio          # View/edit database
npx prisma db push         # Push schema changes
npx prisma generate        # Regenerate client

# Testing
npm run test              # Run all tests
npm run test:integration  # API tests

# Code quality
npm run lint              # Check for errors
npm run format            # Fix formatting
npm run typecheck         # TypeScript check
```

---

## 🐳 Docker Commands

```bash
# Start local database
docker-compose up -d

# Stop everything
docker-compose down

# Reset database (⚠️ deletes data!)
docker-compose down -v

# View logs
docker-compose logs -f postgres
```

---

## 🎯 Common Tasks

### **Add a new API route**

```bash
# Create file
src/app/api/your-route/route.ts

# Follow pattern from existing routes
# Check src/app/api/projects/route.ts as example
```

### **Add a database table**

1. Edit `prisma/schema.prisma`
2. Run `npx prisma db push`
3. Run `npx prisma generate`

### **Add a new page**

```bash
# Public page (no auth required)
src/app/(public)/your-page/page.tsx

# App page (auth required)
src/app/(app)/your-page/page.tsx
```

### **Fix "Database connection failed"**

```bash
# Option 1: Restart database
docker-compose restart

# Option 2: Reset everything
docker-compose down -v
./scripts/setup-local.sh
```

---

## 🔥 Quick Fixes

| Problem                | Solution                                             |
| ---------------------- | ---------------------------------------------------- |
| `npm install` fails    | Delete `node_modules` and `package-lock.json`, retry |
| Database won't connect | Run `docker-compose up -d`                           |
| Prisma errors          | Run `npx prisma generate`                            |
| Port 3000 in use       | `lsof -ti:3000 \| xargs kill -9`                     |
| Env vars missing       | Check `.env.local` exists                            |
| Build fails            | Run `npm run typecheck` for errors                   |

---

## 🆘 Getting Help

**Stuck?**

1. Check [SETUP.md](./SETUP.md) troubleshooting section
2. Check [TODO.md](./TODO.md) known issues
3. Ask in Slack #dev-questions
4. Check if issue exists in GitHub Issues

**Found a bug?**

1. Check if it's in [TODO.md](./TODO.md)
2. Create GitHub Issue
3. Mention it in Slack #dev-issues

**Need clarification?**

- Architecture questions → Read AGENTS.md
- Setup questions → Read SETUP.md
- Task questions → Check TASK_ASSIGNMENTS.md

---

## 📖 Reading List (In Order)

**Day 1 - Onboarding:**

1. README.md (overview)
2. SETUP.md (get running)
3. AGENTS.md (understand architecture)

**Day 2 - First Task:** 4. TASK_ASSIGNMENTS.md (find your task) 5. CONTRIBUTING.md (learn git workflow) 6. Relevant code files

**Week 1 - Deep Dive:** 7. TODO.md (understand project state) 8. docs/ARCHITECTURE.md (system design) 9. docs/DECISIONS.md (why we chose X)

---

## 🎯 Architecture Cheat Sheet

**Tech Stack:**

- Next.js 14 (App Router)
- TypeScript
- TailwindCSS + shadcn/ui
- Prisma + PostgreSQL
- Supabase Auth
- Redis (BullMQ)

**Folder Structure:**

```
src/
  app/           # Next.js routes
    (public)/    # Public pages
    (app)/       # Protected pages
    api/         # API routes
  components/    # React components
  lib/           # Utilities
    supabase/    # Supabase clients
  lib/server/    # Server-only code
```

**Key Concepts:**

- **Workspace**: Team/organization unit
- **Auth**: Supabase Auth (not NextAuth anymore)
- **Database**: Hybrid (local dev + Supabase prod)
- **API**: RESTful, workspace-scoped

---

## ✅ Before Every PR

```bash
# Run these commands
npm run lint        # No errors
npm run typecheck   # No TypeScript errors
npm run test        # All tests pass
npm run format      # Code formatted

# Checklist
- [ ] Code follows AGENTS.md patterns
- [ ] Tests added/updated
- [ ] Documentation updated (if needed)
- [ ] PR description filled out
- [ ] Linear issue linked
```

---

## 🚀 Deployment

**Development:**

```bash
npm run dev
# Uses local PostgreSQL
```

**Production:**

```bash
# 1. Copy production config
cp .env.production .env

# 2. Push schema to Supabase
npx prisma db push

# 3. Build
npm run build

# 4. Deploy to Vercel/Railway
```

---

**Questions?** Ask in Slack #dev-questions!

**Last Updated**: 2026-02-01
