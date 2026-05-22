from langchain.tools import BaseTool
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field
from app.config import settings
import json
import httpx
import base64


class RetroQueryInput(BaseModel):
    query: str = Field(description="Sprint name or 'current sprint' to generate retrospective for")


class RetroTool(BaseTool):
    name: str = "retro_agent"
    description: str = (
        "Generate sprint retrospective reports: what went well, what to improve, "
        "action items, and team health. Use when asked about retrospectives, retro, "
        "sprint review, or team improvements."
    )
    args_schema: type[BaseModel] = RetroQueryInput

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
                temperature=0.3,
            )
        return ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key, temperature=0.3)

    def _fetch_sprint_data(self) -> dict:
        if not settings.jira_url or not settings.jira_api_token:
            return {}
        try:
            credentials = base64.b64encode(
                f"{settings.jira_username}:{settings.jira_api_token}".encode()
            ).decode()
            headers = {"Authorization": f"Basic {credentials}", "Content-Type": "application/json"}
            response = httpx.get(
                f"{settings.jira_url.rstrip('/')}/rest/api/3/search/jql",
                headers=headers,
                params={
                    "jql": f"project={settings.jira_project_key} ORDER BY updated DESC",
                    "maxResults": 20,
                    "fields": "summary,status,assignee,priority",
                },
                timeout=15,
            )
            issues = response.json().get("issues", [])
            done = [i for i in issues if i["fields"]["status"]["name"].lower() == "done"]
            in_progress = [i for i in issues if i["fields"]["status"]["name"].lower() not in ("done", "to do")]
            return {
                "completed": len(done),
                "in_progress": len(in_progress),
                "done_items": [{"key": i["key"], "summary": i["fields"]["summary"]} for i in done[:8]],
                "in_progress_items": [{"key": i["key"], "summary": i["fields"]["summary"]} for i in in_progress[:5]],
            }
        except Exception:
            return {}

    def _fetch_github_data(self) -> dict:
        if not settings.github_token or not settings.github_repo:
            return {}
        try:
            headers = {"Authorization": f"Bearer {settings.github_token}", "Accept": "application/vnd.github.v3+json"}
            response = httpx.get(
                f"https://api.github.com/repos/{settings.github_repo}/pulls",
                headers=headers,
                params={"state": "closed", "per_page": 10},
                timeout=15,
            )
            merged = [pr for pr in response.json() if pr.get("merged_at")]
            return {"merged_prs": len(merged), "pr_titles": [pr["title"] for pr in merged[:5]]}
        except Exception:
            return {}

    def _execute(self, query: str) -> str:
        try:
            sprint_data = self._fetch_sprint_data()
            github_data = self._fetch_github_data()

            prompt = f"""You are an experienced Scrum Master facilitating a sprint retrospective for a healthcare claims engineering team.

Sprint data from Jira: {json.dumps(sprint_data)}
GitHub activity: {json.dumps(github_data)}
Context: {query}

Generate a constructive retrospective report covering:

1. **Sprint Summary** — velocity, completion rate, key achievements
2. **What Went Well** — at least 3 specific positives with business impact
3. **What to Improve** — at least 3 specific pain points with concrete suggestions
4. **Action Items** — specific, assigned, time-boxed actions (owner: Dev Team / Scrum Master / PO)
5. **Team Health** — score collaboration, technical quality, and process adherence (1-5)
6. **Recognition** — call out specific contributions worth celebrating
7. **Next Sprint Focus** — top 2-3 priorities for the team to carry forward

Keep the tone constructive and specific to healthcare claims domain work."""

            llm = self._get_llm()
            response = llm.invoke([HumanMessage(content=prompt)])
            return response.content
        except Exception as e:
            return json.dumps({"error": str(e)})
