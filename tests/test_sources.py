from sources.ashby import fetch_ashby_boards
from sources.careers_page import fetch_careers_pages


class FakeResponse:
    def __init__(self, *, text="", data=None, status_code=200):
        self.text = text
        self._data = data
        self.status_code = status_code

    def json(self):
        return self._data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.urls = []

    def get(self, url, **kwargs):
        self.urls.append(url)
        return self.responses.pop(0)


def test_fetch_ashby_boards_maps_jobs():
    client = FakeClient(
        [
            FakeResponse(
                data={
                    "jobs": [
                        {
                            "title": "Machine Learning Intern",
                            "location": {"name": "Singapore"},
                            "jobUrl": "https://jobs.ashbyhq.com/example/1",
                            "publishedAt": "2026-06-14T00:00:00Z",
                            "descriptionPlain": "Python ranking internship",
                        }
                    ]
                }
            )
        ]
    )

    jobs = fetch_ashby_boards(["example"], client)

    assert len(jobs) == 1
    assert jobs[0].source == "Ashby:example"
    assert jobs[0].title == "Machine Learning Intern"
    assert jobs[0].location == "Singapore"
    assert jobs[0].posted_at is not None


def test_fetch_careers_pages_keeps_relevant_links():
    client = FakeClient(
        [
            FakeResponse(
                text="""
                <html>
                  <body>
                    <a href="/jobs/ml-intern">Machine Learning Intern</a>
                    <a href="/about">About us</a>
                  </body>
                </html>
                """
            )
        ]
    )

    jobs = fetch_careers_pages(
        [
            {
                "name": "Example",
                "company": "Example",
                "url": "https://example.com/careers",
                "default_location": "Singapore",
            }
        ],
        client,
    )

    assert len(jobs) == 1
    assert jobs[0].title == "Machine Learning Intern"
    assert jobs[0].url == "https://example.com/jobs/ml-intern"
    assert jobs[0].location == "Singapore"
