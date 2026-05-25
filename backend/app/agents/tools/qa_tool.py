from langchain_classic.tools import BaseTool
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field
from app.config import settings
import json


class QAQueryInput(BaseModel):
    query: str = Field(description="Bug or feature to generate test cases for")


class QATool(BaseTool):
    name: str = "qa_agent"
    description: str = (
        "Generate test cases, BDD scenarios (Given/When/Then), acceptance criteria, "
        "and edge cases for a bug fix or feature. Use when asked about testing, "
        "QA, test coverage, or acceptance criteria."
    )
    args_schema: type[BaseModel] = QAQueryInput

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
        return f"""You are a QA Lead for a healthcare claims processing system.

Given this bug fix or feature:
"{query}"

Generate a comprehensive test plan covering:

1. **Bug Reproduction Test** — exact steps to reproduce the original defect
2. **Fix Verification Test** — steps to confirm the fix works correctly
3. **BDD Scenarios** (Given / When / Then format) — at least 3 scenarios including the happy path, boundary condition, and a negative case
4. **Edge Cases** — list at least 4 edge cases specific to this bug/feature
5. **Regression Checks** — related areas that should be tested to avoid regressions
6. **HIPAA / PHI Considerations** — any compliance checks relevant to patient data

Be specific — use realistic claim amounts, member IDs, and service types from a healthcare context."""

    def _execute(self, query: str) -> str:
        try:
            llm = self._get_llm()
            response = llm.invoke([HumanMessage(content=self._build_prompt(query))])
            return response.content
        except Exception as e:
            return json.dumps({"error": str(e)})
