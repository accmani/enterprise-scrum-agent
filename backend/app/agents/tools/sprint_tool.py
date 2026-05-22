from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from app.config import settings
import json
import base64
import httpx


class SprintQueryInput(BaseModel):
    query: str = Field(description="Natural language query about sprints")


class SprintTool(BaseTool):
    name: str = "sprint_manager"
    description: str = (
        "Manage Scrum sprints using Jira. Can list sprints, get active sprint, "
        "create sprints, update sprint status, and get velocity data. "
        "Use this for all sprint-related operations."
    )
    args_schema: type[BaseModel] = SprintQueryInput
    db_session: object = None

    def _run(self, query: str) -> str:
        return self._handle_query(query)

    async def _arun(self, query: str) -> str:
        return self._handle_query(query)

    def _get_headers(self) -> dict:
        credentials = base64.b64encode(
            f"{settings.jira_username}:{settings.jira_api_token}".encode()
        ).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

    def _get_board_id(self, base_url: str, headers: dict) -> int | None:
        try:
            response = httpx.get(
                f"{base_url}/rest/agile/1.0/board",
                headers=headers,
                params={"projectKeyOrId": settings.jira_project_key},
                timeout=15,
            )
            boards = response.json().get("values", [])
            return boards[0]["id"] if boards else None
        except Exception:
            return None

    def _handle_query(self, query: str) -> str:
        if not settings.jira_url or not settings.jira_api_token:
            return json.dumps({"error": "Jira not configured. Set JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN."})

        try:
            base_url = settings.jira_url.rstrip("/")
            headers = self._get_headers()
            q = query.lower()

            # Get board ID for sprint operations
            board_id = self._get_board_id(base_url, headers)

            if "active" in q or "current" in q:
                if not board_id:
                    return json.dumps({"error": "No Jira board found for project."})
                response = httpx.get(
                    f"{base_url}/rest/agile/1.0/board/{board_id}/sprint",
                    headers=headers,
                    params={"state": "active"},
                    timeout=15,
                )
                data = response.json()
                sprints = data.get("values", [])
                if not sprints:
                    return json.dumps({"message": "No active sprint found.", "sprints": []})
                sprint = sprints[0]
                # Get issues for the active sprint
                issues_response = httpx.get(
                    f"{base_url}/rest/agile/1.0/sprint/{sprint['id']}/issue",
                    headers=headers,
                    params={"fields": "summary,status,assignee,story_points,priority"},
                    timeout=15,
                )
                issues_data = issues_response.json()
                issues = [
                    {
                        "key": i["key"],
                        "summary": i["fields"]["summary"],
                        "status": i["fields"]["status"]["name"],
                        "assignee": (i["fields"].get("assignee") or {}).get("displayName", "Unassigned"),
                    }
                    for i in issues_data.get("issues", [])
                ]
                return json.dumps({
                    "active_sprint": {
                        "id": sprint["id"],
                        "name": sprint["name"],
                        "state": sprint["state"],
                        "goal": sprint.get("goal", ""),
                        "start_date": sprint.get("startDate", ""),
                        "end_date": sprint.get("endDate", ""),
                    },
                    "issues": issues,
                    "total_issues": len(issues),
                })

            if "list" in q or "show" in q or "all sprints" in q:
                if not board_id:
                    return json.dumps({"error": "No Jira board found for project."})
                response = httpx.get(
                    f"{base_url}/rest/agile/1.0/board/{board_id}/sprint",
                    headers=headers,
                    timeout=15,
                )
                data = response.json()
                sprints = data.get("values", [])
                return json.dumps({
                    "sprints": [
                        {
                            "id": s["id"],
                            "name": s["name"],
                            "state": s["state"],
                            "goal": s.get("goal", ""),
                            "start_date": s.get("startDate", ""),
                            "end_date": s.get("endDate", ""),
                        }
                        for s in sprints
                    ]
                })

            if "create" in q or "new sprint" in q:
                if not board_id:
                    return json.dumps({"error": "No Jira board found for project."})
                import re
                name_match = re.search(r'(sprint \d+|sprint [a-z]+|\bq[1-4]\b)', q)
                sprint_name = name_match.group(0).title() if name_match else "New Sprint"
                response = httpx.post(
                    f"{base_url}/rest/agile/1.0/sprint",
                    headers=headers,
                    json={
                        "name": sprint_name,
                        "originBoardId": board_id,
                        "goal": query,
                    },
                    timeout=15,
                )
                data = response.json()
                return json.dumps({
                    "message": "Sprint created successfully",
                    "sprint_id": data.get("id"),
                    "name": data.get("name"),
                    "state": data.get("state"),
                })

            if "velocity" in q:
                if not board_id:
                    return json.dumps({"error": "No Jira board found for project."})
                response = httpx.get(
                    f"{base_url}/rest/agile/1.0/board/{board_id}/sprint",
                    headers=headers,
                    params={"state": "closed"},
                    timeout=15,
                )
                closed_sprints = response.json().get("values", [])[-5:]
                return json.dumps({
                    "message": f"Found {len(closed_sprints)} completed sprints",
                    "closed_sprints": [{"name": s["name"], "id": s["id"]} for s in closed_sprints],
                })

            # Default: return active sprint summary
            if board_id:
                response = httpx.get(
                    f"{base_url}/rest/agile/1.0/board/{board_id}/sprint",
                    headers=headers,
                    params={"state": "active"},
                    timeout=15,
                )
                sprints = response.json().get("values", [])
                if sprints:
                    return json.dumps({"active_sprint": sprints[0].get("name"), "query_acknowledged": query})

            return json.dumps({"message": "Sprint query acknowledged", "query": query})

        except Exception as e:
            return json.dumps({"error": str(e)})