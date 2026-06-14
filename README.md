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
matched, and sent counts.

To change this, edit `config.yaml`:

```yaml
heartbeat:
  enabled: true
  interval_hours: 24
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

## Tests

```powershell
pytest
```

Current focused tests cover scoring thresholds, timeline rejection, freshness for
unknown post times, SQLite notification dedupe, and Telegram HTML formatting.
