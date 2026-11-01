# Archived GitHub issues

Exported on 2026-11-01, before the issues were deleted. They describe the design from before ADR 0004.

## #1 Spec: Reverse recruiting agent (OPEN)

Labels: ready-for-agent

## Problem Statement

The Admin is job hunting and applying through job boards is slow and low-yield. New Jobs are spread across LinkedIn Jobs, Glassdoor and other sites, so they have to be checked by hand every day. Once a good Job appears, the Admin still has to pick the right Resume, work out who at the Company can hire them, find those people's email addresses and write a Cover Letter. Most of this work is repetitive, and doing it by hand means applying later than other candidates and usually landing in a form queue instead of in front of a person.

## Solution

A personal full-stack agent for one Admin. A cron-triggered run collects today's Jobs from the enabled Job Boards and Job Feeds, removes Duplicate Jobs, and sends each new Job to Telegram with an Apply link and a Prepare button.

When the Admin taps Prepare, the agent reads the Job page, chooses the best Resume from the Admin's Resume Folder, finds the Company's LinkedIn page and up to 4 Decision Makers with email addresses, and writes a Cover Letter. The Admin then Reviews the Application and taps Send, and the agent emails each Decision Maker from the Admin's own Gmail, greeting them by name and ending with the Resume's Drive link.

An admin dashboard tracks Jobs, Applications and stats, and holds all settings.

## User Stories

### Setup and access

1. As the Admin, I want the dashboard protected by a single password, so that nobody else can see my data or trigger emails.
2. As the Admin, I want the agent to only act on Telegram button taps from my chat ID, so that nobody else can send email from my account.
3. As the Admin, I want to connect my Google account with OAuth, so that the agent can send email from my Gmail and read my Resume Folder.
4. As the Admin, I want to be asked to choose my Resume Folder from a list of my Drive folders the first time I enter, so that I don't have to paste folder IDs.
5. As the Admin, I want to be warned if my Resume Folder isn't shared as "Anyone with the link", so that recipients never get a dead Resume link.
6. As the Admin, I want to see which files in my Resume Folder count as Resumes, so that a misnamed file is easy to spot.
7. As the Admin, I want to choose the LLM provider (Claude, Gemini, OpenAI or Groq) and one model in settings, so that I can change cost and quality without code changes.
8. As the Admin, I want to give several Apify tokens in one comma-separated variable, so that the agent can spread usage across them.

### Finding jobs

9. As the Admin, I want to enable or disable each Job Board, so that I only pay for the sources I want.
10. As the Admin, I want to set LinkedIn search URLs for the LinkedIn Job Board, so that all my LinkedIn filters apply.
11. As the Admin, I want to set keywords and a location for the Glassdoor Job Board, so that Glassdoor results match my search.
12. As the Admin, I want to add, edit and remove Job Feed URLs copied from any website, so that I can track sites without a built-in collector.
13. As the Admin, I want to enable or disable each Job Feed, so that I can pause one without deleting it.
14. As the Admin, I want an authenticated endpoint that cron-job.org can call, so that scheduling lives outside the app.
15. As the Admin, I want a dashboard button that starts the same collection run, so that I can check for Jobs on demand.
16. As the Admin, I want only Jobs posted today collected from Job Boards, so that I see fresh Jobs.
17. As the Admin, I want a Job with no post date in a Job Feed to count as posted the day it was first seen, so that Feed Jobs can still be deduplicated.
18. As the Admin, I want Jobs with the same URL treated as Duplicate Jobs, so that I never see one twice.
19. As the Admin, I want Jobs with the same title, Company and post day treated as Duplicate Jobs, so that a Job on two boards appears once.
20. As the Admin, I want each collection capped at 50 Jobs per Job Board, so that actor costs stay predictable.
21. As the Admin, I want only the first page of each Job Feed read, so that each Job Feed costs one Firecrawl request.

### Telegram alerts

22. As the Admin, I want each new Job sent to Telegram as its own message, so that I can decide on them one by one.
23. As the Admin, I want each message to have an Apply button with the original Job link, so that I can apply on the website myself.
24. As the Admin, I want each message to have a Prepare button, so that I can start an Application with one tap.
25. As the Admin, I want at most 20 Telegram alerts per run with the rest kept on the dashboard, so that a first run can't flood me.

### Preparing an Application

26. As the Admin, I want to Prepare from Telegram or the dashboard, so that I can act from wherever I am.
27. As the Admin, I want the Job page read as markdown when I tap Prepare, so that the Application is based on the full description.
28. As the Admin, I want a LinkedIn or Glassdoor Job to fall back to its collected description if the page can't be read, so that a blocked page doesn't end the Application.
29. As the Admin, I want a Feed Job whose page can't be read to end as Direct Apply, so that I'm not sent a letter based on nothing.
30. As the Admin, I want the best Resume chosen from my Resume filenames, so that each Job gets the Resume that fits its role.
31. As the Admin, I want the Application stopped if no Resume exists or the LLM returns an unknown filename, so that a wrong file is never sent.
32. As the Admin, I want the Company's LinkedIn page used directly when the Job already has it, so that no search is paid for.
33. As the Admin, I want the Company's LinkedIn page searched by name, industry keywords and Job location otherwise, so that the right page is found.
34. As the Admin, I want only a first search result with a matching title accepted, so that strangers at the wrong Company aren't emailed.
35. As the Admin, I want a Direct Apply message when the page can't be confirmed, telling me to apply through the link with the chosen Resume, so that the Job isn't lost.
36. As the Admin, I want Decision Makers searched in function order (Human Resources, Entrepreneurship, Operations, Product Management, Program & Project Management), so that the most relevant people are contacted first.
37. As the Admin, I want the search to stop once 4 Decision Makers have email addresses, so that I don't overpay or over-contact.
38. As the Admin, I want people with no email skipped and replaced from the next function, so that I get as close to 4 as possible.
39. As the Admin, I want the "any" function searched only when nobody with an email was found, so that 1-3 good people are enough.
40. As the Admin, I want an Application with nobody reachable to end as No Contacts, so that I know to use the Apply link.
41. As the Admin, I want a Company's Decision Makers saved and reused for 6 months, so that I don't pay to find them again.
42. As the Admin, I want people with no email saved too, so that they aren't retried before the People Refresh.
43. As the Admin, I want a People Refresh once saved people are 6 months old, so that the people stay current.
44. As the Admin, I want a Decision Maker blocked from being emailed for 30 days after an Application, so that I don't look like a spammer.
45. As the Admin, I want a warning showing how many days ago they were contacted when everyone is in Cooldown, so that I know why the Application stopped.
46. As the Admin, I want the Cover Letter written only after Decision Makers are found, so that I don't pay for a letter that can't be sent.
47. As the Admin, I want a Cover Letter and subject written from the Job Summary and my Resume, so that the letter is specific and only claims what my Resume supports.

### Review and sending

48. As the Admin, I want a Telegram Review showing the Resume, recipients, Company page and Cover Letter, so that I can catch mistakes before anything is sent.
49. As the Admin, I want Send and Cancel buttons in that Review, so that I decide from my phone.
50. As the Admin, I want a link from the Review to the dashboard, so that I can make changes there.
51. As the Admin, I want to edit the Cover Letter on the dashboard, so that I can fix wording before sending.
52. As the Admin, I want to remove a recipient on the dashboard, so that I can drop a wrong person.
53. As the Admin, I want to switch the Resume on the dashboard, so that I can override the LLM's choice.
54. As the Admin, I want each email to greet the Decision Maker by name and end with the Resume's Drive link, so that it reads as personal.
55. As the Admin, I want sending refused if a placeholder is missing, so that no broken email goes out.
56. As the Admin, I want emails sent from my Gmail, a few seconds apart, so that replies reach my inbox and sending doesn't look like a bulk blast.

### Reliability

57. As the Admin, I want the Apify tokens rotated round-robin, so that usage is shared evenly.
58. As the Admin, I want a rate-limited or out-of-credit token skipped until the next UTC day, so that one exhausted token doesn't stop the agent.
59. As the Admin, I want a Telegram alert when all tokens are used up, so that I can top up.
60. As the Admin, I want a failed step retried up to 3 times, so that passing errors fix themselves.
61. As the Admin, I want an Application that still fails marked Failed with a Telegram alert, so that I know to look at it.
62. As the Admin, I want a Retry button that resumes from the failed step, so that I don't pay twice for finished steps.
63. As the Admin, I want each collection run to pick up stuck Applications, so that a lost webhook doesn't freeze one forever.
64. As the Admin, I want step logs on each Application, so that I can debug what happened.

### Dashboard

65. As the Admin, I want a list of Jobs with no duplicates showing their Job Board or Job Feed, so that I can see where each came from.
66. As the Admin, I want a list of Applications by status, so that I can track progress.
67. As the Admin, I want each Application to show its Company info, Decision Makers and Cover Letter, so that I know exactly who I contacted and what I said.
68. As the Admin, I want stats for Jobs per source, Applications by status, emails sent and email-found rate, so that I can judge what's working.

## Implementation Decisions

### Architecture

- Next.js and TypeScript, hosted on Vercel, with Supabase as the database.
- Per ADR-0001, an Application is a state machine stored in Supabase and advanced one step at a time. Actor runs are started in one request and resumed from an Apify webhook. Telegram webhooks reply immediately and never do the long work.
- Step handling is idempotent because Apify webhooks can arrive twice. Finished steps are never rerun.
- Per ADR-0002, email goes through the Gmail API from the Admin's account. Per ADR-0003, nothing is sent without Prepare and then Send.
- Single-tenant: one Admin, no users table. The Telegram chat ID, dashboard password and cron secret come from environment variables. The cron endpoint uses `Authorization: Bearer <CRON_SECRET>`.
- Apify webhook requests are authenticated with a shared secret.

### Modules

- **Job Collection**: a deep module with one entry point, "run collection". It reads the enabled Job Boards and Job Feeds, normalizes Jobs, removes Duplicate Jobs, saves them and sends alerts up to the cap. The cron endpoint and dashboard button both call it, and each run also picks up stuck Applications.
- **Application state machine**: a deep module with entry points for "prepare", "advance" (after an event or webhook), "send", "cancel" and "retry". It owns all transitions, retries and step logs.
- **Decision Maker search**: owns the function order, batch rule, reuse of saved people, People Refresh and Cooldown.
- **Service gateways**: one thin interface per external service: Job Board actors, Decision Maker and email actors, Firecrawl, LLM, Telegram, Google (Gmail and Drive), and the data store.
- **Apify token router**: parses the comma-separated token variable and applies round-robin with failover. Each actor run stores the token that started it, because fetching its results needs that same token.
- **LLM gateway**: one interface over Claude, Gemini, OpenAI and Groq. The provider and one model are chosen in settings, and API keys stay in environment variables. Provider and model switching must not affect any caller.
- **Dashboard**: pages for Jobs, Applications, Application detail, settings and stats.

### Application flow

Steps, in order:

1. Check the Cooldown of any saved people under 6 months old. Stop with a warning if all of them are blocked.
2. Scrape the Job page to main-content markdown with Firecrawl. If this fails, Job Board Jobs use their collected description, and Feed Jobs end as Direct Apply.
3. List the Resumes in the Resume Folder.
4. LLM request 1: Job page + Resume filenames, returning industry keywords, Job location, best Resume filename and Job Summary.
5. Find the Company's LinkedIn page. Use `companyLinkedinUrl` if the Job has it, otherwise use the Firecrawl search below.
6. Find Decision Makers, reusing saved people if under 6 months old.
7. Apply the Cooldown to any newly found people.
8. Fetch the chosen Resume PDF and convert it to markdown without the LLM.
9. LLM request 2: Job Summary + Resume markdown, returning a subject and Cover Letter containing `{{name}}` in the first line and `{{resume_link}}` at the end.
10. Review, then Send or Cancel.

Application outcomes include Sent, Cancelled, Direct Apply, No Contacts and Failed.

### External service rules

- **LinkedIn jobs**: `curious_coder/linkedin-jobs-scraper`, given search URLs.
- **Glassdoor jobs**: `valig/glassdoor-jobs-scraper`, given keywords and location with `daysOld=1`. Glassdoor gives no post date, so post day is calculated from `ageInDays`.
- **Employees**: `apt_marble/linkedin-company-employees-scraper`, always with `maxEmployees: 4`. Function order is Human Resources (12), Entrepreneurship (9), Operations (18), Product Management (19), Program & Project Management (20), then any.
- **Emails**: `vulnv/linkedin-email-finder`. No email verification. Look up only as many as are still needed, and a person with no email is skipped.
- **Search loop**: keep a set of people unique by name. "any" runs only when no person with an email was found across all 5 functions. Stop at 4 people with emails. If 1-3 are found, stop there.
- **Firecrawl** is used for exactly three things: one request per Job Feed to extract Jobs (prompt + JSON schema), one web search for the Company's LinkedIn page, and one scrape of the Job page to markdown.
- **Company page search query**: `[company name] [industry keywords separated with space] in [job location] site:linkedin.com/company`.
- **Company page match**: only the first result is considered. Lowercase both names, remove `| LinkedIn` and suffixes such as Inc, LLC and Ltd, then accept if one name contains the other. Otherwise the Application ends as Direct Apply, and the Telegram message says to apply through the link with the chosen Resume.
- **Resume selection**: files in the Resume Folder that are PDFs with names ending in "resume" or "CV", in any case. Only filenames go to the LLM, and they are assumed to contain the target role.
- **LLM prompts**: each piece of input is wrapped in XML tags. Outputs use each provider's structured output, not XML. Exactly two LLM requests per Application.
- **Telegram**: buttons use callback data that identifies the Job or Application. Taps from any other chat ID are ignored.

### Schema

Core entities, with relationships:

- **Job**: source (Job Board or Job Feed), title, Company name, location, URL, post day, description if collected. Unique constraints enforce both Duplicate Job rules.
- **Job Feed**: URL, enabled flag.
- **Settings**: Job Board toggles and search criteria, LLM provider and model, Resume Folder, Google connection.
- **Company**: LinkedIn page URL as identity, name, industry keywords, People Refresh date.
- **Decision Maker**: belongs to a Company; name, headline, profile URL, email if found, function, last-emailed date.
- **Application**: belongs to a Job and Company; status, current step, Resume, Job Summary, subject, Cover Letter.
- **Application recipient**: links an Application and Decision Maker, with send status.
- **Step log**: belongs to an Application; step, attempt, result, error.
- **Actor run**: belongs to an Application or collection run; actor, run ID, token used.

### Google setup

- Scopes: `gmail.send` and `drive.readonly`. The app can't change Drive sharing, so the Admin shares the Resume Folder, and the app checks it when the folder is chosen and before each Review.
- The OAuth app must be published as "In production" even though it's unverified. In "Testing" mode Google expires refresh tokens every 7 days, which would silently disconnect Gmail. The Admin clicks through one warning screen.

## Testing Decisions

- Good tests check external behaviour through a module's public entry point, such as what was saved, sent or returned. They don't assert on internal calls or private helpers.
- There are two seams: **Job Collection** ("run collection") and the **Application state machine** ("prepare", "advance", "send", "cancel", "retry"). Each uses fake service gateways, so no test spends real API credit.
- Job Collection tests cover: both Duplicate Job rules across sources, disabled sources, missing post dates, `ageInDays` conversion, per-board caps and the Telegram alert cap.
- Application state machine tests cover: the function order, stopping at 4, skipped emails, "any" only on an empty list, reuse of saved people, People Refresh at 6 months, Cooldown, Direct Apply, No Contacts, the scrape fallback, missing placeholders, repeated webhooks, retries, resuming without rerunning finished steps, and stuck Applications.
- The Apify token router is tested through its public interface for rotation, skip-until-next-day and all-tokens-exhausted behaviour.
- Dashboard pages and gateway internals aren't tested in v1.
- There is no prior art. This is a greenfield repo, and these tests set the pattern.

## Out of Scope

- Follow-up emails.
- Reply tracking.
- Auto-filling application forms.
- Email verification.
- LLM relevance filtering of Jobs: every new Job is shown.
- Multiple users or multiple chat IDs.
- Scheduling inside the app: cron-job.org handles this.
- Reading past the first page of a Job Feed.
- An editable email template.

## Further Notes

- `GLOSSARY.md` and ADRs 0001-0003 define the language and key decisions used here.
- **Verify first:** the actor's public page doesn't list the accepted `currentFunction` values, and only shows names such as "HR" as examples. Before building the Decision Maker search, send one small test run confirming the IDs (12, 9, 18, 19, 20) work. If it needs names, map them.
- Actor output fields come from their store pages, which warn sample data may be outdated. Confirm them with a small real run of each actor.
- Worst-case actor cost for a new Company is about $0.15. Saved people cost nothing to reuse.
- Each function is a separate actor run, so a thorough Decision Maker search can take a few minutes.



## #2 App skeleton with secured access (CLOSED)

Labels: ready-for-agent

## Parent

#1

## What to build

A deployed Next.js and TypeScript app on Vercel backed by Supabase. The Admin signs in to the dashboard with one password and sees an empty Jobs page. The collection endpoint exists and is protected by the cron secret. The test harness is in place, with fake service gateways ready for the two test seams.

## Acceptance criteria

- [ ] The dashboard can't be reached without the correct password
- [ ] The collection endpoint rejects a missing or wrong `Authorization: Bearer` token and accepts the right one
- [ ] An empty Jobs page renders from Supabase
- [ ] One passing test runs through the Job Collection entry point with a fake gateway
- [ ] Required environment variables are documented

### Comment by malkiii, 2026-10-31T19:38:12Z

All acceptance criteria verified against a local production build connected to the database. Pushed to master in eedef75. Vercel deployment was not verified.


## #3 LinkedIn Job Board to dashboard (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

The first complete path for finding Jobs. The Admin enables the LinkedIn Job Board and sets search URLs. A cron call or the dashboard button starts a collection run through the LinkedIn actor, an Apify webhook resumes it, and new Jobs appear on the Jobs page. Tokens come from the comma-separated variable and rotate round-robin.

## Acceptance criteria

- [ ] The Admin can enable the LinkedIn Job Board and edit its search URLs
- [ ] The cron endpoint and dashboard button start the same collection run
- [ ] Runs cover Jobs posted today and are capped at 50 Jobs
- [ ] A Job with an already-saved URL is a Duplicate Job and isn't saved twice
- [ ] Apify webhooks are authenticated with a shared secret, and a repeated webhook causes no duplicates
- [ ] Multiple tokens are rotated round-robin
- [ ] Each actor run stores the token that started it
- [ ] Tests cover URL duplicates, the disabled Job Board and the cap through "run collection"


## #4 Apify token failover (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

The agent keeps working when an Apify token runs out. A rate-limited or out-of-credit token is skipped until the next UTC day, and the next token takes over. Once all tokens are used up, the failure is recorded and the Admin is alerted on Telegram once Telegram alerts exist.

## Acceptance criteria

- [ ] A rate-limit or out-of-credit error moves the run to the next token
- [ ] A skipped token isn't used again until the next UTC day
- [ ] Results are always fetched with the token that started the run
- [ ] When all tokens are used up, the failure is recorded, and an alert is sent if Telegram is configured
- [ ] Tests cover rotation, skip-until-next-day and all-tokens-exhausted through the router's public interface


## #5 Glassdoor Job Board and cross-board duplicates (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

The Admin enables the Glassdoor Job Board with keywords and a location, and its Jobs join the same collection run. The same Job found on two boards appears once.

## Acceptance criteria

- [ ] The Admin can enable the Glassdoor Job Board and set keywords and location
- [ ] Runs use `daysOld=1` and are capped at 50 Jobs
- [ ] Post day is calculated from `ageInDays`
- [ ] Jobs with the same title, Company and post day are Duplicate Jobs across sources
- [ ] The Jobs page shows each Job's source
- [ ] Tests cover the cross-board rule and the `ageInDays` conversion


## #6 Telegram Job alerts (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

Each new Job from a collection run reaches the Admin on Telegram as its own message, with an Apply button (the original link) and a Prepare button. For now, Prepare only acknowledges the tap.

## Acceptance criteria

- [ ] Each new Job is sent once, as its own message
- [ ] Apply opens the original Job link
- [ ] Prepare is acknowledged immediately
- [ ] At most 20 alerts go out per run, and the remaining Jobs stay on the dashboard
- [ ] Taps from any chat ID other than the Admin's are ignored
- [ ] Tests cover the alert cap and no repeat alerts for Duplicate Jobs


## #7 Job Feeds (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

The Admin adds any filtered job listing URL as a Job Feed from the dashboard. Each collection run makes one Firecrawl request per enabled Job Feed, using a prompt and JSON schema, and its Jobs follow the same duplicate and alert rules.

## Acceptance criteria

- [ ] The Admin can add, edit, remove, enable and disable Job Feeds
- [ ] Each enabled Job Feed costs one Firecrawl request, reading the first page only
- [ ] A Job with no post date uses the day it was first seen as its post day
- [ ] One failing Job Feed doesn't stop the rest of the run
- [ ] Tests cover missing post dates and disabled Job Feeds


## #8 Google connection and Resume Folder (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

The Admin connects their Google account with OAuth and, on first entry, chooses the Resume Folder from a list of their Drive folders. The dashboard shows which files count as Resumes and warns if the folder isn't shared as "Anyone with the link".

## Acceptance criteria

- [ ] OAuth requests only `gmail.send` and `drive.readonly`, and tokens refresh without the Admin signing in again
- [ ] Setup notes say the OAuth app must be "In production", because "Testing" expires refresh tokens every 7 days
- [ ] First entry prompts for a Resume Folder chosen from a list
- [ ] Only PDFs with names ending in "resume" or "CV", in any case, are listed as Resumes
- [ ] A warning appears when the Resume Folder isn't shared as "Anyone with the link"


## #9 Prepare: read the Job and choose a Resume (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

Tapping Prepare on Telegram or the dashboard creates an Application as a stored state machine. It scrapes the Job page to markdown, then makes LLM request 1 to get industry keywords, Job location, best Resume filename and Job Summary. The Admin can see the result on the dashboard. The Admin chooses the LLM provider and one model in settings. See ADR-0001.

## Acceptance criteria

- [ ] Prepare works from both Telegram and the dashboard, and the Telegram tap replies immediately
- [ ] The Admin can choose Claude, Gemini, OpenAI or Groq and one model, and each provider works
- [ ] Prompt inputs are wrapped in XML tags, and outputs use the provider's structured output
- [ ] If the scrape fails, a Job Board Job uses its collected description and a Feed Job ends as Direct Apply
- [ ] The Application stops if no Resume exists or the LLM returns a filename that isn't listed
- [ ] Tests cover both scrape outcomes and the unknown-filename stop through the Application state machine


## #10 Find the Company's LinkedIn page (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

The Application finds the Company's LinkedIn page. It uses `companyLinkedinUrl` when the Job has it, otherwise a Firecrawl search, and creates or finds the Company. When the page can't be confirmed, the Admin gets a message suggesting they apply through the Job link with the chosen Resume.

## Acceptance criteria

- [ ] A Job with `companyLinkedinUrl` makes no search request
- [ ] The search query is `[company name] [industry keywords separated with space] in [job location] site:linkedin.com/company`
- [ ] Only the first result is considered
- [ ] The match lowercases both names, removes `| LinkedIn` and suffixes such as Inc, LLC and Ltd, and accepts when one contains the other
- [ ] No match ends the Application as Direct Apply, with a Telegram message naming the chosen Resume and Job link
- [ ] Tests cover the skip, match and Direct Apply paths


## #11 Find Decision Makers (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

The Application finds up to 4 Decision Makers with email addresses and saves them to the Company.

Start by sending one small actor test run to confirm `currentFunction` accepts the IDs below, because the actor's public page doesn't list them. If it needs names, map them. Also confirm the output fields of the employees and email actors.

## Acceptance criteria

- [ ] Functions are tried in order: Human Resources (12), Entrepreneurship (9), Operations (18), Product Management (19), Program & Project Management (20)
- [ ] Every employees run uses `maxEmployees: 4`
- [ ] People are kept unique by name
- [ ] Emails are looked up only for the number still needed, and a person with no email is skipped
- [ ] The search stops at 4 people with emails, and stops with 1-3 once all 5 functions are done
- [ ] "any" runs once, only when nobody with an email was found
- [ ] Nobody with an email ends the Application as No Contacts, with a Telegram message
- [ ] All people found are saved to the Company, including those with no email
- [ ] Tests cover each of these through the Application state machine with fake gateways


## #12 Cover Letter, Review and Send (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

The last leg of the full path. With Decision Makers found, the chosen Resume is converted to markdown without the LLM, and LLM request 2 writes a subject and Cover Letter. The Admin gets a Telegram Review and taps Send or Cancel. Send emails each Decision Maker from the Admin's Gmail. See ADR-0002 and ADR-0003.

## Acceptance criteria

- [ ] The Cover Letter is only written after Decision Makers are found
- [ ] The Cover Letter contains `{{name}}` in the first line and `{{resume_link}}` at the end
- [ ] The Review shows the Resume, recipients, Company page and Cover Letter, with Send and Cancel
- [ ] Nothing is emailed without Send
- [ ] Sending is refused if a placeholder is missing
- [ ] Each email is personalized with the recipient's name and the Resume's Drive link
- [ ] Emails go out from the Admin's Gmail a few seconds apart
- [ ] Each recipient's send status and the Decision Maker's last-emailed date are saved
- [ ] The Resume Folder's sharing is checked before the Review
- [ ] Tests cover Send, Cancel and the missing-placeholder refusal


## #13 Cooldown and People Refresh (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

The agent stops contacting the same people too often and reuses what it already paid for. Saved people under 6 months old are reused with no actor runs, older ones trigger a People Refresh, and anyone emailed in the last 30 days is in Cooldown.

## Acceptance criteria

- [ ] Saved people under 6 months old are reused with no actor runs
- [ ] People with no email aren't retried before the People Refresh
- [ ] Saved people 6 months or older trigger a People Refresh
- [ ] A Decision Maker in Cooldown isn't emailed
- [ ] If everyone is in Cooldown, the Application stops with a warning showing how many days ago they were contacted
- [ ] Cooldown is checked for saved people at the start and for newly found people after the search
- [ ] Tests cover both windows at their boundaries


## #14 Failures, Retry and step logs (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

Applications recover from errors without paying or emailing twice. A failed step retries up to 3 times, then the Application is marked Failed with a Telegram alert and a Retry button that resumes from that step. Every step is logged and visible on the dashboard, and each collection run picks up stuck Applications.

## Acceptance criteria

- [ ] A failed step retries up to 3 times
- [ ] An Application that still fails is marked Failed, with a Telegram alert
- [ ] Retry resumes from the failed step and doesn't rerun finished steps
- [ ] Retrying a partly sent Application doesn't email anyone twice
- [ ] Repeated webhooks don't advance an Application twice
- [ ] Each collection run picks up stuck Applications
- [ ] Each step's attempts, results and errors appear on the dashboard
- [ ] Tests cover retries, resume, repeated webhooks, partial sends and stuck Applications


## #15 Edit an Application in Review (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

From the Telegram Review, the Admin can open the Application on the dashboard, then edit the Cover Letter, remove a recipient or switch the Resume before sending. Send and Cancel also work from the dashboard.

## Acceptance criteria

- [ ] The Telegram Review links to the Application on the dashboard
- [ ] The Admin can edit the subject and Cover Letter
- [ ] The Admin can remove a recipient
- [ ] The Admin can switch the Resume to any listed Resume
- [ ] Edits are what actually gets sent, whichever place Send is tapped
- [ ] Sending stays refused if an edit removes a placeholder


## #16 Applications list and stats (OPEN)

Labels: ready-for-agent

## Parent

#1

## What to build

The Admin can track everything from the dashboard: a list of Applications by status, a detail page for each, and stats.

## Acceptance criteria

- [ ] Applications can be listed and filtered by status
- [ ] The detail page shows Company info, Decision Makers and the Cover Letter
- [ ] Stats show Jobs per source, Applications by status, emails sent and email-found rate


