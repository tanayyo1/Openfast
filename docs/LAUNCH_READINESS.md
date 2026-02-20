# Launch Readiness

Run this before staging/prod deploy:

```bash
npm run check:launch
npm run ci:local
```

If `check:launch` reports pending migrations, apply them:

```bash
# local
npx prisma migrate dev

# production
npx prisma migrate deploy
```

## Required env vars (core)

- `APP_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `TOKEN_ENCRYPTION_KEYS`
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_REDIRECT_URI` (must end with `/api/reddit/oauth/callback`)

Generate token encryption key material with:

```bash
openssl rand -base64 32
# then set TOKEN_ENCRYPTION_KEYS="v1:<output>"
```

## Recommended env vars

- `OPENAI_API_KEY` (improves AI output quality)
- `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_PRO`, `POLAR_PRODUCT_ENTERPRISE` (billing flows)

## Final smoke flow

1. `/signup` + `/login`
2. `/projects` create/edit
3. `/roadmaps` generate
4. `/content` draft + approve
5. `/scheduling` schedule
6. `/analytics` and `/health`
7. `/ads` create + transition
8. `/landing-pages` generate + archive
