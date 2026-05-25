from langchain_classic.tools import BaseTool
from pydantic import BaseModel, Field
from app.config import settings
import json
import base64
import httpx


class EstimationQueryInput(BaseModel):
    query: str = Field(description="Story or feature to estimate effort for")


class EstimationTool(BaseTool):
    name: str = "estimation_tool"
    description: str = (
        "Estimate story points and effort for user stories. Uses historical Jira data "
        "for velocity-based estimates. Use when asked to estimate, size, or point a story."
    )
    args_schema: type[BaseModel] = EstimationQueryInput

    def _run(self, query: str) -> str:
        return self._execute(query)

    async def _arun(self, query: str) -> str:
        return self._execute(query)

    def _get_historical_velocity(self) -> dict:
        if not settings.jira_url or not settings.jira_api_token:
            return {}
        try:
            credentials = base64.b64encode(
                f"{settings.jira_username}:{settings.jira_api_token}".encode()
            ).decode()
            headers = {
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/json",
            }
            base_url = settings.jira_url.rstrip("/")
            # Get completed issues with story points
            response = httpx.get(
                f"{base_url}/rest/api/3/search/jql",
                headers=headers,
                params={
                    "jql": f"project={settings.jira_project_key} AND status=Done AND cf[10016] is not EMPTY",
                    "maxResults": 20,
                    "fields": "summary,customfield_10016,issuetype",
                },
                timeout=15,
            )
            issues = response.json().get("issues", [])
            points = [i["fields"].get("customfield_10016", 0) for i in issues if i["fields"].get("customfield_10016")]
            return {
                "completed_issues": len(issues),
                "avg_points": round(sum(points) / len(points), 1) if points else 5,
                "point_distribution": {
                    "1-2 pts": len([p for p in points if p <= 2]),
                    "3-5 pts": len([p for p in points if 3 <= p <= 5]),
                    "8+ pts": len([p for p in points if p >= 8]),
                }
            }
        except Exception:
            return {}

    def _execute(self, query: str) -> str:
        try:
            velocity_data = self._get_historical_velocity()
            q = query.lower()

            # Size estimation based on complexity keywords
            if any(w in q for w in ["simple", "small", "minor", "trivial", "fix"]):
                points = 1
                size = "XS"
            elif any(w in q for w in ["login", "form", "button", "display", "show", "page"]):
                points = 2
                size = "S"
            elif any(w in q for w in ["api", "endpoint", "service", "integration", "report"]):
                points = 5
                size = "M"
            elif any(w in q for w in ["payment", "auth", "security", "migration", "refactor"]):
                points = 8
                size = "L"
            elif any(w in q for w in ["architecture", "platform", "infrastructure", "redesign"]):
                points = 13
                size = "XL"
            else:
                points = 3
                size = "S"

            result = {
                "story": query,
                "estimated_points": points,
                "size": size,
                "confidence": "medium",
                "breakdown": {
                    "development": f"{int(points * 0.6)} pts",
                    "testing": f"{int(points * 0.25)} pts",
                    "review": f"{int(points * 0.15)} pts",
                },
            }

            if velocity_data:
                result["historical_context"] = velocity_data
                result["sprints_to_complete"] = round(points / max(velocity_data.get("avg_points", 5), 1), 1)

            return json.dumps(result)

        except Exception as e:
            return json.dumps({"error": str(e)})