from job_model import Job
from notifier import format_job_message
from scoring import Score


def test_telegram_message_uses_html_links_and_score():
    job = Job(
        source="InternSG",
        title="Data Engineering Intern",
        company="Grab",
        location="Singapore",
        url="https://example.com/job?a=1&b=2",
    )
    score = Score(
        role_relevance=95,
        skill_relevance=90,
        location_relevance=90,
        timeline_relevance=100,
        degree_relevance=85,
        overall=92,
        timeline_match="Summer 2027",
    )

    message = format_job_message(job, score)

    assert "🚨 <b>New Internship Match</b>" in message
    assert "<b><a href=\"https://example.com/job?a=1&amp;b=2\">" in message
    assert "<b>Relevance Score</b>: 92/100" in message
    assert "<a href=\"https://example.com/job?a=1&amp;b=2\">Apply Here</a>" in message
