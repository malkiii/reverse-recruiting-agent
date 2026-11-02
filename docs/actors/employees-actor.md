# Employees actor

[`apt_marble/linkedin-company-employees-scraper`](https://apify.com/apt_marble/linkedin-company-employees-scraper) lists the visible LinkedIn employees of a company, with their names, headlines, locations and profile URLs. The Decision Maker search runs it once per job function, with `maxEmployees: 4`. It costs $1.50-$2.00 per 1,000 profiles.

## Input

| Field | Type | Description |
| --- | --- | --- |
| `companyUrls` | array of strings | LinkedIn company URLs (`https://www.linkedin.com/company/anthropic/`) or slugs (`anthropic`). Each is processed on its own. |
| `maxEmployees` | integer | Stop after this many profiles per company. The free tier caps it at 100, Premium at 500. |
| `currentFunction` | string | Only employees with this job function, like the Function filter on a company's People tab. Default `any`. |

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

From the store page.

```json
{
  "image": "https://media.licdn.com/dms/image/.../profile.jpg",
  "name": "Mark Colbert",
  "headline": "Director of Engineering at Google",
  "location": "Belmont, California, United States",
  "profileUrl": "https://www.linkedin.com/in/markcolbert",
  "companyName": "Google",
  "source": "pro",
  "scrapedAt": "2026-06-02T22:06:12.846Z"
}
```
