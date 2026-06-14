# Singapore Internship Job Monitor

Monitors public Singapore internship postings for Data Engineering, AI/ML, LLM,
Generative AI, and RAG roles, then sends Telegram alerts for fresh high-signal
matches.

The project avoids LinkedIn and login-based scraping. It uses public pages/APIs,
polite request spacing, retry logic, SQLite deduplication, and configurable
source lists.

## What It Checks

- InternSG public listings
- Greenhouse public job boards
- Lever public job boards
- Ashby public job boards
- SmartRecruiters public job boards
- Configured Workday CXS endpoints
- Direct company career pages, best-effort HTML scan
- MyCareersFuture, optional and disabled by default because public endpoints can change
- Company boards you add in `config.yaml`

The default company coverage emphasizes Singapore internships across data
engineering, RAG/AI, machine learning, software engineering, analytics, cloud,
cybersecurity, and technology consulting. It includes public-sector and tech
targets such as GovTech, Open Government Products, DSTA, CSIT, Careers@Gov,
Accenture, Google, Microsoft, Amazon, Apple, Meta, TikTok, ByteDance, Shopee,
Sea, Grab, NVIDIA, Salesforce, Oracle, SAP, IBM, Dell, HP, AMD, Qualcomm,
Micron, PayPal, ServiceNow, Atlassian, Canva, Workato, Razer, ST Engineering,
Visa, Mastercard, Bloomberg, GIC, and Temasek.

## Alert Rules

The default config alerts only when all of these pass:

- overall relevance >= 70
- timeline relevance >= 80
- location relevance >= 70
- posting is within the last 24 hours
- unknown posting time appears for the first time in the SQLite database

The scoring model evaluates role, skills, Singapore location, August/September
2027 internship fit, and undergraduate/Bachelor's degree fit.

The monitor also sends a one-time update when it first discovers a new
actionable Singapore tech/CS internship posting that passes the actionable
filters, even if it does not meet the stricter high-confidence alert threshold.

```yaml
new_actionable_alerts:
  enabled: true
  min_overall: 55
  min_location: 70
```

## 15-Minute Heartbeat

The monitor is temporarily set to send one Telegram heartbeat every 15 minutes
for verification, even
when no job alerts are sent. It includes the latest run time plus fetched,
matched, sent, and per-source fetched counts.

To change this, edit `config.yaml`:

```yaml
heartbeat:
  enabled: true
  interval_hours: 0.25
```

## 15-Minute Near-Match Digest

The monitor also sends one digest every 15 minutes of promising jobs that did not pass the
strict alert thresholds. These are worth manual review because career pages often
omit exact internship dates or use broad role titles. Digest entries include
resume keyword coverage, missing resume keywords, and a referral suggestion for
priority companies.

Digest entries must still pass the actionable-candidate filter: Singapore
location, internship title, technical relevance, and no senior/manager,
marketing, sales, support, or other non-target role terms.

```yaml
near_match_digest:
  enabled: true
  interval_hours: 0.25
  max_items: 10
  min_overall: 55
  min_location: 70
```

## Manual Review Digest

Some valuable sources, especially Indeed, MyCareersFuture, and broad Google
Careers searches, may block automation or render dynamically. The monitor sends
a manual-review digest every 15 minutes with direct links for those sources instead of
pretending it scraped them reliably.

```yaml
manual_review_digest:
  enabled: true
  interval_hours: 0.25
```

## Resume Matching

The monitor reads `resume_profile.yaml` and compares each promising job against
tracked resume keywords. This does not commit your original resume document.

```yaml
resume_profile_path: resume_profile.yaml
resume_match:
  tracked_keywords:
    - python
    - sql
    - docker
    - kubernetes
```

## Application Tracker

Promising strict matches and near matches are written to `applications.csv` with
status, score, resume coverage, missing keywords, and notes. GitHub Actions
preserves it in the workflow cache and uploads it as an artifact when present.

```yaml
application_tracker:
  enabled: true
  path: applications.csv
```

## Weekly Summary

The monitor sends a weekly Telegram summary with fetched postings reviewed,
actionable Singapore tech internships found, strict alerts, top actionable
companies, and common missing resume keywords. Fetched postings are not the same
thing as apply-worthy internships.

```yaml
weekly_summary:
  enabled: true
  interval_hours: 168
```

## Telegram Format

Alerts are sent with Telegram HTML parse mode:

```text
🚨 New Internship Match

Job Title
Company
Location
Source
Posted Time
Relevance Score
Timeline Match

Apply Here
```

The job title and `Apply Here` both link to the posting.

## Local Setup

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

Edit `config.yaml` to tune company boards, keywords, schedule, and thresholds.

Run one check:

```powershell
python main.py --once
```

Run continuously every 2 hours:

```powershell
python main.py
```

For optional 30-minute checks, change:

```yaml
check_interval_minutes: 30
```

## GitHub Actions

The workflow is at `.github/workflows/job-monitor.yml` and is temporarily set to
run every 15 minutes for verification.
After you add the Telegram secrets, you do not need to manually run it for the
regular checks. GitHub starts it automatically from the cron schedule even when
your computer is off.

Add these repository secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

The workflow restores and saves `jobs.sqlite3` with `actions/cache` so jobs
without exact posting times do not repeatedly alert on every scheduled run.

Manual runs are only for testing or forcing an immediate check. Manual runs can
send start/finish status messages; scheduled runs send job alerts,
near-match digest, manual-review digest, heartbeat, and weekly summary when due.

## Docker

Build:

```bash
docker build -t sg-internship-job-monitor .
```

Run continuously:

```bash
docker run --env-file .env -v "%cd%/jobs.sqlite3:/app/jobs.sqlite3" sg-internship-job-monitor
```

Run once:

```bash
docker run --env-file .env -v "%cd%/jobs.sqlite3:/app/jobs.sqlite3" sg-internship-job-monitor python main.py --once
```

## Add More Company Boards

For application strategy, resume positioning, and referral workflow, see
`HIRING_PLAYBOOK.md`.

For sources that are useful but unreliable to scrape unattended, such as Indeed
and broad Google Careers/MyCareersFuture searches, see `MANUAL_SEARCH_LINKS.md`.

Greenhouse board token:

```text
https://job-boards.greenhouse.io/openai -> openai
```

Lever company slug:

```text
https://jobs.lever.co/stripe -> stripe
```

Add tokens under `sources.greenhouse.boards` or `sources.lever.companies` in
`config.yaml`.

Ashby board slug:

```text
https://jobs.ashbyhq.com/anthropic -> anthropic
```

Add slugs under `sources.ashby.boards`.

SmartRecruiters company identifier:

```yaml
sources:
  smartrecruiters:
    enabled: true
    companies:
      - Visa
```

Workday endpoints are company-specific. Add them only after confirming the
public CXS endpoint:

```yaml
sources:
  workday:
    enabled: true
    sites:
      - name: Example
        company: Example
        endpoint: https://example.wd1.myworkdayjobs.com/wday/cxs/example/site/jobs
        career_base_url: https://example.wd1.myworkdayjobs.com/site
```

Direct career page:

```yaml
sources:
  careers_pages:
    enabled: true
    pages:
      - name: Example
        company: Example
        url: https://example.com/careers
        default_location: Singapore
```

Direct career-page scans are best effort. API-backed Greenhouse, Lever, and
Ashby sources are more reliable.

The default direct career-page list includes Singapore public-sector and
consulting targets such as GovTech, Open Government Products, Careers@Gov,
Accenture Singapore, DSTA, and CSIT.

## Tests

```powershell
pytest
```

Current focused tests cover scoring thresholds, timeline rejection, freshness for
unknown post times, SQLite notification dedupe, and Telegram HTML formatting.
