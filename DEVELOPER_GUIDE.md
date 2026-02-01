# Developer Guide

> **Everything you need to know to contribute effectively to ReditFast**

---

## 🎯 Development Philosophy

**Keep it simple, keep it safe:**

- Human-in-the-loop for all Reddit posts (never auto-post)
- Compliance-first design (prevent bans, don't cause them)
- Workspace-scoped data (multi-tenancy by design)
- Clear, maintainable code (document as you go)

---

## 🏗️ Architecture Overview

### **Tech Stack**

```
Frontend:     Next.js 14 (App Router) + TailwindCSS + shadcn/ui
Backend:      Next.js API Routes + Prisma ORM
Database:     PostgreSQL (local dev) / Supabase (production)
Auth:         Supabase Auth
Cache/Queue:  Redis (BullMQ)
AI:           OpenAI GPT-4 + pgvector for embeddings
```

### **Key Patterns**

**1. Workspace Isolation**

```typescript
// Every query MUST include workspace_id
const projects = await prisma.project.findMany({
  where: { workspaceId: session.workspaceId },
});
```

**2. Server vs Client**

```typescript
// Server components (default)
export default async function Page() {
  const data = await fetchData() // Direct DB call
}

// Client components (when needed)
'use client'
export default function Component() {
  const { data } = useQuery(...) // React Query
}
```

**3. API Structure**

```
src/app/api/
├── resource/
│   ├── route.ts          # GET /api/resource, POST /api/resource
│   └── [id]/
│       ├── route.ts      # GET /api/resource/:id, PATCH, DELETE
│       └── action/
│           └── route.ts  # POST /api/resource/:id/action
```

---

## 📁 Folder Structure Explained

```
ReditFast/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/           # Public routes (landing, login, signup)
│   │   │   ├── page.tsx        # Homepage
│   │   │   ├── login/page.tsx  # Login page
│   │   │   └── signup/page.tsx # Signup page
│   │   ├── (app)/              # Protected routes (requires auth)
│   │   │   ├── dashboard/
│   │   │   ├── projects/
│   │   │   └── settings/
│   │   ├── api/                # API routes
│   │   │   ├── auth/
│   │   │   ├── projects/
│   │   │   └── reddit/
│   │   └── layout.tsx          # Root layout
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── forms/              # Form components
│   │   └── app/                # App-specific components
│   ├── lib/
│   │   ├── supabase/           # Supabase clients
│   │   ├── prisma.ts           # Database client
│   │   └── auth.ts             # Auth utilities
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # TypeScript types
├── prisma/
│   └── schema.prisma           # Database schema
├── docs/                       # Documentation
├── scripts/                    # Utility scripts
└── tests/                      # Test files
```

---

## 🔄 Development Workflow

### **Starting a New Task**

1. **Check TASK_ASSIGNMENTS.md**
   - Find your assigned task
   - Note the priority and deadline
   - Check for blockers/dependencies

2. **Create Feature Branch**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/LIN-XXX-short-description
   ```

3. **Read Relevant Docs**
   - AGENTS.md for patterns
   - Architecture docs if needed
   - API docs for endpoints

4. **Start Development**
   ```bash
   npm run dev
   ```

### **During Development**

**Code Standards:**

- TypeScript strict mode (no `any`)
- Workspace isolation (always filter by workspace_id)
- Never log secrets or tokens
- Handle errors gracefully

**Before Commit:**

```bash
npm run lint        # Fix linting issues
npm run typecheck   # Check TypeScript
npm run format      # Format code
```

**Commit Message Format:**

```
LIN-XXX: Brief description (50 chars max)

- Detailed explanation
- What changed and why
- Any breaking changes

Refs: LIN-XXX
```

### **Creating a PR**

1. **Pre-PR Checklist**

   ```bash
   # Run all checks
   npm run lint
   npm run typecheck
   npm run test

   # Verify setup still works
   npx tsx scripts/verify-auth.ts
   ```

2. **Create PR**
   - Use PR template
   - Link Linear issue
   - Add screenshots if UI changes
   - Request review from 1+ team members

3. **After PR Approved**
   - Merge to main
   - Delete feature branch
   - Update Linear status

---

## 🎨 Coding Standards

### **TypeScript**

**Good:**

```typescript
// Explicit types
interface User {
  id: string;
  email: string;
  name: string | null;
}

// Strict null checks
function getUser(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}
```

**Bad:**

```typescript
// ❌ No any types
const user: any = await getUser();

// ❌ Ignoring null
const name = user.name; // Could be null!
```

### **Database Queries**

**Always scope by workspace:**

```typescript
// ✅ Good - workspace isolation
const projects = await prisma.project.findMany({
  where: {
    workspaceId: session.workspaceId,
    ownerId: session.user.id,
  },
});

// ❌ Bad - no workspace scope
const projects = await prisma.project.findMany();
```

### **Error Handling**

**Structured errors:**

```typescript
try {
  const result = await riskyOperation();
  return NextResponse.json(result);
} catch (error) {
  console.error("Operation failed:", error);
  return NextResponse.json(
    { error: "Failed to complete operation", code: "OPERATION_FAILED" },
    { status: 500 },
  );
}
```

---

## 🔐 Security Guidelines

### **Never commit:**

- `.env` files
- API keys or secrets
- Private keys
- Database passwords

### **Never log:**

- User passwords
- Auth tokens
- API keys
- PII (personally identifiable information)

### **Always encrypt:**

- Reddit OAuth tokens (we use tokenCrypto.ts)
- Sensitive user data

### **Workspace isolation:**

- Every query must include workspace_id
- Verify user has access before returning data
- Use requireWorkspaceSession() for protected routes

---

## 🧪 Testing Strategy

### **Test Levels**

1. **Unit Tests** - Test individual functions

   ```bash
   npm run test:unit
   ```

2. **Integration Tests** - Test API endpoints

   ```bash
   npm run test:integration
   ```

3. **E2E Tests** - Test full user flows
   ```bash
   npm run test:e2e
   ```

### **When to Write Tests**

- ✅ New API endpoints
- ✅ Critical business logic
- ✅ Auth flows
- ✅ Database queries
- ❌ Simple UI components (use Storybook instead)

---

## 🚀 Deployment Process

### **Development**

```bash
# Local development (uses local PostgreSQL)
npm run dev
```

### **Staging/Production**

```bash
# 1. Switch to production database
cp .env.production .env

# 2. Push database schema
npx prisma db push

# 3. Build application
npm run build

# 4. Deploy to Vercel/Railway
# (via Git push or dashboard)
```

### **Environment Variables**

**Development (.env.local):**

- Local PostgreSQL
- Supabase Auth (for auth only)

**Production (.env):**

- Supabase Postgres (full database)
- Supabase Auth
- Production API keys

---

## 🆘 Troubleshooting

### **"It doesn't work!" Checklist**

1. **Database**

   ```bash
   docker-compose ps          # Check if running
   docker-compose logs        # Check errors
   npx prisma db push         # Sync schema
   ```

2. **Environment**

   ```bash
   cat .env.local             # Check vars exist
   npx tsx scripts/verify-auth.ts  # Verify setup
   ```

3. **Dependencies**

   ```bash
   rm -rf node_modules
   npm install
   ```

4. **Code**
   ```bash
   npm run typecheck          # Type errors?
   npm run lint              # Lint errors?
   ```

### **Getting Help**

1. Check [QUICKSTART.md](./QUICKSTART.md) common issues
2. Check [TODO.md](./TODO.md) known issues
3. Search Slack #dev-questions
4. Ask in #dev-questions with:
   - What you tried
   - Error message
   - Code snippet

---

## 📚 Learning Resources

### **Required Reading**

- [AGENTS.md](./AGENTS.md) - Architecture patterns
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Git workflow
- [QUICKSTART.md](./QUICKSTART.md) - Quick reference

### **Useful References**

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [TailwindCSS Docs](https://tailwindcss.com/docs)

---

## ✅ New Developer Checklist

**Day 1:**

- [ ] Read README.md
- [ ] Run `./scripts/setup-local.sh`
- [ ] Verify with `npx tsx scripts/verify-auth.ts`
- [ ] Read AGENTS.md
- [ ] Join Slack #dev-questions

**Day 2:**

- [ ] Read CONTRIBUTING.md
- [ ] Pick first task from TASK_ASSIGNMENTS.md
- [ ] Create feature branch
- [ ] Make first commit

**Week 1:**

- [ ] Complete first PR
- [ ] Read docs/ARCHITECTURE.md
- [ ] Understand workspace isolation
- [ ] Set up IDE (VS Code extensions)

---

**Questions?** Ask in Slack #dev-questions!

**Last Updated**: 2026-02-01
