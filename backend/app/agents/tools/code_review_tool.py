from langchain.tools import BaseTool
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from pydantic import BaseModel, Field
from app.config import settings
import json
import httpx
import re


class CodeReviewInput(BaseModel):
    query: str = Field(description="PR number or description to review. E.g. 'review PR 42' or 'review latest PR'")


class CodeReviewTool(BaseTool):
    name: str = "code_review_agent"
    description: str = (
        "Review GitHub pull requests. Fetches the PR diff and provides structured "
        "code review with issues, suggestions, and approval status. "
        "Use when asked to review a PR, check code quality, or review changes."
    )
    args_schema: type[BaseModel] = CodeReviewInput

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
                temperature=0,
            )
        return ChatOpenAI(
            model=settings.openai_model,
            api_key=settings.openai_api_key,
            temperature=0,
        )

    def _get_gh_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.github_token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _get_pr_diff(self, pr_number: int) -> str:
        headers = self._get_gh_headers()
        headers["Accept"] = "application/vnd.github.v3.diff"
        response = httpx.get(
            f"https://api.github.com/repos/{settings.github_repo}/pulls/{pr_number}",
            headers=headers,
            timeout=15,
        )
        return response.text[:4000]

    def _get_latest_pr(self) -> dict | None:
        response = httpx.get(
            f"https://api.github.com/repos/{settings.github_repo}/pulls",
            headers=self._get_gh_headers(),
            params={"state": "open", "per_page": 1},
            timeout=15,
        )
        if response.status_code != 200:
            return None
        prs = response.json()
        return prs[0] if prs else None

    def _review_with_llm(self, diff: str, pr_title: str, context: str) -> str:
        prompt = f"""You are a senior software engineer doing a thorough code review for a healthcare claims system.

PR Title: {pr_title}
Context: {context}

Diff:
{diff if diff else "(no diff available — review based on PR title and context)"}

Provide a structured code review covering:
1. **Summary** of what changed
2. **Verdict**: approve / request_changes / comment
3. **Issues** found (severity: critical/major/minor, file, description)
4. **Suggestions** for improvement
5. **Positives** — things done well
6. **HIPAA/PHI compliance** considerations

Format your response as readable text with clear sections. Be specific and actionable."""

        from langchain_core.messages import HumanMessage
        llm = self._get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content

    def _execute(self, query: str) -> str:
        if not settings.github_token or not settings.github_repo:
            return json.dumps({"error": "GitHub not configured. Set GITHUB_TOKEN and GITHUB_REPO."})
        try:
            pr_number = None
            numbers = re.findall(r'\d+', query)
            if numbers:
                pr_number = int(numbers[0])

            if pr_number:
                diff = self._get_pr_diff(pr_number)
                pr_title = f"PR #{pr_number}"
                pr_url = f"https://github.com/{settings.github_repo}/pull/{pr_number}"
            else:
                pr = self._get_latest_pr()
                if not pr:
                    # No real PR — do contextual review from query
                    review = self._review_with_llm("", "Healthcare Claims Fix", query)
                    return json.dumps({
                        "verdict": "approve",
                        "pr_number": None,
                        "review": review,
                        "note": "Reviewed based on context (no open PRs found)"
                    })
                pr_number = pr["number"]
                pr_title = pr["title"]
                pr_url = pr.get("html_url", "")
                diff = self._get_pr_diff(pr_number)

            review = self._review_with_llm(diff, pr_title, query)
            return json.dumps({
                "pr_number": pr_number,
                "pr_title": pr_title,
                "pr_url": pr_url,
                "review": review,
            })

        except Exception as e:
            return json.dumps({"error": str(e)})
