from job_model import Job
from application_tracker import update_application_tracker
from resume_matcher import match_resume_to_job
from scoring import Score


def test_resume_matcher_reports_missing_keywords():
    profile = {"strength_keywords": ["python", "sql", "rag"]}
    job = Job(
        source="Example",
        title="Machine Learning Intern",
        company="Example",
        location="Singapore",
        url="https://example.com/job",
        description="Build Python SQL pipelines with Docker and Kubernetes.",
    )

    match = match_resume_to_job(
        job,
        profile,
        ["python", "sql", "docker", "kubernetes", "rag"],
    )

    assert match.coverage_percent == 50
    assert match.tracked_keywords_found == 4
    assert match.matched_keywords == ["python", "sql"]
    assert match.missing_keywords == ["docker", "kubernetes"]


def test_resume_matcher_does_not_report_empty_keyword_set_as_perfect_match():
    job = Job(
        source="Example",
        title="Marketing Intern",
        company="Example",
        location="Singapore",
        url="https://example.com/job",
        description="Brand growth role.",
    )

    match = match_resume_to_job(job, {"strength_keywords": ["python"]}, ["python"])

    assert match.coverage_percent == 0
    assert match.tracked_keywords_found == 0


def test_application_tracker_creates_and_updates_rows(tmp_path):
    path = tmp_path / "applications.csv"
    job = Job(
        source="Example",
        title="Data Engineer Intern",
        company="Example",
        location="Singapore",
        url="https://example.com/job",
    )
    score = Score(80, 75, 90, 80, 60, 77, "Recent posting")
    match = match_resume_to_job(job, {"strength_keywords": ["python"]}, ["python"])

    update_application_tracker(str(path), job, score, match, notes="review")
    update_application_tracker(str(path), job, score, match, notes="updated")

    rows = path.read_text(encoding="utf-8").splitlines()

    assert len(rows) == 2
    assert "Data Engineer Intern" in rows[1]
    assert "updated" in rows[1]
