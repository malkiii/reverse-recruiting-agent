# Employees actor

[`apt_marble/linkedin-company-employees-scraper`](https://apify.com/apt_marble/linkedin-company-employees-scraper) lists the visible LinkedIn employees of a company, with their names, headlines, locations and profile URLs. The Decision Maker search runs it once per job function, with `maxEmployees: 4`. It costs $1.50-$2.00 per 1,000 profiles.

## Input

| Field | Type | Description |
| --- | --- | --- |
| `companyUrls` | array of strings | LinkedIn company URLs (`https://www.linkedin.com/company/anthropic/`) or slugs (`anthropic`). Each is processed on its own. |
| `maxEmployees` | integer | Stop after this many profiles per company. The free tier caps it at 100, Premium at 500. |
| `currentFunction` | string | Only employees with this job function, like the Function filter on a company's People tab. Default `any`. |

`currentFunction` takes LinkedIn's function IDs as strings, confirmed from the actor's input schema and a real run on 2026-11-05: Human Resources `"12"`, Entrepreneurship `"9"`, Operations `"18"`, Product Management `"19"`, Program and Project Management `"20"`, or `"any"`.

## Output

One item per employee.

| Field | Type | Description |
| --- | --- | --- |
| `image` | string | Profile photo URL |
| `name` | string | Full display name |
| `headline` | string | LinkedIn headline, usually job title and company |
| `location` | string or null | City or region, when the source has it |
| `profileUrl` | string | Canonical `linkedin.com/in/...` URL |
| `companyName` | string | The company that was searched |
| `source` | string | `pro` for Premium runs, `standard` for free-tier runs |
| `scrapedAt` | string | ISO timestamp of the scrape |

## Output example

From a real run on 2026-11-05, with `currentFunction: "12"`. It also returns `companyUrl` and `companySlug`.

```json
{
  "image": "https://media.licdn.com/dms/image/.../profile-displayphoto-scale_100_100/...",
  "name": "Jess Totah",
  "headline": "Talent Acquisition for High-Growth Companies",
  "location": "Newark, CA",
  "profileUrl": "https://www.linkedin.com/in/jessica-totah",
  "companyUrl": "https://www.linkedin.com/company/vercel/",
  "companyName": "Vercel",
  "companySlug": "vercel",
  "source": "standard",
  "scrapedAt": "2026-11-05T11:54:14.157Z"
}
```
