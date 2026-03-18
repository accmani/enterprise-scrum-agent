from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Any
import json


class StoryQueryInput(BaseModel):
    query: str = Field(description="Natural language query about user stories")


class StoryTool(BaseTool):
    name: str = "story_manager"
    description: str = (
        "Use this tool to create, list, update, or refine user stories and backlog items. "
        "Can generate acceptance criteria and split large stories."
    )
    args_schema: type[BaseModel] = StoryQueryInput
    db_session: Any = None

    def _run(self, query: str) -> str:
        return self._handle_query(query)

    async def _arun(self, query: str) -> str:
        return self._handle_query(query)

    def _handle_query(self, query: str) -> str:
        q = query.lower()
        if "create" in q or "write" in q or "generate" in q:
            return json.dumps({
                "story": {
                    "title": "As a user, I want to log in with SSO",
                    "description": "Implement Single Sign-On via Azure AD for enterprise users.",
                    "acceptance_criteria": [
                        "Given I am on the login page, when I click 'Sign in with SSO', then I am redirected to Azure AD",
                        "Given valid Azure AD credentials, when I authenticate, then I am logged into the app",
                        "Given invalid credentials, when I authenticate, then I see a clear error message",
                    ],
                    "story_points": 5,
                    "size": "M",
                }
            })
        if "list" in q or "backlog" in q:
            return json.dumps({
                "stories": [
                    {"id": 1, "title": "User login via SSO", "points": 5, "status": "in_progress"},
                    {"id": 2, "title": "Payment gateway integration", "points": 8, "status": "todo"},
                    {"id": 3, "title": "Export reports to PDF", "points": 3, "status": "backlog"},
                ]
            })
        if "split" in q or "break" in q:
            return json.dumps({
                "original": query,
                "sub_stories": [
                    "As a user, I want to initiate a payment (3 points)",
                    "As a user, I want to confirm a payment (2 points)",
                    "As a user, I want to receive a payment receipt (2 points)",
                ]
            })
        return json.dumps({"message": "Story operation acknowledged", "query": query})
