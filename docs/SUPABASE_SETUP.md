# Supabase Setup (Database)

Project name: `reditfast`

## Required environment variables

Add these to `.env.local`:

```bash
# Postgres
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

Notes:

- `DATABASE_URL` is used by Prisma for normal queries.
- `DIRECT_URL` is used by Prisma for migrations.
- Use Supabase "Connection string" values from Project Settings -> Database.

## pgvector

This project uses pgvector for embeddings.

In Supabase, enable it as:

```sql
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
```

## Schema management

We apply schema changes via SQL migrations (DDL) in Supabase.

For local development, Prisma migrations live under `prisma/migrations/`.
