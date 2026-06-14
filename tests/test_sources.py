from sources.ashby import fetch_ashby_boards
from sources.careers_page import fetch_careers_pages
from sources.internsg import fetch_internsg
from sources.smartrecruiters import fetch_smartrecruiters_companies
from sources.workday import fetch_workday_sites
from main import fetch_all_jobs


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

    def post(self, url, **kwargs):
        self.urls.append(url)
        return self.responses.pop(0)


class FailingClient(FakeClient):
    def __init__(self):
        super().__init__([])

    def get(self, url, **kwargs):
        raise RuntimeError("network failed")


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
            ),
            FakeResponse(
                text="""
                <html>
                  <body>
                    <h1>Machine Learning Intern</h1>
                    <p>Work Location: Singapore</p>
                    <h2>Job Description</h2>
                  </body>
                </html>
                """
            ),
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


def test_fetch_careers_pages_skips_mailto_and_fragment_links():
    client = FakeClient(
        [
            FakeResponse(
                text="""
                <html>
                  <body>
                    <a href="#">Apply through your school's internship portal</a>
                    <a href="mailto:internship@example.com">internship@example.com</a>
                    <a href="/internships">> DSTA Internships</a>
                  </body>
                </html>
                """
            ),
            FakeResponse(
                text="""
                <html>
                  <body>
                    <h1>DSTA Internships</h1>
                    <p>Location: Singapore</p>
                    <h2>Job Description</h2>
                  </body>
                </html>
                """
            ),
        ]
    )

    jobs = fetch_careers_pages(
        [
            {
                "name": "DSTA",
                "company": "DSTA",
                "url": "https://example.com/join-us",
                "default_location": "Singapore",
            }
        ],
        client,
    )

    assert len(jobs) == 1
    assert jobs[0].title == "DSTA Internships"
    assert jobs[0].url == "https://example.com/internships"


def test_fetch_careers_pages_uses_job_detail_location_over_default():
    client = FakeClient(
        [
            FakeResponse(
                text="""
                <html>
                  <body>
                    <a href="/WesternDigital/744000117762538-data-analytics-engineering-intern">
                      Data Analytics & Engineering INTERN
                    </a>
                  </body>
                </html>
                """
            ),
            FakeResponse(
                text="""
                <html>
                  <body>
                    <h1>Data Analytics & Engineering INTERN</h1>
                    <p>Work Location: Binan HICAP Office--LOC_HGST_PHL01</p>
                    <h2>Company Description</h2>
                  </body>
                </html>
                """
            ),
        ]
    )

    jobs = fetch_careers_pages(
        [
            {
                "name": "Western Digital",
                "company": "Western Digital",
                "url": "https://jobs.smartrecruiters.com",
                "default_location": "Singapore",
            }
        ],
        client,
    )

    assert len(jobs) == 1
    assert jobs[0].location == "Binan HICAP Office--LOC_HGST_PHL01"


def test_fetch_internsg_canonicalizes_search_query_duplicates():
    html = """
    <html>
      <body>
        <article>
          <a href="/job/example-data-intern/?f_p=data+engineer+intern">Data Intern</a>
        </article>
      </body>
    </html>
    """
    client = FakeClient([FakeResponse(text=html), FakeResponse(text=html)])

    jobs = fetch_internsg(["data engineer intern", "machine learning intern"], client)

    assert len(jobs) == 1
    assert jobs[0].url == "https://www.internsg.com/job/example-data-intern/"


def test_fetch_smartrecruiters_companies_maps_jobs():
    client = FakeClient(
        [
            FakeResponse(
                data={
                    "content": [
                        {
                            "name": "Data Intern",
                            "ref": "https://jobs.smartrecruiters.com/example/1",
                            "releasedDate": "2026-06-14T00:00:00Z",
                            "location": {"city": "Singapore"},
                        }
                    ]
                }
            )
        ]
    )

    jobs = fetch_smartrecruiters_companies(["Example"], client)

    assert len(jobs) == 1
    assert jobs[0].source == "SmartRecruiters:Example"
    assert jobs[0].location == "Singapore"


def test_fetch_workday_sites_maps_jobs():
    client = FakeClient(
        [
            FakeResponse(
                data={
                    "jobPostings": [
                        {
                            "title": "Software Engineer Intern",
                            "externalPath": "/job/1",
                            "locationsText": "Singapore",
                            "postedOn": "2026-06-14T00:00:00Z",
                        }
                    ]
                }
            )
        ]
    )

    jobs = fetch_workday_sites(
        [
            {
                "name": "Example",
                "company": "Example",
                "endpoint": "https://example.com/wday/cxs/example/jobs",
                "career_base_url": "https://example.com/careers",
            }
        ],
        client,
    )

    assert len(jobs) == 1
    assert jobs[0].source == "Workday:Example"
    assert jobs[0].url == "https://example.com/job/1"


def test_fetch_all_jobs_continues_when_source_fails():
    config = {
        "sources": {
            "internsg": {
                "enabled": True,
                "search_terms": ["data intern"],
            }
        }
    }

    jobs, counts = fetch_all_jobs(config, FailingClient())

    assert jobs == []
    assert counts == {"InternSG": 0}
