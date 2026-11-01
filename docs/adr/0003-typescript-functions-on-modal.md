# TypeScript Functions on Modal, dashboard on Vercel

Job Collection and Applications run for minutes, so we moved that work out of the Vercel dashboard into three Modal Functions, `collect-jobs`, `prepare-application` and `send-application`, to stay on free plans without chaining webhooks. The dashboard is the only controller: it starts Functions over HTTP with a bearer secret, and a daily Modal schedule starts `collect-jobs`. Modal Functions can only be defined in Python, so each is a thin Python wrapper around TypeScript run in Node, which keeps one Drizzle schema and the existing tests instead of a Python rewrite.

Functions poll Apify rather than receive webhooks, and record progress in Postgres, so a retry finishes the work left over and doesn't pay twice for the same actor run. Telegram only sends messages out, so neither environment needs a public webhook or ngrok.

Development runs the same code in Docker Compose, with a local worker behind the same HTTP routes, and deliberately shares the production Supabase project.

## Consequences

- A dev Send would reach real Decision Makers, so it stays off unless explicitly enabled.
- Dev migrations hit production before the code deploys, so they must be backward-compatible.
- Modal can't report a Function it killed, so a run past its time limit is shown as failed without a Telegram alert.
