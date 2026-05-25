from langchain_classic.tools import BaseTool
from pydantic import BaseModel, Field
from app.config import settings
import json
import base64
import httpx


# Maps bug domain → Epic name (find or auto-create)
DOMAIN_EPIC_MAP = {
    "claims adjudication":    "Claims Adjudication Stability",
    "benefits calculation":   "Benefits Calculation Accuracy",
    "batch processing":       "Batch Processing Reliability",
    "copay calculation":      "Copay & Billing Accuracy",
    "eligibility verification": "Eligibility & Coverage Management",
    "icd-10 validation":      "Code Validation & Compliance",
    "prior authorization":    "Authorization Gateway Integrity",
    "claim validation":       "Claim Intake & Validation",
    "database":               "Data Quality & Analytics",
}


class JiraQueryInput(BaseModel):
    query: str = Field(
        description=(
            "Jira operation. For creating issues pass JSON with: "
            "operation=create_issue, title, description, domain "
            "(e.g. 'Claims Adjudication'), priority. "
            "The tool will auto-link the story to the correct Epic."
        )
    )


class JiraTool(BaseTool):
    name: str = "jira_integration"
    description: str = (
        "Interact with Jira: list issues, create stories with automatic Epic hierarchy "
        "linking, update status, fetch sprint data. "
        "When creating an issue include 'domain' so the tool can find or create the "
        "matching Epic and link the story under it automatically."
    )
    args_schema: type[BaseModel] = JiraQueryInput

    def _run(self, query: str) -> str:
        return self._execute(query)

    async def _arun(self, query: str) -> str:
        return self._execute(query)

    def _get_headers(self) -> dict:
        credentials = base64.b64encode(
            f"{settings.jira_username}:{settings.jira_api_token}".encode()
        ).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

    def _get_assignee_for_domain(self, domain: str, base_url: str, headers: dict) -> str | None:
        """Return the accountId of the best available team member for this domain."""
        domain_lower = domain.lower()
        # Role preference by domain
        role_hint = "developer" if any(k in domain_lower for k in ["bds", "cts", "claims", "batch"]) else "member"
        try:
            resp = httpx.get(
                f"{base_url}/rest/api/3/user/assignable/search",
                headers=headers,
                params={"project": settings.jira_project_key, "maxResults": 20},
                timeout=10,
            )
            if resp.status_code == 200:
                users = resp.json()
                if not isinstance(users, list):
                    return None
                # Filter out service accounts / the bot (current API user)
                human_users = [
                    u for u in users
                    if u.get("accountType") in ("atlassian", None)
                    and u.get("emailAddress", "") != settings.jira_username
                    and u.get("active", True)
                ]
                if human_users:
                    return human_users[0].get("accountId")
                # Fall back: include all users (even the bot)
                if users:
                    return users[0].get("accountId")
        except Exception:
            pass
        return None

    def _resolve_epic_name(self, domain: str) -> str:
        """Return the Epic name for a given bug domain."""
        domain_lower = domain.lower().strip()
        for key, epic in DOMAIN_EPIC_MAP.items():
            if key in domain_lower or domain_lower in key:
                return epic
        # Fallback: capitalise the domain and append "Workstream"
        return f"{domain.strip().title()} Workstream"

    def _get_or_create_epic(self, epic_name: str, base_url: str, headers: dict) -> str | None:
        """Find an existing Epic by summary or create it. Returns the Epic key."""
        # Search for existing epic with this name
        jql = (
            f'project = {settings.jira_project_key} '
            f'AND issuetype = Epic '
            f'AND summary ~ "\\"{epic_name}\\"" '
            f'ORDER BY created DESC'
        )
        search = httpx.get(
            f"{base_url}/rest/api/3/search/jql",
            headers=headers,
            params={"jql": jql, "maxResults": 1, "fields": "summary,key"},
            timeout=15,
        )
        if search.status_code == 200:
            issues = search.json().get("issues", [])
            if issues:
                return issues[0]["key"]

        # Create the Epic
        create = httpx.post(
            f"{base_url}/rest/api/3/issue",
            headers=headers,
            json={
                "fields": {
                    "project": {"key": settings.jira_project_key},
                    "summary": epic_name,
                    "issuetype": {"name": "Epic"},
                }
            },
            timeout=15,
        )
        if create.status_code in (200, 201):
            return create.json().get("key")
        return None

    def _get_issue_type(self, base_url: str, headers: dict) -> str:
        """Return the best available story-level issue type for this project."""
        resp = httpx.get(
            f"{base_url}/rest/api/3/project/{settings.jira_project_key}",
            headers=headers,
            timeout=15,
        )
        if resp.status_code == 200:
            types = [it["name"] for it in resp.json().get("issueTypes", [])]
            for preferred in ("Story", "Task", "Bug"):
                if preferred in types:
                    return preferred
            return types[0] if types else "Task"
        return "Task"

    def _execute(self, query: str) -> str:
        if not settings.jira_url:
            return json.dumps({"error": "Jira not configured. Set JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN."})
        try:
            base_url = settings.jira_url.rstrip("/")
            headers = self._get_headers()

            # Parse JSON input from agent
            try:
                parsed = json.loads(query)
                operation = parsed.get("operation", "").lower()
                summary = str(parsed.get("title", parsed.get("summary", query)))[:250]
                description = str(parsed.get("description", query))[:5000]
                domain = str(parsed.get("domain", ""))
                priority = str(parsed.get("priority", "Medium"))
            except (json.JSONDecodeError, TypeError):
                parsed = {}
                operation = ""
                summary = query[:250] if not query.strip().startswith('{') else ""
                description = query
                domain = ""
                priority = "Medium"

            q = query.lower()

            # ── CREATE ISSUE ──────────────────────────────────────────────────
            if operation == "create_issue" or (
                not operation
                and summary  # only if we have a valid non-JSON summary
                and ("create" in q or "add" in q or "new" in q)
                and "list" not in q[:20]
                and not q.strip().startswith('{')
            ):
                issue_type = self._get_issue_type(base_url, headers)

                # Build the story fields
                fields: dict = {
                    "project": {"key": settings.jira_project_key},
                    "summary": summary,
                    "issuetype": {"name": issue_type},
                    "description": {
                        "type": "doc",
                        "version": 1,
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": description}],
                            }
                        ],
                    },
                }
                # ── Auto-assign to a team member ──────────────────────────────
                assignee_id = self._get_assignee_for_domain(domain or "general", base_url, headers)
                if assignee_id:
                    fields["assignee"] = {"accountId": assignee_id}

                # ── Auto-assign to active sprint ─────────────────────────────
                try:
                    sprint_resp = httpx.get(
                        f"{base_url}/rest/agile/1.0/board/34/sprint",
                        headers=headers,
                        params={"state": "active"},
                        timeout=10,
                    )
                    if sprint_resp.status_code == 200:
                        sprints = sprint_resp.json().get("values", [])
                        if sprints:
                            fields["customfield_10020"] = sprints[0]["id"]
                except Exception:
                    pass  # Sprint assignment optional — don't fail issue creation
                # ── Auto-link Epic ────────────────────────────────────────────
                epic_key = None
                epic_name = None
                if domain:
                    epic_name = self._resolve_epic_name(domain)
                    epic_key = self._get_or_create_epic(epic_name, base_url, headers)
                    if epic_key:
                        # Works for team-managed (next-gen) projects
                        fields["parent"] = {"key": epic_key}

                response = httpx.post(
                    f"{base_url}/rest/api/3/issue",
                    headers=headers,
                    json={"fields": fields},
                    timeout=15,
                )
                data = response.json()

                # If parent linking failed (company-managed), retry with Epic Link field
                if response.status_code not in (200, 201) and epic_key:
                    fields.pop("parent", None)
                    fields["customfield_10014"] = epic_key  # Epic Link (company-managed)
                    response = httpx.post(
                        f"{base_url}/rest/api/3/issue",
                        headers=headers,
                        json={"fields": fields},
                        timeout=15,
                    )
                    data = response.json()

                issue_key = data.get("key", "")
                created_ok = response.status_code in (200, 201)

                result = {
                    "created": created_ok,
                    "key": issue_key,
                    "url": f"{base_url}/browse/{issue_key}",
                    "summary": summary,
                    "issue_type": issue_type,
                    "epic_linked": bool(epic_key and created_ok),
                    "assigned_to": assignee_id or "unassigned",
                }
                if epic_key:
                    result["epic_key"] = epic_key
                    result["epic_name"] = epic_name
                    result["epic_url"] = f"{base_url}/browse/{epic_key}"
                if not created_ok:
                    result["error"] = data.get("errors") or data.get("errorMessages")
                    return json.dumps(result)

                # Fetch the created issue to confirm parent linkage
                if issue_key:
                    verify = httpx.get(
                        f"{base_url}/rest/api/3/issue/{issue_key}",
                        headers=headers,
                        params={"fields": "summary,status,parent,issuetype"},
                        timeout=15,
                    )
                    if verify.status_code == 200:
                        vdata = verify.json().get("fields", {})
                        parent_info = vdata.get("parent")
                        result["confirmed_parent"] = (
                            {"key": parent_info["key"], "summary": parent_info["fields"]["summary"]}
                            if parent_info else None
                        )
                        result["status"] = vdata.get("status", {}).get("name", "To Do")

                # Fetch assignee display name for the message
                assignee_name = "unassigned"
                if assignee_id:
                    try:
                        au = httpx.get(
                            f"{base_url}/rest/api/3/user",
                            headers=headers,
                            params={"accountId": assignee_id},
                            timeout=8,
                        )
                        if au.status_code == 200:
                            assignee_name = au.json().get("displayName", assignee_id)
                            result["assigned_to"] = assignee_name
                    except Exception:
                        pass

                result["message"] = (
                    f"Successfully created {issue_type} {issue_key}, assigned to {assignee_name}"
                    + (f", linked under Epic {epic_key} ({epic_name})." if epic_key else ".")
                )
                return json.dumps(result)

            # ── LIST ISSUES ───────────────────────────────────────────────────
            if "list" in q or "issues" in q or "tickets" in q:
                jql = f"project={settings.jira_project_key} ORDER BY created DESC"
                response = httpx.get(
                    f"{base_url}/rest/api/3/search/jql",
                    headers=headers,
                    params={"jql": jql, "maxResults": 20, "fields": "summary,status,assignee,priority,parent,issuetype"},
                    timeout=15,
                )
                data = response.json()
                issues = data.get("issues", [])
                return json.dumps({
                    "issues": [
                        {
                            "key": i["key"],
                            "summary": i["fields"]["summary"],
                            "status": i["fields"]["status"]["name"],
                            "type": i["fields"]["issuetype"]["name"],
                            "parent": (i["fields"].get("parent") or {}).get("key"),
                            "assignee": (i["fields"].get("assignee") or {}).get("displayName", "Unassigned"),
                        }
                        for i in issues
                    ]
                })

            # ── GET SPECIFIC ISSUE ────────────────────────────────────────────
            import re as _re
            key_match = _re.search(r'\b([A-Z][A-Z0-9]+-\d+)\b', query)
            if key_match and any(w in q for w in ("get", "fetch", "retrieve", "show", "detail", "confirm", "check", "view", "look")):
                issue_key = key_match.group(1)
                resp = httpx.get(
                    f"{base_url}/rest/api/3/issue/{issue_key}",
                    headers=headers,
                    params={"fields": "summary,status,assignee,parent,issuetype,priority"},
                    timeout=15,
                )
                if resp.status_code == 200:
                    f = resp.json().get("fields", {})
                    parent = f.get("parent")
                    return json.dumps({
                        "key": issue_key,
                        "url": f"{base_url}/browse/{issue_key}",
                        "summary": f.get("summary"),
                        "status": f.get("status", {}).get("name"),
                        "type": f.get("issuetype", {}).get("name"),
                        "priority": f.get("priority", {}).get("name"),
                        "assignee": (f.get("assignee") or {}).get("displayName", "Unassigned"),
                        "parent": {"key": parent["key"], "summary": parent["fields"]["summary"]} if parent else None,
                        "epic_linked": parent is not None,
                    })
                return json.dumps({"error": f"Could not fetch {issue_key}", "status": resp.status_code})

            # ── UPDATE STATUS ─────────────────────────────────────────────────
            if "update" in q or "move" in q or "status" in q:
                return json.dumps({"message": "To update a ticket status, provide the ticket key and new status."})

            # ── SPRINT ISSUES ─────────────────────────────────────────────────
            if "sprint" in q:
                response = httpx.get(
                    f"{base_url}/rest/api/3/search/jql",
                    headers=headers,
                    params={
                        "jql": f"project={settings.jira_project_key} AND sprint in openSprints()",
                        "maxResults": 20,
                        "fields": "summary,status,assignee,parent",
                    },
                    timeout=15,
                )
                data = response.json()
                issues = data.get("issues", [])
                return json.dumps({
                    "active_sprint_issues": [
                        {
                            "key": i["key"],
                            "summary": i["fields"]["summary"],
                            "status": i["fields"]["status"]["name"],
                            "parent": (i["fields"].get("parent") or {}).get("key"),
                        }
                        for i in issues
                    ]
                })

            return json.dumps({"message": "Jira query acknowledged", "query": query})

        except Exception as e:
            return json.dumps({"error": str(e)})
