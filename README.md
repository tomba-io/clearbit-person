# Tomba Clearbit Person Enrichment

[![Price](https://img.shields.io/badge/Price-%243.12%20per%201K%20emails-brightgreen)](#pricing)
[![No signup](https://img.shields.io/badge/Tomba%20account-not%20needed-blue)](#quick-start)
[![No rate limit](https://img.shields.io/badge/Rate%20limit-none-brightgreen)](#built-for-big-lists)

**Know who is behind every email address.** Paste a list of emails and get each person's full name, job title, role, company, location, LinkedIn and Twitter profiles and email verification status, ready to export to your CRM or spreadsheet.

No Tomba account. No API key. No subscription. **You pay $0.00312 per email, and only when we find the person.**

## Why teams choose this Actor

- **Start in 30 seconds**: Open the Actor, paste your emails, click Start. Nothing to sign up for
- **Pay only for results**: Emails with no profile, errors and invalid inputs are free
- **$3.12 per 1,000 emails**: No monthly plan, no credits that expire, no minimum spend
- **One row per person**: Name, job, company, location and social profiles in a single record
- **Built for big lists**: No rate limit. Hundreds of emails run in parallel
- **Never pay twice**: Emails you looked up in the last 24 hours come back from cache for free
- **Clean input, clean output**: Emails are trimmed and lowercased, and duplicates are removed automatically
- **Export anywhere**: Download as CSV, Excel or JSON, or send results straight to your CRM with Apify integrations

## What you can do with it

| Goal                      | How person data helps                                                        |
| ------------------------- | ---------------------------------------------------------------------------- |
| **Qualify inbound leads** | See the job title and role of every sign-up and prioritize decision makers   |
| **Enrich your CRM**       | Fill in missing names, titles, companies, locations and LinkedIn profiles    |
| **Personalize outreach**  | Address people by name and tailor your message to their role and company     |
| **Clean your lists**      | Check the verification status of each email before you send a campaign       |
| **Route leads faster**    | Send contacts to the right rep by country, company or seniority              |
| **Research candidates**   | Get the professional background of applicants or partners from just an email |

## Quick start

1. Click **Try for free**
2. Paste your emails into **Emails to Enrich** (for example `john@stripe.com`)
3. Click **Start**, then download your results as CSV, Excel or JSON

That's it. No Tomba account or API key is needed.

## Input

| Field            | Required | Default | Description                                                   |
| ---------------- | -------- | ------- | ------------------------------------------------------------- |
| `emails`         | Yes      |         | Email addresses to enrich. Case and extra spaces don't matter |
| `maxResults`     | No       | `50`    | Maximum number of emails to enrich (up to 1,000)              |
| `maxConcurrency` | No       | `10`    | How many emails to process at the same time (1–50)            |
| `maxRetries`     | No       | `3`     | How many times to retry a temporary failure (0–10)            |
| `useCache`       | No       | `true`  | Reuse results from your previous runs for free                |
| `cacheTtlHours`  | No       | `24`    | How long cached results stay valid (`0` turns the cache off)  |

```json
{
    "emails": ["john@stripe.com", "contact@tomba.io"],
    "maxResults": 500
}
```

## Output

You get one row per email:

```json
{
    "name": {
        "fullName": "John Doe",
        "givenName": "John",
        "familyName": "Doe"
    },
    "email": "john@example.com",
    "location": "US",
    "gender": "male",
    "geo": {
        "city": "San Francisco",
        "state": "California",
        "country": "United States",
        "countryCode": "US"
    },
    "employment": {
        "domain": "example.com",
        "name": "Example Inc",
        "title": "Senior Software Engineer",
        "role": "engineering"
    },
    "linkedin": { "handle": "https://www.linkedin.com/in/johndoe" },
    "twitter": { "handle": "https://twitter.com/johndoe" },
    "verification": {
        "date": "2026-09-20T00:00:00+02:00",
        "status": "valid"
    },
    "phone": true,
    "source": "tomba_person_enrichment",
    "charged": true,
    "cached": false
}
```

| Field                 | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `email`               | The email you submitted (lowercased)                             |
| `name`                | Full name, first name and last name                              |
| `gender`              | Gender, when known                                               |
| `location`, `geo`     | Country code, city, state and country                            |
| `employment`          | Company name and domain, job title and role                      |
| `linkedin`, `twitter` | Social profile links                                             |
| `verification`        | Email verification status (e.g. `valid`) and when it was checked |
| `phone`               | `true` if a phone number is known for this person                |
| `source`              | Always `tomba_person_enrichment`                                 |
| `charged`             | `true` if this lookup was billed                                 |
| `cached`              | `true` if this result came from the cache (free)                 |
| `error`               | Why no profile was returned, if applicable                       |

Fields are filled when the information is publicly available, so some profiles have fewer of them. Emails with no data still get a row with `email`, `charged: false` and an `error`, so nothing silently disappears from your list.

## Pricing

**$0.00312 per email ($3.12 per 1,000).** No subscription and no Tomba account needed.

You are only charged when Tomba returns a usable answer:

| What happens                                    | Charged |
| ----------------------------------------------- | ------- |
| Person profile found for the email              | Yes     |
| No profile found for the email                  | No      |
| Invalid email or any other error                | No      |
| Temporary failure (it is retried automatically) | No      |
| Result served from the cache                    | No      |

Every row shows `charged` and `cached`, so you always know what you paid for. To cap your spend, set **Maximum cost per run** in the run options: the Actor stops cleanly when the limit is reached.

## Built for big lists

- **No rate limit**: up to 50 emails are processed at the same time
- **Automatic retries**: temporary failures are retried for you, and never billed
- **Resumable**: if a run is interrupted, it continues where it stopped without charging you again
- **Cache**: repeat lookups within 24 hours are free

## Integrations

Run it on a schedule, call it from the Apify API, or connect it to Zapier, Make, Google Sheets, HubSpot, Slack and hundreds of other apps with [Apify integrations](https://docs.apify.com/platform/integrations). Webhooks let you trigger your own workflow as soon as a run finishes.

## FAQ

**Do I need a Tomba account or API key?**
No. Everything is built in. You only pay the per-email price on Apify.

**How much does it cost?**
$0.00312 per email with results ($3.12 per 1,000). Emails with no results, errors and cached lookups are free.

**How many emails can I enrich in one run?**
Up to 1,000 per run, processed in parallel. There is no rate limit.

**Which emails work best?**
Business emails like `jane@company.com`. Personal addresses (Gmail, Outlook) and shared inboxes like `info@` usually have no public profile, and you aren't charged when nothing is found.

**Why are some fields empty?**
We only return what is publicly known about the person. Some profiles include everything, others only a name and company.

**Do I also get company details?**
This Actor focuses on the person and their current employer's name and domain. For a full company profile (size, revenue, industry, tech stack) in the same row, use the Tomba Clearbit Combined Actor.

**What if my run is interrupted?**
It picks up where it stopped. Emails already processed are not charged again.

**How do I limit what I spend?**
Set **Maximum cost per run** before you start. The Actor stops as soon as the limit is reached.

## Support

Questions or feedback? We're happy to help:

- **Email**: support@tomba.io
- **Live chat**: on [tomba.io](https://tomba.io) during business hours
- **Issues**: use the **Issues** tab on this Actor's page

## About Tomba

Founded in 2020, [Tomba](https://tomba.io) is a B2B data platform for finding, verifying and enriching business contacts. Our Email Finder, Domain Search and Email Verifier help sales and marketing teams reach the right people.

![Tomba Logo](https://tomba.io/logo.png)
