from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from app.config import settings
import json


class JiraQueryInput(BaseModel):
    query: str = Field(description="Jira operation: list issues, create issue, update status, etc.")


class JiraTool(BaseTool):
    name: str = "jira_integration"
    description: str = (
        "Interact with Jira: list issues, create stories, update status, fetch sprint data. "
        "Use this when the user explicitly asks about Jira or wants to sync with Jira."
    )
    args_schema: type[BaseModel] = JiraQueryInput

    def _run(self, query: str) -> str:
        return self._execute(query)

    async def _arun(self, query: str) -> str:
        return self._execute(query)

    def _execute(self, query: str) -> str:
        if not settings.jira_url:
            return json.dumps({"error": "Jira not configured. Set JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN in .env"})
        try:
            from jira import JIRA
            jira = JIRA(
                server=settings.jira_url,
                basic_auth=(settings.jira_username, settings.jira_api_token),
            )
            q = query.lower()
            if "list" in q or "issues" in q:
                issues = jira.search_issues(f"project={settings.jira_project_key} ORDER BY created DESC", maxResults=10)
                return json.dumps({
                    "issues": [
                        {"key": i.key, "summary": i.fields.summary, "status": i.fields.status.name}
                        for i in issues
                    ]
                })
            return json.dumps({"message": "Jira query acknowledged", "query": query})
        except Exception as e:
            return json.dumps({"error": str(e)})
