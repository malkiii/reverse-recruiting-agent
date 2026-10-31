# Reverse Recruiting Agent

A personal agent for one Admin. See `GLOSSARY.md` and `docs/adr/`.

## Setup

1. Run `npm install`.
2. Create a Supabase project and run `npm run db:migrate` once `.env.local` is filled in. After changing `src/lib/schema.ts`, run `npm run db:generate`, then `npm run db:migrate`.
3. Copy `.env.example` to `.env.local` and fill in every variable. On Vercel, set the same variables in the project settings.
4. Run `npm run dev`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DASHBOARD_PASSWORD` | Password for signing in to the dashboard |
| `CRON_SECRET` | Bearer token for `POST /api/collection` |
| `DATABASE_URL` | Supabase transaction pooler connection string (port 6543), server-side only |
| `APP_URL` | Public URL of this app, used for Apify webhooks |
| `APIFY_TOKENS` | Comma-separated Apify API tokens |
| `APIFY_WEBHOOK_SECRET` | Shared secret that authenticates Apify webhooks |

Changing `DASHBOARD_PASSWORD` signs out every session.

## Checks

- `npm run typecheck`
- `npm test`
