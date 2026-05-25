from langchain_classic.tools import BaseTool
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field
from app.config import settings
import json
import httpx
import base64
import re


class ReleaseQueryInput(BaseModel):
    query: str = Field(description="Release version or description to generate release notes for")


class ReleaseTool(BaseTool):
    name: str = "release_agent"
    description: str = (
        "Generate structured release notes by combining completed Jira tickets and merged GitHub PRs. "
        "Use when asked about release notes, changelog, or release planning."
    )
    args_schema: type[BaseModel] = ReleaseQueryInput

    def _run(self, query: str) -> str:
        return self._execute(query)

    async def _arun(self, query: str) -> str:
        return self._execute(query)

    def _get_llm(self):
        if settings.azure_openai_endpoint:
            return AzureChatOpenAI(
                azure_endpoint=settings.azure_openai_endpoint,
                azure_deployment=settings.azure_openai_deployment,
                api_key=settings.azure_openai_api_key,
                api_version=settings.openai_api_version,
                temperature=0.2,
            )
        return ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key, temperature=0.2)

    def _fetch_completed_jira_issues(self) -> list:
        if not settings.jira_url or not settings.jira_api_token:
            return []
        try:
            credentials = base64.b64encode(
                f"{settings.jira_username}:{settings.jira_api_token}".encode()
            ).decode()
            headers = {"Authorization": f"Basic {credentials}", "Content-Type": "application/json"}
            response = httpx.get(
                f"{settings.jira_url.rstrip('/')}/rest/api/3/search/jql",
                headers=headers,
                params={
                    "jql": f"project={settings.jira_project_key} AND status=Done ORDER BY updated DESC",
                    "maxResults": 20,
                    "fields": "summary,issuetype,priority",
                },
                timeout=15,
            )
            return [
                {"key": i["key"], "summary": i["fields"]["summary"], "type": i["fields"]["issuetype"]["name"]}
                for i in response.json().get("issues", [])
            ]
        except Exception:
            return []

    def _fetch_merged_prs(self) -> list:
        if not settings.github_token or not settings.github_repo:
            return []
        try:
            headers = {"Authorization": f"Bearer {settings.github_token}", "Accept": "application/vnd.github.v3+json"}
            response = httpx.get(
                f"https://api.github.com/repos/{settings.github_repo}/pulls",
                headers=headers,
                params={"state": "closed", "per_page": 15},
                timeout=15,
            )
            return [
                {"number": pr["number"], "title": pr["title"], "author": pr["user"]["login"]}
                for pr in response.json() if pr.get("merged_at")
            ]
        except Exception:
            return []

    def _execute(self, query: str) -> str:
        try:
            version_match = re.search(r'v?(\d+\.\d+[\.\d]*)', query)
            version = version_match.group(0) if version_match else "v1.1.0"

            jira_issues = self._fetch_completed_jira_issues()
            github_prs = self._fetch_merged_prs()

            prompt = f"""You are a Release Manager for a healthcare claims processing system.

Release version: {version}
Completed Jira tickets: {json.dumps(jira_issues[:15])}
Merged GitHub PRs: {json.dumps(github_prs[:10])}
Context: {query}

Generate professional release notes covering:

1. **Release Summary** — one paragraph overview of this release
2. **Bug Fixes** — list each fix with: ticket key, title, business impact (e.g. "7 members overcharged — resolved")
3. **Compliance & HIPAA Notes** — any patient data or regulatory considerations addressed
4. **Testing Summary** — what was tested and how (unit, integration, UAT)
5. **Deployment Instructions** — steps to deploy safely, rollback plan
6. **Known Limitations** — anything not addressed in this release
7. **Contributors** — GitHub usernames from PRs

Format clearly with headers and bullet points. Be specific about the healthcare business impact of each fix."""

            llm = self._get_llm()
            response = llm.invoke([HumanMessage(content=prompt)])
            return response.content
        except Exception as e:
            return json.dumps({"error": str(e)})
