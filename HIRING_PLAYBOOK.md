# Hiring Playbook

Use the monitor as an early-warning system, not as the whole job search.

## Daily Routine

1. Check Telegram job alerts first. Apply to strict matches within 24 hours.
2. Review the daily near-match digest. Some strong roles omit exact dates or use
   broad titles, so manually inspect the top 10.
3. For any priority company, look for a referral before applying.
4. Track each application in a spreadsheet or issue tracker with status:
   `found`, `referral_requested`, `applied`, `interview`, `rejected`, `offer`.

## Best Channels

- Direct company career pages
- Greenhouse, Lever, and Ashby company boards
- MyCareersFuture
- InternSG
- Glints
- NodeFlair
- Prosple Singapore
- University career portals
- LinkedIn alerts, checked manually

Do not rely on a single portal. Direct company pages usually get postings first.

## Target Roles

Use multiple search angles because companies name internships inconsistently:

- Software Engineer Intern
- Backend Engineer Intern
- Data Engineer Intern
- Analytics Engineer Intern
- Machine Learning Intern
- AI Engineer Intern
- Data Science Intern
- Platform Engineer Intern
- Infrastructure Engineer Intern
- Search / Ranking / Recommendation Intern

## Resume Versions

Keep at least two versions:

- Backend/Data Engineering: Python, SQL, APIs, databases, data pipelines,
  Spark, Airflow, Docker, cloud.
- AI/ML: Python, PyTorch, model evaluation, RAG, embeddings, vector databases,
  LLM applications, data processing.

Each resume should lead with projects that match the role, not every project you
have ever done.

## Projects That Convert Better

Strong internship projects look deployed, measurable, and maintainable:

- RAG app with evaluation, citations, and failure analysis.
- Job monitor/dashboard with dedupe, scoring, alerts, and CI.
- Data pipeline with ingestion, validation, storage, and scheduled runs.
- Search or recommendation prototype with ranking metrics.
- Backend API with auth, tests, Docker, and real deployment.

For each project, write bullets with impact:

```text
Built a scheduled Python data pipeline that monitors 4,000+ postings per run,
deduplicates with SQLite, scores relevance, and sends Telegram alerts.
```

## Referral Message Template

```text
Hi <Name>, I saw <Company> is hiring for <Role>. I am a student targeting
backend/data/AI internships and built projects around <specific relevant skill>.
Would you be open to referring me or sharing what the team looks for?

Role: <link>
Resume: <link>
```

Keep it short. Attach a role link and a targeted resume.

## Weekly Review

Every week, review:

- How many roles were found.
- How many you applied to.
- How many had referrals.
- Which resume version performed better.
- Which companies repeatedly post relevant roles.

Then update `config.yaml` with new company boards and keywords.
