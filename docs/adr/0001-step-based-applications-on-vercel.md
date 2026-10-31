# Step-based Applications on Vercel

An Application chains several Apify actor runs and can take minutes, longer than a serverless function or a Telegram webhook can wait. We run on Vercel and store each Application as a state machine in Supabase, advanced one step at a time by Apify webhooks, rather than running a long-lived worker on a server. Finished steps are never rerun, so a retry doesn't pay twice for the same actor run.
