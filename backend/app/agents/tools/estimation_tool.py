from langchain.tools import BaseTool
from pydantic import BaseModel, Field
import json


class EstimationInput(BaseModel):
    story_description: str = Field(description="The user story description to estimate")


class EstimationTool(BaseTool):
    name: str = "story_estimator"
    description: str = (
        "Estimates story points for a user story using Planning Poker / T-shirt sizing. "
        "Provide the story title or description and receive an estimate with rationale."
    )
    args_schema: type[BaseModel] = EstimationInput

    def _run(self, story_description: str) -> str:
        return self._estimate(story_description)

    async def _arun(self, story_description: str) -> str:
        return self._estimate(story_description)

    def _estimate(self, story_description: str) -> str:
        desc = story_description.lower()
        # Heuristic estimation based on complexity keywords
        if any(k in desc for k in ["integration", "payment", "oauth", "sso", "auth"]):
            points, size = 8, "L"
        elif any(k in desc for k in ["ui", "form", "page", "display", "show"]):
            points, size = 3, "S"
        elif any(k in desc for k in ["api", "endpoint", "crud", "database"]):
            points, size = 5, "M"
        elif any(k in desc for k in ["report", "export", "chart", "analytics"]):
            points, size = 8, "L"
        else:
            points, size = 5, "M"

        return json.dumps({
            "story_points": points,
            "t_shirt_size": size,
            "confidence": "medium",
            "rationale": f"Based on keywords in description, estimated {points} points ({size}). "
                         f"Recommend team Planning Poker session to validate.",
            "fibonacci_options": [3, 5, 8],
        })
