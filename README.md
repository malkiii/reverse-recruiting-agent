# Reverse Recruiting Agent

A personal agent for one Admin. See `GLOSSARY.md` and `docs/adr/`.

## Setup

1. Run `npm install`.
2. Create a Supabase project and run the SQL in `supabase/migrations/` against it.
3. Copy `.env.example` to `.env.local` and fill in every variable. On Vercel, set the same variables in the project settings.
4. Run `npm run dev`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DASHBOARD_PASSWORD` | Password for signing in to the dashboard |
| `CRON_SECRET` | Bearer token for `POST /api/collection` |
| `SUPABASE_URL` | Supabase project API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key, server-side only |

Changing `DASHBOARD_PASSWORD` signs out every session.

## Checks

- `npm run typecheck`
- `npm test`
