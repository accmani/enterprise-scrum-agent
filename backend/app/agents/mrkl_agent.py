"""
MRKL Agent — base executor for all Super Agents in the SDLC hierarchy.

Architecture:
  SDLCOrchestrator            (orchestrator.py — routes by persona)
  ├── Planning Super Agent    (scrum_master persona)
  ├── Engineering Super Agent (tech_lead / devops_engineer persona)
  ├── QA Super Agent          (qa_lead persona)
  └── Delivery Super Agent    (release_manager persona)

Each Super Agent is a ScrumMRKLAgent instance configured with:
- A persona-specific system prompt
- A filtered tool subset matching the persona's responsibilities
"""

from langchain.agents import AgentExecutor, create_react_agent
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.tools import BaseTool

from app.config import settings
from app.agents.personas import SUPER_AGENT_TOOLS
from app.agents.tools.sprint_tool import SprintTool
from app.agents.tools.story_tool import StoryTool
from app.agents.tools.estimation_tool import EstimationTool
from app.agents.tools.jira_tool import JiraTool
from app.agents.tools.github_tool import GitHubTool
from app.agents.tools.qa_tool import QATool
from app.agents.tools.code_review_tool import CodeReviewTool
from app.agents.tools.design_tool import DesignTool
from app.agents.tools.retro_tool import RetroTool
from app.agents.tools.release_tool import ReleaseTool
from app.agents.tools.db_agent_tool import DBAgentTool
from app.agents.tools.metrics_tool import MetricsTool
from app.agents.tools.scanner_tool import ScannerTool
from app.agents.tools.evaluator_tool import EvaluatorTool


_REACT_SUFFIX = """
You have access to the following tools:

{tools}

Use the following format STRICTLY:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

RULES:
- CRITICAL: Call each tool ONLY ONCE per step. Never call the same tool twice. If tool returns a result accept it and go to Final Answer immediately.
- CRITICAL: Never create duplicate Jira issues or GitHub PRs. If creation succeeded do not call the tool again.
- Always include "Action Input:" immediately after "Action:"
- NEVER output Action: without Action Input: on the next line
- If unsure of input format, use: Action Input: {{}}
- If a tool returns an error, report it in Final Answer — do NOT retry more than once
- For retrospectives: use retro_agent
- For release notes: use release_agent
- For test cases: use qa_agent
- For code review: use code_review_agent
- For technical design: use design_agent
- For Jira operations: use jira_integration
- For GitHub operations: use github_integration
- For database/claims queries: use db_agent
- For performance metrics: use metrics_tool
- For general Agile advice: go straight to Final Answer without tools

SDLC AUTO-FIX FLOW — when asked to fix a bug:
Step 1: Call github_integration ONCE with operation=auto_fix
  - Always include "base": "develop" — fix branches are ALWAYS cut from develop
  - Always include "release_branch": "release/june-2026" — PRs always target the release branch, NEVER main
  - Branch naming: fix/{jira-key}-{short-description}  e.g. fix/st-42-er-copay-wrong-rate
Step 2: When you receive ANY response from github_integration — go to Final Answer IMMEDIATELY
Step 3: NEVER call github_integration more than once
Step 4: NEVER retry after receiving auto_fix_complete=true OR duplicate=true
Step 5: A response containing pr_url, pr_number, or duplicate=true means SUCCESS — stop immediately

GITFLOW BRANCH STRATEGY (follow this for ALL branch and PR operations):
- develop        → integration base; all fix branches cut from here
- fix/ST-{n}-*   → one branch per Jira ticket, branched from develop
- release/mmm-yyyy → release candidate; all fix PRs target here for system testing
- main           → production; only release branch merges in after sign-off
- hotfix/ST-{n}-* → cut from main for critical prod fixes, merge back to main AND develop

Begin!

Question: {input}
Thought:{agent_scratchpad}"""

DEFAULT_SYSTEM_PROMPT = (
    "You are an expert Enterprise Scrum Agent covering the full SDLC. You help teams with:\n"
    "- Planning: sprint planning, backlog management, story creation\n"
    "- Requirements: user stories, acceptance criteria, BDD scenarios\n"
    "- Design: technical design docs, API contracts, data models\n"
    "- Development: GitHub PR tracking, code review\n"
    "- QA/Testing: test case generation, coverage analysis\n"
    "- Deployment: release notes, changelog generation\n"
    "- Operations: standups, retrospectives, velocity tracking\n"
    "- Database: query healthcare claims data, detect billing anomalies\n"
    "- Metrics: agent performance, defect resolution stats"
)

# Tool name → class
_TOOL_REGISTRY: dict[str, type] = {
    "sprint_manager":    SprintTool,
    "story_manager":     StoryTool,
    "estimation_tool":   EstimationTool,
    "qa_agent":          QATool,
    "design_agent":      DesignTool,
    "jira_integration":  JiraTool,
    "github_integration": GitHubTool,
    "code_review_agent": CodeReviewTool,
    "retro_agent":       RetroTool,
    "release_agent":     ReleaseTool,
    "db_agent":          DBAgentTool,
    "metrics_tool":      MetricsTool,
}

# Tools that require db_session constructor arg
_DB_SESSION_TOOLS = {"sprint_manager", "story_manager", "db_agent"}

# Tools that require Jira config
_JIRA_REQUIRED = {"jira_integration", "retro_agent"}

# Tools that require GitHub config
_GITHUB_REQUIRED = {"github_integration", "code_review_agent"}

# Tools that need either Jira or GitHub
_RELEASE_REQUIRED = {"release_agent"}


class ScrumMRKLAgent:
    """
    Persona-aware MRKL agent.  Instantiated by SDLCOrchestrator with the
    persona config for the current user session — selects the right tool
    subset and injects the persona system prompt automatically.
    """

    def __init__(
        self,
        db_session=None,
        persona: str | None = None,
        persona_config: dict | None = None,
    ):
        self.db_session = db_session
        self.persona = persona
        self.persona_config = persona_config or {}
        self._agent_executor: AgentExecutor | None = None

    def _build_llm(self):
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

    def _build_tools(self) -> list[BaseTool]:
        super_agent = self.persona_config.get("super_agent")
        allowed = SUPER_AGENT_TOOLS.get(super_agent) if super_agent else None

        tools: list[BaseTool] = []
        tools.append(ScannerTool())
        tools.append(EvaluatorTool())
        for name, cls in _TOOL_REGISTRY.items():
            if allowed and name not in allowed:
                continue

            jira_ok = bool(settings.jira_url and settings.jira_api_token)
            github_ok = bool(settings.github_token and settings.github_repo)

            if name in _JIRA_REQUIRED and not jira_ok:
                continue
            if name in _GITHUB_REQUIRED and not github_ok:
                continue
            if name in _RELEASE_REQUIRED and not (jira_ok or github_ok):
                continue

            if name in _DB_SESSION_TOOLS:
                tools.append(cls(db_session=self.db_session))
            else:
                tools.append(cls())

        return tools

    def _build_prompt(self) -> PromptTemplate:
        system_prompt = self.persona_config.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
        if self.persona_config:
            name = self.persona_config.get("name", "Scrum Agent")
            role = self.persona_config.get("role", "SDLC Assistant")
            header = f"You are operating as: {name} — {role}\n\n{system_prompt}"
        else:
            header = DEFAULT_SYSTEM_PROMPT
        template = header + _REACT_SUFFIX
        return PromptTemplate.from_template(template)

    def _get_executor(self) -> AgentExecutor:
        if self._agent_executor is None:
            llm = self._build_llm()
            tools = self._build_tools()
            prompt = self._build_prompt()
            agent = create_react_agent(llm, tools, prompt)
            self._agent_executor = AgentExecutor(
                agent=agent,
                tools=tools,
                verbose=True,
                max_iterations=5,          # was 20
                #early_stopping_method="generate",  # add this
                handle_parsing_errors=True,
            )
        return self._agent_executor

    async def run(self, query: str, session_history=None) -> str:
        # Escape curly braces so LangChain prompt template doesn't
        # interpret {} in user input as template variables
        query = query.replace('{', '{{').replace('}', '}}')
        try:
            executor = self._get_executor()
            result = await executor.ainvoke({"input": query})
            return result.get("output", "I was unable to process that request.")
        except Exception as e:
            return f"I encountered an error processing your request: {str(e)}"
