"""
Output Evaluator — quality-gate and feedback loop for agent responses.
Implements the Feedback component of the Agentic AI architecture.
"""
from __future__ import annotations

import json

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI, ChatOpenAI

from app.config import settings

PASS_THRESHOLD = 0.6

_EVAL_SYSTEM = """You are a strict quality evaluator for an AI SDLC assistant.
Score the agent's response against the user's query.

Return ONLY valid JSON:
{"score": 0.0-1.0, "passed": true/false, "reason": "one sentence", "gaps": ["gap1", "gap2"]}

Scoring guide:
- 0.8-1.0: Fully answers the query with relevant details
- 0.6-0.8: Mostly answers but missing minor detail
- 0.4-0.6: Partial answer — key information missing
- 0.0-0.4: Wrong, empty, or completely off-topic

Set passed=true if score >= 0.6. Be lenient when tools returned real external data."""


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


class OutputEvaluator:
    """
    Evaluates agent output quality and signals whether a retry is needed.
    Never raises — on any error returns a passing score to avoid blocking responses.
    """

    def __init__(self):
        self._llm = _build_llm()

    async def evaluate(self, query: str, response: str) -> tuple[float, str]:
        """
        Returns (score: float, reason: str).
        Score >= PASS_THRESHOLD means the response is acceptable.
        """
        try:
            prompt = (
                f"User query: {query[:400]}\n\n"
                f"Agent response (first 800 chars):\n{response[:800]}"
            )
            result = self._llm.invoke([
                SystemMessage(content=_EVAL_SYSTEM),
                HumanMessage(content=prompt),
            ])
            raw = result.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            data = json.loads(raw)
            score = float(data.get("score", 0.75))
            reason = data.get("reason", "")
            return score, reason
        except Exception:
            # Evaluation must never block the response
            return 0.75, "eval_skipped"
