from langchain_classic.tools import BaseTool
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field
from app.config import settings
import json


class DesignQueryInput(BaseModel):
    query: str = Field(description="Feature or bug fix to generate a technical design for")


class DesignTool(BaseTool):
    name: str = "design_agent"
    description: str = (
        "Generate technical design documents, before/after code changes, risk assessments, "
        "and architecture recommendations for a feature or bug fix. "
        "Use when asked about system design, technical approach, or code-level design."
    )
    args_schema: type[BaseModel] = DesignQueryInput

    def _run(self, query: str) -> str:
        import asyncio as _asyncio
        try:
            loop = _asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(_asyncio.run, self._arun(query))
                    return future.result(timeout=60)
        except Exception:
            pass
        return self._execute(query)

    async def _arun(self, query: str) -> str:
        try:
            prompt = self._build_prompt(query)
            llm = self._get_llm()
            response = await llm.ainvoke([HumanMessage(content=prompt)])
            return response.content
        except Exception as e:
            return json.dumps({"error": str(e)})

    def _get_llm(self):
        if settings.azure_openai_endpoint:
            return AzureChatOpenAI(
                azure_endpoint=settings.azure_openai_endpoint,
                azure_deployment=settings.azure_openai_deployment,
                api_key=settings.azure_openai_api_key,
                api_version=settings.openai_api_version,
                temperature=0,
            )
        return ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key, temperature=0)

    def _build_prompt(self, query: str) -> str:
        return f"""You are a senior software architect working on a healthcare claims system.

Given this bug fix or feature request:
"{query}"

Produce a concise technical design document covering:

1. **Overview** — what the change does and why
2. **Root Cause** (for bugs) — what code path is broken
3. **Before / After** — the problematic code snippet and the corrected version
4. **Affected Components** — classes, methods, services touched
5. **Risk Assessment** — what could go wrong, HIPAA/PHI considerations
6. **Testing Approach** — unit tests, integration tests, edge cases to cover
7. **Story Points Estimate** — XS (1) / S (2) / M (3) / L (5) / XL (8)

Be specific and actionable. Reference actual Java/Spring patterns where relevant."""

    def _execute(self, query: str) -> str:
        try:
            llm = self._get_llm()
            response = llm.invoke([HumanMessage(content=self._build_prompt(query))])
            return response.content
        except Exception as e:
            return json.dumps({"error": str(e)})
