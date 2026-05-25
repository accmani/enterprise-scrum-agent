import base64
import json
import httpx
from langchain.tools import BaseTool
from pydantic import BaseModel, Field

from app.config import settings


class JenkinsInput(BaseModel):
    query: str = Field(
        description=(
            "Jenkins operation. Examples: "
            "'trigger_build on release/june-2026', "
            "'get_status for build 42', "
            "'list_jobs'"
        )
    )


class JenkinsTool(BaseTool):
    name: str = "jenkins_agent"
    description: str = (
        "Trigger and monitor Jenkins CI/CD builds for the healthcare-claims project. "
        "Use after a PR is merged to a release branch to run the system test suite. "
        "Operations: trigger_build (start build on a branch), get_status (check result), list_jobs. "
        "Returns build URL, test summary, and pass/fail status."
    )
    args_schema: type[BaseModel] = JenkinsInput

    def _run(self, query: str) -> str:
        return self._execute(query)

    async def _arun(self, query: str) -> str:
        return self._execute(query)

    def _auth_headers(self) -> dict:
        headers: dict = {"Content-Type": "application/json"}
        if settings.jenkins_user and settings.jenkins_token:
            creds = base64.b64encode(
                f"{settings.jenkins_user}:{settings.jenkins_token}".encode()
            ).decode()
            headers["Authorization"] = f"Basic {creds}"
        return headers

    def _execute(self, query: str) -> str:
        try:
            parsed = json.loads(query) if query.strip().startswith("{") else {}
        except (json.JSONDecodeError, TypeError):
            parsed = {}

        q = query.lower()
        operation = parsed.get("operation", "trigger_build")
        branch = parsed.get("branch", settings.release_branch)
        job = parsed.get("job", settings.jenkins_job_name or "healthcare-claims")
        build_number = parsed.get("build_number")

        # Infer operation from natural language if not explicit
        if not operation or operation == "trigger_build":
            if "status" in q or "result" in q or "check" in q:
                operation = "get_status"
            elif "list" in q or "jobs" in q:
                operation = "list_jobs"

        if not settings.jenkins_url:
            return self._mock(operation, branch, job)

        try:
            if operation == "trigger_build":
                return self._trigger(job, branch)
            if operation == "get_status":
                return self._status(job, build_number)
            if operation == "list_jobs":
                return self._list_jobs()
        except Exception as exc:
            return json.dumps({"error": str(exc), "note": "Jenkins call failed"})

        return self._mock(operation, branch, job)

    def _trigger(self, job: str, branch: str) -> str:
        url = f"{settings.jenkins_url}/job/{job}/buildWithParameters"
        resp = httpx.post(
            url,
            headers=self._auth_headers(),
            params={"BRANCH": branch},
            timeout=15,
        )
        if resp.status_code in (200, 201, 302):
            queue_url = resp.headers.get("Location", "")
            return json.dumps({
                "triggered": True,
                "job": job,
                "branch": branch,
                "queue_url": queue_url,
                "status": "RUNNING",
                "message": f"Build triggered on '{branch}' — job: {job}",
            })
        return json.dumps({"error": f"HTTP {resp.status_code}", "job": job, "branch": branch})

    def _status(self, job: str, build_number=None) -> str:
        path = f"{build_number}/api/json" if build_number else "lastBuild/api/json"
        resp = httpx.get(
            f"{settings.jenkins_url}/job/{job}/{path}",
            headers=self._auth_headers(),
            timeout=15,
        )
        if resp.status_code == 200:
            d = resp.json()
            return json.dumps({
                "job": job,
                "build_number": d.get("number"),
                "status": d.get("result", "RUNNING"),
                "building": d.get("building", False),
                "duration_ms": d.get("duration"),
                "url": d.get("url"),
            })
        return json.dumps({"error": f"HTTP {resp.status_code}"})

    def _list_jobs(self) -> str:
        resp = httpx.get(
            f"{settings.jenkins_url}/api/json?tree=jobs[name,url,color]",
            headers=self._auth_headers(),
            timeout=15,
        )
        if resp.status_code == 200:
            jobs = resp.json().get("jobs", [])
            return json.dumps({
                "jobs": [{"name": j["name"], "url": j["url"], "color": j.get("color")} for j in jobs]
            })
        return json.dumps({"error": f"HTTP {resp.status_code}"})

    def _mock(self, operation: str, branch: str, job: str) -> str:
        base_url = settings.jenkins_url or "http://jenkins.internal"
        if operation == "get_status":
            return json.dumps({
                "job": job,
                "build_number": 47,
                "status": "SUCCESS",
                "building": False,
                "duration_ms": 193000,
                "url": f"{base_url}/job/{job}/47/",
                "test_summary": "54 tests, 0 failures, 0 skipped — all passing",
                "coverage": "82% line coverage",
                "note": "Jenkins not configured (JENKINS_URL not set) — simulated result",
            })
        return json.dumps({
            "triggered": True,
            "job": job,
            "branch": branch,
            "build_number": 47,
            "status": "RUNNING",
            "build_url": f"{base_url}/job/{job}/47/",
            "message": (
                f"System test build triggered on '{branch}'. "
                f"Running full test suite for {job}. "
                f"Expected duration: ~3 min."
            ),
            "test_plan": [
                "Unit tests — ClaimAdjudicationService",
                "Integration tests — DB2/ODS stubs",
                "Regression suite — 54 scenarios",
                "HIPAA compliance scan",
            ],
            "note": "Jenkins not configured (JENKINS_URL not set) — simulated result",
        })
