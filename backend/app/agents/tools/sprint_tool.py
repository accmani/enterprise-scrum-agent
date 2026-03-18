from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Any
import json


class SprintQueryInput(BaseModel):
    query: str = Field(description="Natural language query about sprints")


class SprintTool(BaseTool):
    name: str = "sprint_manager"
    description: str = (
        "Use this tool to create, list, update, or get information about Scrum sprints. "
        "Input should be a natural language description of the sprint operation needed."
    )
    args_schema: type[BaseModel] = SprintQueryInput
    db_session: Any = None

    def _run(self, query: str) -> str:
        return self._handle_query(query)

    async def _arun(self, query: str) -> str:
        return self._handle_query(query)

    def _handle_query(self, query: str) -> str:
        q = query.lower()
        if "list" in q or "show" in q or "get all" in q:
            return json.dumps({
                "sprints": [
                    {"id": 1, "name": "Sprint 1", "status": "active", "goal": "Deliver MVP login flow", "velocity": 34},
                    {"id": 2, "name": "Sprint 2", "status": "planning", "goal": "Payment integration", "velocity": None},
                ]
            })
        if "create" in q or "new sprint" in q:
            return json.dumps({"message": "Sprint created successfully", "sprint_id": 3, "name": "Sprint 3", "status": "planning"})
        if "velocity" in q:
            return json.dumps({"average_velocity": 32, "last_3_sprints": [34, 31, 30]})
        return json.dumps({"message": "Sprint operation acknowledged", "query": query})
