"""
Task Planner — LLM-based query decomposition into ordered agent steps.
Implements the Planning component of the Agentic AI architecture.
"""
from __future__ import annotations

import json

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI, ChatOpenAI

from app.config import settings
from app.protocol.agent_registry import AgentRegistry
from app.protocol.task_state import TaskPlanState, TaskStep

_PLANNER_SYSTEM = f"""You are a task decomposition engine for an AI-powered SDLC platform.

Given a user query, break it into ordered steps for named specialist agents.

{AgentRegistry.capabilities_summary()}

Rules:
- Return ONLY a valid JSON array of steps — nothing else.
- Use agent names EXACTLY as listed above.
- If the query can be answered by ONE agent, return a single-step array.
- If multiple agents are needed (e.g. fetch data then generate a report), return multiple steps with depends_on.
- "depends_on" is a list of step_ids that must complete before this step starts.
- Keep actions short and actionable (one sentence).

Output format:
[
  {{"step_id": "step_0", "agent": "<agent_name>", "action": "<what to do>", "depends_on": []}},
  {{"step_id": "step_1", "agent": "<agent_name>", "action": "<what to do>", "depends_on": ["step_0"]}}
]"""


def _build_llm():
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


class TaskPlanner:
    """
    Decomposes a user query into a TaskPlanState (list of TaskSteps with
    agent assignments and dependency ordering).
    Falls back to a single-step plan if the LLM output is unparseable.
    """

    def __init__(self):
        self._llm = _build_llm()

    async def decompose(self, query: str, context_window: list[dict]) -> TaskPlanState:
        context_str = ""
        if context_window:
            lines = [f"{t['role'].capitalize()}: {t['content'][:200]}" for t in context_window[-4:]]
            context_str = "Recent conversation:\n" + "\n".join(lines) + "\n\n"

        try:
            response = self._llm.invoke([
                SystemMessage(content=_PLANNER_SYSTEM),
                HumanMessage(content=f"{context_str}Query: {query}"),
            ])
            raw = response.content.strip()
            # strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            steps_data: list[dict] = json.loads(raw)
            steps = [
                TaskStep(
                    step_id=s["step_id"],
                    agent=s.get("agent", "planning_agent"),
                    action=s.get("action", query),
                    depends_on=s.get("depends_on", []),
                )
                for s in steps_data
                if s.get("agent") in AgentRegistry.all_agent_names()
            ]
            if not steps:
                raise ValueError("no valid steps")
            return TaskPlanState(query=query, steps=steps)
        except Exception:
            # Fallback: single step routed by query keywords
            primary = AgentRegistry.discover(query)
            return TaskPlanState(
                query=query,
                steps=[TaskStep(step_id="step_0", agent=primary, action=query, depends_on=[])],
            )
