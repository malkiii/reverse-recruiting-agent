# Reverse Recruiting Agent

A personal agent for one Admin that finds new Jobs and, once approved, emails an Application directly to the people who can hire at the Company.

See `GLOSSARY.md` for the language and `docs/adr/` for the decisions, starting with [ADR 0004](docs/adr/0004-typescript-functions-on-modal.md).

## Environment variables

Copy `.env.example` to `.env.local`. The dashboard and Functions each validate only their own variables, in `src/lib/env.ts`.

| Variable             | Used by              | Purpose                                         |
| -------------------- | -------------------- | ----------------------------------------------- |
| `DATABASE_URL`       | Dashboard, Functions | Supabase transaction pooler connection, port 6543 |
| `FUNCTIONS_SECRET`   | Dashboard, Functions | Bearer secret that protects Function routes     |
| `DASHBOARD_PASSWORD` | Dashboard            | Password for signing in                         |
| `FUNCTIONS_BASE_URL` | Dashboard            | Modal web endpoint, or the local worker         |

Generate `FUNCTIONS_SECRET` with `openssl rand -hex 32`.

Dev and production share one Supabase project, so migrations must be backward-compatible. Apply them with `npm run db:migrate`.

## Development

```sh
docker compose up --build
```

This starts the dashboard on http://localhost:3000 and the worker behind it, using `.env.local`. There is no scheduler and no ngrok. Compose points `FUNCTIONS_BASE_URL` at the worker itself.

Run the checks with `npm test` and `npm run typecheck`.

## Production

Create the Modal Secret, with `modal.env` holding only `DATABASE_URL` and `FUNCTIONS_SECRET`:

```sh
modal secret create reverse-recruiting-agent --from-dotenv modal.env
```

Deploy the Functions:

```sh
modal deploy modal_app.py
```

On Windows, set `PYTHONUTF8=1` first, or the Modal CLI can fail while printing build logs.

Set the four variables above in Vercel, with `FUNCTIONS_BASE_URL` as the web endpoint URL that `modal deploy` prints.
