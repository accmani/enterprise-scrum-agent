from fastapi import APIRouter
from pydantic import BaseModel
from app.config import settings
import httpx
import base64
import json

router = APIRouter()


class StandupRequest(BaseModel):
    team_name: str | None = "Engineering"
    sprint_name: str | None = None


class StandupResponse(BaseModel):
    report: str
    jira_issues: list[dict] = []
    github_prs: list[dict] = []


@router.post("/", response_model=StandupResponse)
async def generate_standup(request: StandupRequest):
    jira_issues = []
    github_prs = []

    # Fetch Jira active sprint issues
    if settings.jira_url and settings.jira_api_token:
        try:
            credentials = base64.b64encode(
                f"{settings.jira_username}:{settings.jira_api_token}".encode()
            ).decode()
            headers = {"Authorization": f"Basic {credentials}", "Content-Type": "application/json"}
            base_url = settings.jira_url.rstrip("/")
            response = httpx.get(
                f"{base_url}/rest/api/3/search/jql",
                headers=headers,
                params={
                    "jql": f"project={settings.jira_project_key} AND sprint in openSprints() ORDER BY status",
                    "maxResults": 20,
                    "fields": "summary,status,assignee",
                },
                timeout=15,
            )
            data = response.json()
            jira_issues = [
                {
                    "key": i["key"],
                    "summary": i["fields"]["summary"],
                    "status": i["fields"]["status"]["name"],
                    "assignee": (i["fields"].get("assignee") or {}).get("displayName", "Unassigned"),
                }
                for i in data.get("issues", [])
            ]
        except Exception:
            pass

    # Fetch GitHub open PRs
    if settings.github_token and settings.github_repo:
        try:
            headers = {
                "Authorization": f"Bearer {settings.github_token}",
                "Accept": "application/vnd.github.v3+json",
            }
            response = httpx.get(
                f"https://api.github.com/repos/{settings.github_repo}/pulls",
                headers=headers,
                params={"state": "open"},
                timeout=15,
            )
            prs = response.json()
            github_prs = [
                {"number": pr["number"], "title": pr["title"], "author": pr["user"]["login"], "url": pr["html_url"]}
                for pr in prs[:10]
            ]
        except Exception:
            pass

    # Build report
    in_progress = [i for i in jira_issues if "progress" in i["status"].lower()]
    done = [i for i in jira_issues if i["status"].lower() == "done"]
    blocked = [i for i in jira_issues if "block" in i["status"].lower()]

    report_lines = [f"## 📋 Standup Report — {request.team_name} Team\n"]

    report_lines.append("### ✅ Yesterday / Done")
    if done:
        for i in done:
            report_lines.append(f"- [{i['key']}] {i['summary']} ({i['assignee']})")
    else:
        report_lines.append("- No completed items")

    report_lines.append("\n### 🔨 Today / In Progress")
    if in_progress:
        for i in in_progress:
            report_lines.append(f"- [{i['key']}] {i['summary']} ({i['assignee']})")
    else:
        report_lines.append("- No items in progress")

    report_lines.append("\n### 🚧 Blockers")
    if blocked:
        for i in blocked:
            report_lines.append(f"- [{i['key']}] {i['summary']}")
    else:
        report_lines.append("- No blockers")

    if github_prs:
        report_lines.append("\n### 🔀 Open Pull Requests")
        for pr in github_prs:
            report_lines.append(f"- #{pr['number']} {pr['title']} (@{pr['author']})")

    return StandupResponse(
        report="\n".join(report_lines),
        jira_issues=jira_issues,
        github_prs=github_prs,
    )