from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from app.config import settings
import json
import base64
import httpx


class StoryQueryInput(BaseModel):
    query: str = Field(description="Natural language query about user stories or Jira issues")


class StoryTool(BaseTool):
    name: str = "story_manager"
    description: str = (
        "Manage user stories and backlog items using Jira. Can list stories, "
        "create new stories, update story status, assign stories, and get backlog. "
        "Use this for all story and issue management operations."
    )
    args_schema: type[BaseModel] = StoryQueryInput
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

    def _get_valid_issue_type(self, base_url: str, headers: dict) -> str:
        try:
            response = httpx.get(
                f"{base_url}/rest/api/3/project/{settings.jira_project_key}",
                headers=headers,
                timeout=15,
            )
            issue_types = [it["name"] for it in response.json().get("issueTypes", [])]
            preferred = ["Task", "Story", "Bug"]
            return next((t for t in preferred if t in issue_types), issue_types[0] if issue_types else "Task")
        except Exception:
            return "Task"

    def _handle_query(self, query: str) -> str:
        if not settings.jira_url or not settings.jira_api_token:
            return json.dumps({"error": "Jira not configured. Set JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN."})

        try:
            base_url = settings.jira_url.rstrip("/")
            headers = self._get_headers()
            q = query.lower()

            if "list" in q or "backlog" in q or "show" in q or "get" in q:
                # Determine JQL
                if "backlog" in q:
                    jql = f"project={settings.jira_project_key} AND sprint is EMPTY ORDER BY created DESC"
                elif "in progress" in q or "active" in q:
                    jql = f"project={settings.jira_project_key} AND status='In Progress' ORDER BY updated DESC"
                elif "done" in q or "completed" in q:
                    jql = f"project={settings.jira_project_key} AND status=Done ORDER BY updated DESC"
                else:
                    jql = f"project={settings.jira_project_key} ORDER BY created DESC"

                response = httpx.get(
                    f"{base_url}/rest/api/3/search/jql",
                    headers=headers,
                    params={
                        "jql": jql,
                        "maxResults": 20,
                        "fields": "summary,status,assignee,priority,issuetype,customfield_10016",
                    },
                    timeout=15,
                )
                data = response.json()
                issues = data.get("issues", [])
                return json.dumps({
                    "stories": [
                        {
                            "key": i["key"],
                            "title": i["fields"]["summary"],
                            "status": i["fields"]["status"]["name"],
                            "assignee": (i["fields"].get("assignee") or {}).get("displayName", "Unassigned"),
                            "priority": (i["fields"].get("priority") or {}).get("name", "Medium"),
                            "type": i["fields"]["issuetype"]["name"],
                            "story_points": i["fields"].get("customfield_10016"),
                        }
                        for i in issues
                    ],
                    "total": len(issues),
                })

            if "create" in q or "add" in q or "new story" in q or "new issue" in q:
                issue_type = self._get_valid_issue_type(base_url, headers)
                # Extract title from query - remove action words
                title = query
                for word in ["create", "add", "new story", "new issue", "a story for", "an issue for"]:
                    title = title.replace(word, "").strip()
                title = title.strip(" .,") or query

                response = httpx.post(
                    f"{base_url}/rest/api/3/issue",
                    headers=headers,
                    json={
                        "fields": {
                            "project": {"key": settings.jira_project_key},
                            "summary": title,
                            "issuetype": {"name": issue_type},
                            "description": {
                                "type": "doc",
                                "version": 1,
                                "content": [{"type": "paragraph", "content": [{"type": "text", "text": query}]}]
                            }
                        }
                    },
                    timeout=15,
                )
                data = response.json()
                if "key" in data:
                    return json.dumps({
                        "message": f"Story created successfully",
                        "key": data["key"],
                        "title": title,
                        "url": f"{base_url}/browse/{data['key']}",
                    })
                return json.dumps({"error": str(data)})

            if "update" in q or "move" in q or "status" in q:
                import re
                key_match = re.search(r'[A-Z]+-\d+', query)
                if key_match:
                    issue_key = key_match.group(0)
                    # Get available transitions
                    trans_response = httpx.get(
                        f"{base_url}/rest/api/3/issue/{issue_key}/transitions",
                        headers=headers,
                        timeout=15,
                    )
                    transitions = trans_response.json().get("transitions", [])
                    # Find matching transition
                    target_status = None
                    if "progress" in q or "start" in q:
                        target_status = "In Progress"
                    elif "done" in q or "complete" in q or "finish" in q:
                        target_status = "Done"
                    elif "review" in q:
                        target_status = "In Review"
                    elif "todo" in q or "to do" in q or "backlog" in q:
                        target_status = "To Do"

                    if target_status:
                        transition = next(
                            (t for t in transitions if target_status.lower() in t["name"].lower()),
                            None
                        )
                        if transition:
                            httpx.post(
                                f"{base_url}/rest/api/3/issue/{issue_key}/transitions",
                                headers=headers,
                                json={"transition": {"id": transition["id"]}},
                                timeout=15,
                            )
                            return json.dumps({
                                "message": f"{issue_key} moved to {target_status}",
                                "key": issue_key,
                                "new_status": target_status,
                            })
                    return json.dumps({
                        "available_transitions": [t["name"] for t in transitions],
                        "message": f"Available transitions for {issue_key}",
                    })

            if "split" in q or "break" in q or "breakdown" in q:
                import re
                key_match = re.search(r'[A-Z]+-\d+', query)
                if key_match:
                    issue_key = key_match.group(0)
                    response = httpx.get(
                        f"{base_url}/rest/api/3/issue/{issue_key}",
                        headers=headers,
                        params={"fields": "summary,description"},
                        timeout=15,
                    )
                    issue = response.json()
                    summary = issue["fields"]["summary"]
                    return json.dumps({
                        "original": summary,
                        "suggestion": f"Consider splitting '{summary}' into smaller tasks focusing on individual acceptance criteria",
                        "key": issue_key,
                    })

            # Default: list all issues
            response = httpx.get(
                f"{base_url}/rest/api/3/search/jql",
                headers=headers,
                params={
                    "jql": f"project={settings.jira_project_key} ORDER BY created DESC",
                    "maxResults": 10,
                    "fields": "summary,status,assignee",
                },
                timeout=15,
            )
            issues = response.json().get("issues", [])
            return json.dumps({
                "stories": [
                    {
                        "key": i["key"],
                        "title": i["fields"]["summary"],
                        "status": i["fields"]["status"]["name"],
                    }
                    for i in issues
                ],
                "query_acknowledged": query,
            })

        except Exception as e:
            return json.dumps({"error": str(e)})