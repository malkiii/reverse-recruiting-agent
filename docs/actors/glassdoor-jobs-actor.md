# Glassdoor Jobs actor

[`valig/glassdoor-jobs-scraper`](https://apify.com/valig/glassdoor-jobs-scraper) collects Glassdoor job listings. Job Collection runs it with the Glassdoor keywords and location to find Jobs posted in the last day. It costs $0.28-$0.40 per 1,000 jobs, plus $0.0007-$0.001 per run start.

## Input

`keywords` and `location` are required.

| Field | Type | Description |
| --- | --- | --- |
| `keywords` | string | Job title, skill or company to search for. Default `Software Developer`. |
| `location` | string | City, state or country. Default `New York`. |
| `daysOld` | integer | Default `30`. Most days since the job was posted. Minimum `1`. |
| `easyApply` | boolean | Only jobs you can apply to on Glassdoor. |
| `remoteWorkType` | boolean | Only remote jobs. |
| `minRating` | number | Minimum company rating, from `0.0` to `5.0`. |
| `radius` | string | Search radius in miles: `0` (exact location), `5`, `10`, `15`, `25`, `50` or `100`. |
| `employerSizes` | string | Company size: `1` (1-200 employees), `2` (201-500), `3` (501-1,000), `4` (1,001-5,000), `5` (5,001+). Empty means any size. |
| `sortBy` | string | Default `relevant_desc`. `relevant_desc` or `date_desc` (most recent). |
| `limit` | integer | Default `100`. Number of jobs to return, from 1 to 1,000. |
| `urlParam` | array of objects | Extra search URL parameters as `key` and `value` pairs, such as `industryNId`. |
| `excludeJobIds` | array of strings | Glassdoor job IDs to skip. |

Boolean filters apply only when `true`. `false` doesn't add the restriction.

## Output

One item per job. Fields can be missing when Glassdoor doesn't show them, such as `pay`.

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | Glassdoor job ID |
| `title` | string | Job title |
| `url` | string | Listing URL |
| `seoUrl` | string | Readable listing URL, when available |
| `ageInDays` | number | Approximate age of the listing in days |
| `rating` | number | Company rating, when available |
| `easyApply` | boolean | Can be applied to on Glassdoor |
| `employer` | object | `id`, `name`, `url` (Glassdoor company page), `logoUrl` |
| `location` | object | `countryId`, `id`, `name` (such as `New York, NY`), `type` |
| `pay` | object | `source`, `currency`, `period`, `min`, `max`, when available |
| `description` | string | Job description, which may contain HTML |

There is no posted date field, so post day is calculated from `ageInDays`.

## Output example

From the store page.

```json
{
  "id": 1010062906489,
  "title": "Senior Engineer - Applied AI (Java)",
  "url": "https://www.glassdoor.com/job-listing/j?jl=1010062906489",
  "seoUrl": "https://www.glassdoor.com/job-listing/senior-engineer-applied-ai-java-geico-JV_IC1132348_KO0,31_KE32,37.htm?jl=1010062906489",
  "ageInDays": 12,
  "rating": 2.6,
  "easyApply": false,
  "employer": {
    "id": 270,
    "name": "Government Employees Insurance Company",
    "url": "https://www.glassdoor.com/Overview/W-EI_IE270.htm",
    "logoUrl": "https://media.glassdoor.com/sql/270/geico-squareLogo-1730389987906.png"
  },
  "location": {
    "countryId": 1,
    "id": 1132348,
    "name": "New York, NY",
    "type": "C"
  },
  "pay": {
    "source": "EMPLOYER_PROVIDED",
    "currency": "USD",
    "period": "ANNUAL",
    "min": 100000,
    "max": 215000
  },
  "description": "<div><!-- html description --></div>"
}
```
