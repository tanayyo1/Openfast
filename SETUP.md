# Developer Setup Guide

> **Quick Start**: Get ReditFast running locally in 5 minutes

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Docker](https://docs.docker.com/get-docker/)
- [Git](https://git-scm.com/)

---

## 🚀 Quick Start (One Command)

```bash
# 1. Clone the repo
git clone https://github.com/tanayyo1/ReditFast.git
cd ReditFast

# 2. Run the setup script (does everything!)
./scripts/setup-local.sh
```

**That's it!** The script will:

- ✅ Start PostgreSQL with pgvector (Docker)
- ✅ Start Redis (Docker)
- ✅ Install npm dependencies
- ✅ Set up database schema
- ✅ Verify everything works

---

## 📋 Manual Setup (If you prefer)

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Local Database

```bash
# Using Docker Compose
docker-compose up -d

# Or manually:
docker run -d --name reditfast-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=reditfast \
  -p 5432:5432 \
  pgvector/pgvector:pg15
```

### 3. Set Up Environment

```bash
cp .env.local .env
```

### 4. Initialize Database

```bash
npx prisma generate
npx prisma db push
```

### 5. Start Development Server

```bash
npm run dev
```

---

## 🔧 Environment Configuration

### Development (Default)

Uses local PostgreSQL - fast, works offline

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/reditfast"
```

### Production

Uses Supabase Postgres - scalable, managed

```bash
cp .env.production .env
```

---

## ✅ Verify Setup

Run the verification script:

```bash
npx tsx scripts/verify-auth.ts
```

You should see:

```
✅ Database connection: OK
✅ Supabase environment variables: OK
✅ Supabase API connection: OK
✅ Database schema: OK
🎉 All checks passed!
```

---

## 🐳 Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Reset everything (deletes data!)
docker-compose down -v

# Restart
docker-compose restart
```

---

## 🧪 Testing the Auth Flow

1. **Open**: http://localhost:3000/signup
2. **Create account** with email/password
3. **Check Supabase Dashboard** → Auth → Users (user should appear)
4. **Login** and verify session works

---

## 📚 Next Steps

- Read [TASK_ASSIGNMENTS.md](./TASK_ASSIGNMENTS.md) for your tasks
- Check [TODO.md](./TODO.md) for project status
- See [AGENTS.md](./AGENTS.md) for technical details

---

## 🆘 Troubleshooting

### "Docker is not installed"

Install Docker: https://docs.docker.com/get-docker/

### "Port 5432 is already in use"

```bash
# Find and stop the process using port 5432
lsof -ti:5432 | xargs kill -9
# Or change the port in docker-compose.yml
```

### "Database connection failed"

```bash
# Reset everything
docker-compose down -v
./scripts/setup-local.sh
```

### "Prisma schema is out of sync"

```bash
npx prisma db push --accept-data-loss
npx prisma generate
```

---

## 💡 Tips

- **Local database** = Fast development, easy to reset
- **Supabase** = Production, team collaboration, automatic backups
- **Never commit** `.env` files with real credentials
- **Ask questions** in Slack #dev-questions

---

**Happy coding! 🚀**
