# Reverse Recruiting Agent

A personal agent for one Admin that finds new Jobs and, once approved, emails an Application directly to the people who can hire at the Company.

See `GLOSSARY.md` for the language and `docs/adr/` for the decisions, starting with [ADR 0004](docs/adr/0004-typescript-functions-on-modal.md).

## Environment variables

Copy `.env.example` to `.env.local`. The dashboard and Functions each validate only their own variables, in `src/lib/env.ts`.

| Variable             | Used by              | Purpose                                         |
| -------------------- | -------------------- | ----------------------------------------------- |
| `DATABASE_URL`       | Dashboard, Functions | Supabase transaction pooler connection, port 6543 |
| `FUNCTIONS_SECRET`   | Dashboard, Functions | Bearer secret that protects Function routes     |
| `APIFY_TOKENS`       | Functions            | Comma-separated Apify tokens, used round-robin  |
| `TELEGRAM_BOT_TOKEN` | Functions            | Telegram bot that sends Failure Alerts          |
| `TELEGRAM_CHAT_ID`   | Functions            | The Admin's Telegram chat                       |
| `DASHBOARD_URL`      | Functions            | Public dashboard URL, linked from Failure Alerts |
| `DASHBOARD_PASSWORD` | Dashboard            | Password for signing in                         |
| `FUNCTIONS_BASE_URL` | Dashboard            | Modal web endpoint, or the local worker         |

Generate `FUNCTIONS_SECRET` with `openssl rand -hex 32`.

## Migrations

Dev and production share one Supabase project, so a migration reaches production as soon as it's applied from dev. Migrations must be backward-compatible: the version already running has to keep working against the new schema.

A destructive change, such as dropping or renaming a column, takes two releases. The first stops using the old shape, and the second removes it.

Apply a migration from dev with `npm run db:migrate` before pushing code that needs it. Every push to `master` also applies pending migrations, but Vercel doesn't wait for them, and a failed migration stops only the Modal deploy.

## Development

```sh
docker compose up --build
```

This starts the dashboard on http://localhost:3000 and the worker behind it, using `.env.local`. There is no scheduler and no ngrok. Compose points `FUNCTIONS_BASE_URL` at the worker itself.

Run the checks with `npm test` and `npm run typecheck`.

## Production

A push to `master` runs `.github/workflows/deploy.yml`, which applies migrations over the direct connection and then runs `modal deploy`. A failed migration stops the Modal deploy. Vercel deploys the dashboard on the same push.

### Secrets

| Where | Secret | Purpose |
| --- | --- | --- |
| Modal | `DATABASE_URL`, `FUNCTIONS_SECRET`, `APIFY_TOKENS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DASHBOARD_URL` | Runtime variables for Functions |
| Vercel | `DATABASE_URL`, `FUNCTIONS_SECRET`, `DASHBOARD_PASSWORD`, `FUNCTIONS_BASE_URL` | Runtime variables for the dashboard |
| GitHub Actions | `DIRECT_DATABASE_URL` | Direct database connection for migrations |
| GitHub Actions | `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` | Modal token for `modal deploy` |

GitHub-hosted runners have no IPv6, and Supabase's direct host is IPv6-only without its IPv4 add-on. Without the add-on, set `DIRECT_DATABASE_URL` to the session pooler connection, port 5432.

Create the Modal Secret, with `modal.env` holding only its six variables:

```sh
modal secret create reverse-recruiting-agent --from-dotenv modal.env
```

Set `FUNCTIONS_BASE_URL` in Vercel to the web endpoint URL that `modal deploy` prints.

### Deploying by hand

```sh
modal deploy modal_app.py
```

On Windows, set `PYTHONUTF8=1` first, or the Modal CLI can fail while printing build logs.
