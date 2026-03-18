"""
MRKL (Modular Reasoning, Knowledge and Language) Agent for Scrum management.

The MRKL architecture uses a router LLM that selects from a set of expert
modules (tools) to answer queries. Each tool is a self-contained expert.
"""
from langchain.agents import AgentExecutor, create_react_agent
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.tools import BaseTool
from typing import Any

from app.config import settings
from app.agents.tools.sprint_tool import SprintTool
from app.agents.tools.story_tool import StoryTool
from app.agents.tools.estimation_tool import EstimationTool
from app.agents.tools.jira_tool import JiraTool


SCRUM_AGENT_PROMPT = PromptTemplate.from_template(
    """You are an expert Agile Scrum Master AI assistant. You help teams manage sprints,
user stories, backlog refinement, and Agile best practices.

You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought:{agent_scratchpad}"""
)


class ScrumMRKLAgent:
    """MRKL Agent that routes Scrum queries to specialized tool modules."""

    def __init__(self, db_session=None):
        self.db_session = db_session
        self._agent_executor: AgentExecutor | None = None

    def _build_llm(self) -> ChatOpenAI:
        if settings.azure_openai_endpoint:
            from langchain_openai import AzureChatOpenAI
            return AzureChatOpenAI(
                azure_endpoint=settings.azure_openai_endpoint,
                azure_deployment=settings.azure_openai_deployment,
                api_key=settings.azure_openai_api_key,
                temperature=0,
            )
        return ChatOpenAI(
            model=settings.openai_model,
            api_key=settings.openai_api_key,
            temperature=0,
        )

    def _build_tools(self) -> list[BaseTool]:
        tools = [
            SprintTool(db_session=self.db_session),
            StoryTool(db_session=self.db_session),
            EstimationTool(),
        ]
        if settings.jira_url and settings.jira_api_token:
            tools.append(JiraTool())
        return tools

    def _get_executor(self) -> AgentExecutor:
        if self._agent_executor is None:
            llm = self._build_llm()
            tools = self._build_tools()
            agent = create_react_agent(llm, tools, SCRUM_AGENT_PROMPT)
            self._agent_executor = AgentExecutor(
                agent=agent,
                tools=tools,
                verbose=True,
                handle_parsing_errors=True,
                max_iterations=10,
            )
        return self._agent_executor

    async def run(self, query: str, session_history: list[dict] | None = None) -> str:
        executor = self._get_executor()
        result = await executor.ainvoke({"input": query})
        return result.get("output", "I was unable to process that request.")
