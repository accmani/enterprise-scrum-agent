from langchain_classic.tools import BaseTool
from pydantic import BaseModel, Field
from app.config import settings
import json
import httpx
import base64
import re


class GitHubQueryInput(BaseModel):
    query: str = Field(description="GitHub operation: list PRs, create branch, commit fix, create PR, etc.")


class GitHubTool(BaseTool):
    name: str = "github_integration"
    description: str = (
        "Interact with GitHub: list PRs, create branch, commit code fix, create pull request. "
        "Use this to auto-create a branch with the fix and raise a PR for code review."
    )
    args_schema: type[BaseModel] = GitHubQueryInput

    def _run(self, query: str) -> str:
        return self._execute(query)

    async def _arun(self, query: str) -> str:
        return self._execute(query)

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.github_token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _execute(self, query: str) -> str:
        if not settings.github_token or not settings.github_repo:
            return json.dumps({"error": "GitHub not configured."})
        try:
            base_url = f"https://api.github.com/repos/{settings.github_repo}"
            headers = self._get_headers()

            # Parse JSON input from agent
            try:
                parsed = json.loads(query)
                operation = parsed.get("operation", "").lower()
                branch_name = parsed.get("branch", "")
                file_path = parsed.get("file", "")
                file_content = parsed.get("content", "")
                pr_title = parsed.get("title", "")
                pr_body = parsed.get("body", "")
                jira_key = parsed.get("jira_key", "")
                base_branch = parsed.get("base", settings.base_branch)
                release_branch = parsed.get("release_branch", settings.release_branch)
            except (json.JSONDecodeError, TypeError):
                parsed = {}
                operation = ""
                branch_name = ""
                file_path = ""
                file_content = ""
                pr_title = ""
                pr_body = ""
                jira_key = ""
                base_branch = settings.base_branch
                release_branch = settings.release_branch

            q = query.lower()

            # ── CREATE BRANCH ─────────────────────────────────────────────
            if operation == "create_branch" or "create branch" in q or "new branch" in q:
                # Get SHA of base branch
                ref_resp = httpx.get(
                    f"{base_url}/git/ref/heads/{base_branch}",
                    headers=headers, timeout=15
                )
                if ref_resp.status_code != 200:
                    ref_resp = httpx.get(f"{base_url}/git/ref/heads/master", headers=headers, timeout=15)
                ref_data = ref_resp.json()
                sha = ref_data.get("object", {}).get("sha") if isinstance(ref_data, dict) else None
                if not sha:
                    return json.dumps({"error": f"Could not get SHA for branch {base_branch}"})

                # Auto-generate branch name if not provided
                if not branch_name:
                    safe = re.sub(r'[^a-z0-9-]', '-', q.replace("create branch", "").strip()[:40])
                    branch_name = f"fix/{safe}" if safe else "fix/auto-fix"

                resp = httpx.post(
                    f"{base_url}/git/refs",
                    headers=headers,
                    json={"ref": f"refs/heads/{branch_name}", "sha": sha},
                    timeout=15
                )
                if resp.status_code in (200, 201):
                    return json.dumps({"created": True, "branch": branch_name, "sha": sha})
                return json.dumps({"error": resp.json().get("message", "Branch creation failed"), "branch": branch_name})

            # ── COMMIT FILE ───────────────────────────────────────────────
            if operation == "commit_file" or "commit" in q:
                if not branch_name or not file_path or not file_content:
                    return json.dumps({"error": "Need branch, file, and content to commit"})

                # Get existing file SHA if it exists
                existing = httpx.get(
                    f"{base_url}/contents/{file_path}",
                    headers=headers,
                    params={"ref": branch_name},
                    timeout=15
                )
                file_sha = existing.json().get("sha") if existing.status_code == 200 else None

                encoded = base64.b64encode(file_content.encode()).decode()
                payload = {
                    "message": f"fix: {pr_title or 'auto-fix by scrum agent'}",
                    "content": encoded,
                    "branch": branch_name,
                }
                if file_sha:
                    payload["sha"] = file_sha

                resp = httpx.put(
                    f"{base_url}/contents/{file_path}",
                    headers=headers,
                    json=payload,
                    timeout=15
                )
                if resp.status_code in (200, 201):
                    return json.dumps({"committed": True, "file": file_path, "branch": branch_name})
                return json.dumps({"error": resp.json().get("message", "Commit failed")})

            # ── LIST PRs (must be checked before create_pr to avoid substring collision) ──
            if operation in ("list_prs", "list prs", "list open prs") or \
               ("list" in q and ("pr" in q or "pull" in q)):
                response = httpx.get(f"{base_url}/pulls", headers=headers,
                                     params={"state": "open"}, timeout=15)
                prs = response.json() if response.status_code == 200 else []
                prs = prs if isinstance(prs, list) else []
                return json.dumps({
                    "pull_requests": [
                        {"number": pr["number"], "title": pr["title"],
                         "author": pr["user"]["login"], "url": pr["html_url"],
                         "branch": pr["head"]["ref"]}
                        for pr in prs[:10]
                    ]
                })

            # ── CREATE PR ─────────────────────────────────────────────────
            if operation == "create_pr" or "create pr" in q or "open pr" in q:
                if not branch_name:
                    return json.dumps({"error": "Need branch name to create PR"})

                title = pr_title or f"fix: auto-fix by scrum agent"
                body = pr_body or f"Auto-generated PR by Enterprise Scrum Agent"
                if jira_key:
                    body = f"Jira: {jira_key}\n\n{body}"

                resp = httpx.post(
                    f"{base_url}/pulls",
                    headers=headers,
                    json={
                        "title": title[:200],
                        "body": body,
                        "head": branch_name,
                        "base": base_branch,
                    },
                    timeout=15
                )
                data = resp.json()
                if resp.status_code in (200, 201):
                    return json.dumps({
                        "created": True,
                        "pr_number": data.get("number"),
                        "title": title,
                        "url": data.get("html_url"),
                        "branch": branch_name
                    })
                return json.dumps({"error": data.get("message", "PR creation failed"), "details": data.get("errors", [])})

            # ── FULL AUTO-FIX FLOW ────────────────────────────────────────
            if operation == "auto_fix" or "auto fix" in q or "full fix" in q:
                bug = parsed.get("bug", "bug")

                # ── Global duplicate check — stop if ANY open PR matches this bug ──
                try:
                    all_prs = httpx.get(
                        f"{base_url}/pulls",
                        headers=headers,
                        params={"state": "open", "per_page": 10},
                        timeout=10,
                    )
                    if all_prs.status_code == 200:
                        prs = all_prs.json() if isinstance(all_prs.json(), list) else []
                        bug_lower = bug.lower()[:40]
                        for pr in prs:
                            pr_title = pr.get("title", "").lower()
                            if any(word in pr_title for word in bug_lower.split("-")[:3] if len(word) > 3):
                                return json.dumps({
                                    "auto_fix_complete": True,
                                    "duplicate": True,
                                    "pr_number": pr.get("number"),
                                    "pr_url": pr.get("html_url"),
                                    "branch": pr.get("head", {}).get("ref", ""),
                                    "message": "PR already exists for this bug — skipping"
                                })
                except Exception:
                    pass
                fixed_code = parsed.get("fixed_code", "")
                file_to_fix = parsed.get("file", "")
                jira_key = parsed.get("jira_key", "")
                # Clean up placeholder values
                if not jira_key or jira_key in ["ST-1", "<ST-X>", "ST-X"]:
                    # Try to extract from bug description
                    import re as _re
                    match = _re.search(r'ST-\d+', bug)
                    jira_key = match.group(0) if match else "ST-1"

                if not fixed_code or not file_to_fix:
                    return json.dumps({"error": "Need fixed_code and file to perform auto-fix"})

                # Step 1: Get SHA from base_branch (develop) — fix branches always cut from develop
                ref_resp = httpx.get(f"{base_url}/git/ref/heads/{base_branch}", headers=headers, timeout=15)
                if ref_resp.status_code != 200:
                    # Fall back to main if develop not found
                    ref_resp = httpx.get(f"{base_url}/git/ref/heads/main", headers=headers, timeout=15)
                if ref_resp.status_code != 200:
                    ref_resp = httpx.get(f"{base_url}/git/ref/heads/master", headers=headers, timeout=15)
                if ref_resp.status_code != 200:
                    return json.dumps({"error": f"Could not get SHA for branch '{base_branch}': {ref_resp.json()}"})
                ref_data = ref_resp.json()
                sha = ref_data.get("object", {}).get("sha") if isinstance(ref_data, dict) else None
                if not sha:
                    return json.dumps({"error": "Could not extract SHA from branch ref"})

                # Step 2: Create branch
                safe_bug = re.sub(r'[^a-z0-9-]', '-', bug.lower()[:40])
                branch = f"fix/{jira_key.lower()}-{safe_bug}"
                branch_resp = httpx.post(
                    f"{base_url}/git/refs",
                    headers=headers,
                    json={"ref": f"refs/heads/{branch}", "sha": sha},
                    timeout=15
                )
                if branch_resp.status_code not in (200, 201):
                    # Branch may already exist
                    branch = f"{branch}-2"
                    httpx.post(f"{base_url}/git/refs", headers=headers,
                               json={"ref": f"refs/heads/{branch}", "sha": sha}, timeout=15)

                # Step 3: Commit fixed code
                existing = httpx.get(f"{base_url}/contents/{file_to_fix}",
                                     headers=headers, params={"ref": branch}, timeout=15)
                file_sha = existing.json().get("sha") if existing.status_code == 200 else None
                encoded = base64.b64encode(fixed_code.encode()).decode()
                commit_payload = {
                    "message": f"fix({jira_key}): {bug[:60]}",
                    "content": encoded,
                    "branch": branch,
                }
                if file_sha:
                    commit_payload["sha"] = file_sha
                httpx.put(f"{base_url}/contents/{file_to_fix}",
                          headers=headers, json=commit_payload, timeout=15)

                 # Step 4: Check for existing PR before creating
                existing_prs = httpx.get(
                    f"{base_url}/pulls",
                    headers=headers,
                    params={"state": "open", "head": f"accmani:{branch}"},
                    timeout=15
                )
                if existing_prs.status_code == 200:
                    prs = existing_prs.json()
                    if isinstance(prs, list) and len(prs) > 0:
                        existing_pr = prs[0]
                        return json.dumps({
                            "auto_fix_complete": True,
                            "duplicate": True,
                            "branch": branch,
                            "pr_number": existing_pr.get("number"),
                            "pr_url": existing_pr.get("html_url"),
                            "jira_key": jira_key,
                            "message": "PR already exists — skipping creation"
                        })

                # Step 4: Create PR — targets release_branch (e.g. release/june-2026), not main
                pr_resp = httpx.post(
                    f"{base_url}/pulls",
                    headers=headers,
                    json={
                        "title": f"fix({jira_key}): {bug[:100]}",
                        "body": (
                            f"## Auto-fix by Enterprise Scrum Agent\n\n"
                            f"**Jira:** {jira_key}\n"
                            f"**Bug:** {bug}\n"
                            f"**Branch flow:** `{base_branch}` → `{branch}` → `{release_branch}`\n\n"
                            f"### Changes\n"
                            f"Fixed code in `{file_to_fix}`\n\n"
                            f"### Merge checklist\n"
                            f"- [ ] Code review approved\n"
                            f"- [ ] Unit tests pass\n"
                            f"- [ ] System test on `{release_branch}` build passes\n"
                            f"- [ ] Merge to `main` after release sign-off"
                        ),
                        "head": branch,
                        "base": release_branch,
                    },
                    timeout=15
                )
                pr_data = pr_resp.json()
                return json.dumps({
                    "auto_fix_complete": True,
                    "branch": branch,
                    "base_branch": base_branch,
                    "target_branch": release_branch,
                    "pr_number": pr_data.get("number"),
                    "pr_url": pr_data.get("html_url"),
                    "jira_key": jira_key
                })

            # ── LIST RELEASE BRANCHES ────────────────────────────────────
            if operation == "list_release_branches" or "release branches" in q or "list release" in q:
                resp = httpx.get(
                    f"{base_url}/branches",
                    headers=headers,
                    params={"per_page": 50},
                    timeout=15,
                )
                if resp.status_code == 200:
                    releases = [b["name"] for b in resp.json() if b["name"].startswith("release/")]
                    return json.dumps({"release_branches": releases, "count": len(releases)})
                return json.dumps({"error": "Could not list branches", "release_branches": []})

            # ── SYNC TO DEVELOP ────────────────────────────────────────────
            if operation == "sync_to_develop" or "sync to develop" in q or "merge to develop" in q:
                source = parsed.get("source", settings.release_branch)
                pr_resp = httpx.post(
                    f"{base_url}/pulls",
                    headers=headers,
                    json={
                        "title": f"chore: sync {source} → develop",
                        "body": (
                            f"## Release sync — {source} → develop\n\n"
                            f"Merging `{source}` into `develop` after successful system testing "
                            f"and production release sign-off.\n\n"
                            f"### Checklist\n"
                            f"- [ ] All system tests passed on `{source}`\n"
                            f"- [ ] Released to production from `{source}`\n"
                            f"- [ ] No open blocking issues on `{source}`"
                        ),
                        "head": source,
                        "base": "develop",
                    },
                    timeout=15,
                )
                data = pr_resp.json()
                if pr_resp.status_code in (200, 201):
                    return json.dumps({
                        "created": True,
                        "pr_number": data.get("number"),
                        "pr_url": data.get("html_url"),
                        "title": f"sync {source} → develop",
                        "message": f"PR created to sync '{source}' into develop — merge to complete production cycle.",
                    })
                return json.dumps({"error": data.get("message", "Could not create sync PR"), "details": data.get("errors", [])})

            # ── CREATE ISSUE ──────────────────────────────────────────────
            if "create issue" in q or "new issue" in q:
                title = pr_title or parsed_query if 'parsed_query' in dir() else query
                response = httpx.post(
                    f"{base_url}/issues", headers=headers,
                    json={"title": title[:200], "body": f"Created by Enterprise Scrum Agent\n\n{query}"},
                    timeout=15,
                )
                data = response.json()
                return json.dumps({"created": True, "number": data.get("number"), "url": data.get("html_url")})

            # ── REPO STATS ────────────────────────────────────────────────
            if "stats" in q or "summary" in q:
                response = httpx.get(base_url, headers=headers, timeout=15)
                data = response.json()
                return json.dumps({
                    "repo": data.get("full_name"),
                    "open_issues": data.get("open_issues_count"),
                    "stars": data.get("stargazers_count"),
                    "default_branch": data.get("default_branch"),
                })

            # ── DEFAULT: LIST OPEN ISSUES ─────────────────────────────────
            response = httpx.get(f"{base_url}/issues", headers=headers,
                                 params={"state": "open"}, timeout=15)
            issues = response.json()
            return json.dumps({
                "issues": [
                    {"number": i["number"], "title": i["title"],
                     "author": i["user"]["login"], "url": i["html_url"]}
                    for i in issues[:10] if "pull_request" not in i
                ]
            })

        except Exception as e:
            return json.dumps({"error": str(e)})