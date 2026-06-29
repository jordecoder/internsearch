# Data Analytics Pipeline & KPI Monitoring System

An end-to-end data ingestion, scoring, and automated reporting pipeline built in Python. Aggregates structured job-market data from 10+ sources, applies a configurable multi-dimensional relevance scoring framework, tracks KPIs in SQLite, and delivers daily/weekly analytics digests via Telegram.

**Tech stack:** Python · SQLite · GitHub Actions · Docker · REST APIs · YAML config · pytest

---

## What This Demonstrates

| Capability | Implementation |
|---|---|
| Multi-source data ingestion | 10+ heterogeneous APIs and HTML sources, normalized into a unified schema |
| Data quality scoring framework | 5-dimensional weighted scoring model (role, skill, location, timeline, degree) |
| KPI tracking & monitoring | SQLite-backed metrics store with per-run telemetry and trend summaries |
| Automated reporting & digests | Daily/weekly analytics summaries with actionable recommendations |
| Keyword gap analysis | Cross-references target profiles against data signals to surface skill gaps |
| Pipeline reliability | Rate-limited HTTP client, retry logic, deduplication, structured logging |
| Scheduled automation | GitHub Actions cron workflow; also containerized via Docker |

---

## Architecture

```
Data Sources (10+)          Scoring Engine              Reporting Layer
────────────────────        ──────────────────          ─────────────────────
Greenhouse API    ─┐        role_relevance   ─┐         Real-time Telegram alerts
Lever API         ─┤        skill_relevance  ─┤         Daily near-match digest
Ashby API         ─┤──► normalize ──► score ─┼──► KPI ──► Weekly summary report
SmartRecruiters   ─┤        location         ─┤   store   Keyword gap analysis
LinkedIn API      ─┤        timeline         ─┤           Application CSV tracker
MyCareersFuture   ─┤        degree_match     ─┘
NodeFlair, etc.   ─┘             │
                           SQLite dedup +
                           metadata store
```

---

## Scoring Framework

Each data record is scored across 5 weighted dimensions and aggregated into an overall quality score (0–100):

```
overall = role(0.25) + skill(0.25) + location(0.20) + timeline(0.20) + degree(0.10)
```

Configurable thresholds determine which records advance to the alert/reporting stage:

```yaml
thresholds:
  overall: 70
  timeline: 80
  location: 70
```

---

## KPI Tracking

Every pipeline run records the following metrics to SQLite and surfaces them in reports:

- **Fetched:** total records ingested across all sources
- **Actionable:** records passing quality and relevance filters
- **Strict matches:** records exceeding all alert thresholds
- **Alerts sent:** downstream notifications dispatched
- **Per-source counts:** breakdown by data source for quality monitoring

```yaml
# Example weekly summary output
Fetched postings reviewed: 1,240
Actionable candidates: 38
Strict alerts sent: 12
Top actionable companies: [TikTok, Grab, GovTech, ...]
Common resume keyword gaps: [spark, dbt, airflow, ...]
```

---

## Automated Reporting

**Real-time alerts** — sent immediately when a record exceeds strict quality thresholds.

**Daily near-match digest** — ranks borderline records by score and delivers them every 3 hours with resume coverage notes and gap recommendations.

**Daily manual-review digest** — surfaces sources that cannot be reliably automated, sent at 20:00 SGT.

**Weekly analytics summary** — aggregates pipeline performance, top sources by quality output, and most common keyword gaps across the week.

**Heartbeat** — daily pipeline health confirmation with per-source telemetry.

---

## Keyword Gap Analysis

The pipeline cross-references a target skill profile against each record's text signals. Missing keywords are counted across all records and surfaced in the weekly summary, enabling data-driven profile optimisation.

```python
# resume_matcher.py
@dataclass
class ResumeMatch:
    matched_keywords: list[str]
    missing_keywords: list[str]
    coverage_score: float
```

---

## Data Sources

| Source | Type | Notes |
|---|---|---|
| Greenhouse | REST API | Structured JSON, most reliable |
| Lever | REST API | Structured JSON |
| Ashby | REST API | Structured JSON |
| SmartRecruiters | REST API | Company-configurable |
| LinkedIn | Guest API | Rate-limited, polite spacing |
| MyCareersFuture | REST API | Singapore government jobs portal |
| InternSG | HTML scraper | Best-effort extraction |
| NodeFlair | REST API | Singapore tech-focused |
| Workday | CXS endpoint | Company-specific configuration |
| Career pages | HTML scraper | Direct company sites |

---

## Opportunity Classification

Records are classified by type to prevent false positives in KPI counts:

- `job_posting` — exact, apply-worthy listing
- `internship_programme_page` — general programme pages (excluded from strict alerts)
- `career_page` — general careers landing pages
- `manual_search_link` — sources requiring human review

Each record is also tagged by role family: Data Engineering, AI/ML/RAG, Software Engineering, Cybersecurity, Cloud/DevOps, Tech Consulting, or Product/Technical Analyst.

---

## Application Tracker

Qualifying records are written to `applications.csv` with the full analytics context:

| Column | Description |
|---|---|
| score | Overall quality score (0–100) |
| role_relevance | Role dimension sub-score |
| skill_relevance | Skill dimension sub-score |
| resume_coverage | Matched keyword count |
| missing_keywords | Gap keywords for profile optimisation |
| opportunity_type | Classification label |
| role_family | Role family tag |
| deadline | Estimated deadline extracted from text |
| recommended_action | Pipeline-generated next-step recommendation |

The tracker preserves manual status updates (`found`, `applied`, `interview`, `offer`, etc.) and only updates analytics fields on subsequent runs.

---

## Setup

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Configure `.env`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

Run one pipeline pass:

```powershell
python main.py --once
```

Run continuously (every 3 hours by default):

```powershell
python main.py
```

---

## GitHub Actions

Scheduled pipeline runs every 3 hours via `.github/workflows/job-monitor.yml`. SQLite state is persisted across runs using `actions/cache`. Required secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

---

## Docker

```bash
docker build -t data-analytics-pipeline .
docker run --env-file .env -v "%cd%/jobs.sqlite3:/app/jobs.sqlite3" data-analytics-pipeline
```

---

## Telegram Bot Commands

```
/status    — latest pipeline run KPIs
/recent    — recently ingested records
/sources   — per-source ingestion counts
/schedule  — pipeline run schedule (SGT)
/date      — posting and discovery timestamps for a specific record
```

---

## Tests

```powershell
pytest
```

Tests cover scoring thresholds, timeline rejection, freshness logic, SQLite deduplication, and Telegram HTML formatting.

---

## Adding Data Sources

**Greenhouse** — add board token from `https://job-boards.greenhouse.io/<token>` to `sources.greenhouse.boards` in `config.yaml`.

**Lever** — add company slug from `https://jobs.lever.co/<slug>` to `sources.lever.companies`.

**Ashby** — add board slug from `https://jobs.ashbyhq.com/<slug>` to `sources.ashby.boards`.

**Workday** — add the company's CXS endpoint to `sources.workday.sites`.

**Career pages** — add direct URL to `sources.careers_pages.pages` for best-effort HTML extraction.

See `ADD_MORE_COMPANIES.md` for the full list of currently monitored companies and `HIRING_PLAYBOOK.md` for sourcing and referral strategy.
