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
- Direct company career pages, best-effort HTML scan
- MyCareersFuture, optional and disabled by default because public endpoints can change
- Company boards you add in `config.yaml`

## Alert Rules

The default config alerts only when all of these pass:

- overall relevance >= 70
- timeline relevance >= 80
- location relevance >= 70
- posting is within the last 24 hours
- unknown posting time appears for the first time in the SQLite database

The scoring model evaluates role, skills, Singapore location, August/September
2027 internship fit, and undergraduate/Bachelor's degree fit.

## Daily Heartbeat

The monitor sends one Telegram heartbeat message every 24 hours by default, even
when no job alerts are sent. It includes the latest run time plus fetched,
matched, sent, and per-source fetched counts.

To change this, edit `config.yaml`:

```yaml
heartbeat:
  enabled: true
  interval_hours: 24
```

## Daily Near-Match Digest

The monitor also sends one daily digest of promising jobs that did not pass the
strict alert thresholds. These are worth manual review because career pages often
omit exact internship dates or use broad role titles.

```yaml
near_match_digest:
  enabled: true
  interval_hours: 24
  max_items: 10
  min_overall: 45
  min_location: 35
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

The workflow is at `.github/workflows/job-monitor.yml` and runs every 2 hours.

Add these repository secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

The workflow restores and saves `jobs.sqlite3` with `actions/cache` so jobs
without exact posting times do not repeatedly alert on every scheduled run.

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

## Tests

```powershell
pytest
```

Current focused tests cover scoring thresholds, timeline rejection, freshness for
unknown post times, SQLite notification dedupe, and Telegram HTML formatting.
