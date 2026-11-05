# Emails actor

[`vulnv/linkedin-email-finder`](https://apify.com/vulnv/linkedin-email-finder) finds business email addresses for LinkedIn profile URLs. The Decision Maker search runs it for only as many people as still need an email. Emails aren't verified. It costs from $0.026 per email found.

## Input

| Field | Type | Description |
| --- | --- | --- |
| `urls` | array of strings | LinkedIn profile URLs of the people to find emails for. |

## Output

One item per URL. A failed lookup has `found: false` and an `error` instead of the contact fields.

| Field | Type | Description |
| --- | --- | --- |
| `linkedin_url` | string | The profile URL that was looked up |
| `found` | boolean | Whether an email was found |
| `email` | string | Email address, when found |
| `name` | string | Person's name, when found |
| `domain` | string | Email domain, when found |
| `company` | string | Company, when found |
| `error` | string | Why no email was found, such as "No email found in response" |

`linkedin_url` is normalized by the actor, so it's matched to the looked-up URL ignoring protocol, `www`, case and a trailing slash.

## Output example

From the store page. A real run on 2026-11-05 returned the same fields.

```json
{
  "linkedin_url": "https://www.linkedin.com/in/williamhgates/",
  "found": true,
  "email": "bill@microsoft.com",
  "name": "Bill Gates",
  "domain": "microsoft.com",
  "company": "Bill & Melinda Gates Foundation"
}
```
