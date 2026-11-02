# LinkedIn Jobs actor

[`worldunboxer/rapid-linkedin-scraper`](https://apify.com/worldunboxer/rapid-linkedin-scraper) collects public LinkedIn job listings without a LinkedIn login. Job Collection runs it once per LinkedIn search to find Jobs posted in the last 24 hours. It costs $0.10 per 1,000 listings, plus $0.20-$0.25 per 1,000 for full details.

## Input

All fields are optional.

| Field | Type | Description |
| --- | --- | --- |
| `jobs_titles` | array of strings | Job titles to search for. Each title is searched separately and the results are merged. |
| `location` | string | A broad location (`Worldwide`, `Europe`) or a full one (`San Francisco, CA`). |
| `include_job_details` | boolean | Default `true`. Opens each job page to add the description, seniority, employment type, industries, applicants, salary and Easy Apply. |
| `posted_within` | string | `Any Time`, `Past 24 hours`, `Past Week` or `Past Month`. Overrides `job_post_time`. |
| `easy_apply` | boolean | Only jobs with Easy Apply. |
| `early_applicant_only` | boolean | Only jobs marked "Be an early applicant". |
| `include_contact_details` | boolean | Default `false`. Returns contact details written in the description. Needs `include_job_details`. |
| `jobs_entries` | integer | Number of jobs to collect, from 10 to 100,000. Default 1,000. |
| `company_names` | array of strings | Only these companies. |
| `cities` | array of strings | Cities, each searched on its own without `location`. |
| `distance` | integer | Radius in miles around the location. LinkedIn's default is 25. |
| `search_urls` | array of strings | LinkedIn job search URLs, used instead of the search fields. |
| `jobs_per_url` | integer | Most jobs taken from each search URL. Minimum 10. |
| `geo_ids` | array | LinkedIn location IDs (the number after `geoId=`). |
| `company_ids` | array | LinkedIn company IDs (the number after `f_C=`). |
| `exclude_job_ids` | array | LinkedIn job IDs to skip. They aren't returned or charged. |
| `job_post_time` | string | Custom posting window in seconds, such as `86400`. Used only when `posted_within` is unset. |

## Output

One item per job. Fields LinkedIn doesn't show for a job are `null`. Fields marked "details" are `null` when `include_job_details` is off.

| Field | Type | Description |
| --- | --- | --- |
| `job_id` | string | LinkedIn job ID |
| `job_url` | string | Job page on LinkedIn |
| `search_keyword` | string | Title whose search found the job |
| `job_title` | string | Job title |
| `company_name` | string | Hiring company |
| `company_url` | string | Company's LinkedIn page, when available |
| `company_id` | string | LinkedIn company ID (details) |
| `company_logo_url` | string | Logo image URL |
| `location` | string | Job location |
| `time_posted` | string | Relative time, such as "2 days ago" |
| `posted_date` | string | ISO date, such as `2026-09-24` |
| `hiring_badge` | string | LinkedIn badge, such as "Actively Hiring" |
| `is_actively_hiring` | boolean | Has the "Actively Hiring" badge |
| `is_early_applicant` | boolean | Has the early applicant badge |
| `num_applicants` | string | Applicant count (details) |
| `salary_range` | string | Salary, only when published (details) |
| `job_description` | string | Description as plain text (details) |
| `job_description_raw_html` | string | Description as HTML (details) |
| `contact_email` | string | Only with `include_contact_details` |
| `seniority_level` | string | Seniority (details) |
| `employment_type` | string | Such as Full-time (details) |
| `industries` | string | Industries (details) |
| `easy_apply` | boolean | Has Easy Apply (details) |

## Output example

From the store page, with placeholder values.

```json
{
  "job_id": "1234567890",
  "job_url": "https://www.linkedin.com/jobs/view/1234567890",
  "search_keyword": "Software Engineer",
  "job_title": "Senior Software Engineer",
  "company_name": "Tech Corp",
  "company_url": "https://www.linkedin.com/company/tech-corp",
  "company_id": "1234567",
  "company_logo_url": "https://media.licdn.com/dms/image/...",
  "location": "New York, NY",
  "time_posted": "2 days ago",
  "posted_date": "2026-09-24",
  "hiring_badge": "Actively Hiring",
  "is_actively_hiring": true,
  "is_early_applicant": false,
  "num_applicants": "45",
  "salary_range": "$120,000/yr - $160,000/yr",
  "job_description": "We are looking for an experienced Software Engineer...",
  "job_description_raw_html": "<div>We are looking for an experienced Software Engineer...</div>",
  "contact_email": null,
  "seniority_level": "Mid-Senior level",
  "employment_type": "Full-time",
  "industries": "Information Technology",
  "easy_apply": true
}
```
