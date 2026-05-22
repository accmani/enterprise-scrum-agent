"""
Agent Registry — dynamic capability discovery for the Multi-agent Protocol.
Implements "Discover Agent Capabilities" from the Agentic AI architecture.
"""
from __future__ import annotations

# ── Agent Manifest ─────────────────────────────────────────────────────────────
# Each entry describes a named agent: its display name, capabilities,
# which LangChain tools it uses, and which persona config to load.

AGENT_MANIFEST: dict[str, dict] = {
    "coding_agent": {
        "display_name": "Coding Agent",
        "icon": "💻",
        "super_agent": "engineering",
        "persona": "tech_lead",
        "capabilities": [
            "technical_design", "code_review", "pull_request", "bug_fix",
            "architecture", "api_design", "code_generation", "github",
        ],
        "tools": [
            "design_agent", "code_review_agent", "github_integration",
            "estimation_tool", "jira_integration",
        ],
        "description": "Design, code review, PRs, and architecture for the healthcare claims system",
    },
    "retrieval_agent": {
        "display_name": "Retrieval Agent",
        "icon": "🔍",
        "super_agent": "retrieval",
        "persona": "scrum_master",
        "capabilities": [
            "data_retrieval", "jira_query", "github_query",
            "database_query", "context_assembly", "metrics", "claims_data",
        ],
        "tools": [
            "jira_integration", "db_agent", "github_integration", "metrics_tool",
        ],
        "description": "Fetches and assembles context from Jira, GitHub, and the healthcare claims database",
    },
    "citation_agent": {
        "display_name": "Citation Agent",
        "icon": "📎",
        "super_agent": "delivery",
        "persona": "release_manager",
        "capabilities": [
            "report_generation", "retrospective", "release_notes",
            "qa_report", "documentation", "changelog", "sprint_review",
        ],
        "tools": [
            "retro_agent", "release_agent", "jira_integration",
            "github_integration", "sprint_manager",
        ],
        "description": "Generates structured reports with cited Jira/GitHub sources",
    },
    "planning_agent": {
        "display_name": "Planning Agent",
        "icon": "📋",
        "super_agent": "planning",
        "persona": "scrum_master",
        "capabilities": [
            "sprint_planning", "story_management", "estimation",
            "backlog_grooming", "velocity_tracking", "standup", "retro",
        ],
        "tools": [
            "sprint_manager", "story_manager", "estimation_tool",
            "jira_integration", "retro_agent", "metrics_tool",
        ],
        "description": "Sprint planning, backlog management, velocity, and agile ceremonies",
    },
    "qa_agent": {
        "display_name": "QA Agent",
        "icon": "🧪",
        "super_agent": "qa",
        "persona": "qa_lead",
        "capabilities": [
            "test_generation", "bdd_scenarios", "acceptance_criteria",
            "quality_analysis", "coverage_analysis", "defect_analysis",
        ],
        "tools": [
            "qa_agent", "jira_integration", "estimation_tool",
            "metrics_tool", "db_agent",
        ],
        "description": "Test case generation, BDD scenarios, quality metrics, defect analysis",
    },
}

# ── keyword routing table ──────────────────────────────────────────────────────

_CAPABILITY_KEYWORDS: dict[str, list[str]] = {
    "coding_agent":    ["code", "design", "pr", "pull request", "review", "github", "branch", "architecture", "api", "fix", "bug"],
    "retrieval_agent": ["jira", "github data", "database", "db", "claims", "metrics", "fetch", "query", "data", "analytics"],
    "citation_agent":  ["release", "report", "retro", "retrospective", "changelog", "notes", "sprint review", "closure"],
    "planning_agent":  ["sprint", "backlog", "story", "estimate", "velocity", "standup", "plan", "agile", "scrum"],
    "qa_agent":        ["test", "bdd", "scenario", "acceptance", "qa", "coverage", "edge case", "defect"],
}

_PERSONA_TO_AGENT: dict[str, str] = {
    "tech_lead":       "coding_agent",
    "devops_engineer": "coding_agent",
    "scrum_master":    "planning_agent",
    "qa_lead":         "qa_agent",
    "release_manager": "citation_agent",
}


class AgentRegistry:
    """Runtime capability discovery for the Multi-agent Protocol."""

    @staticmethod
    def discover(query: str) -> str:
        """Return the best agent name for a free-text query."""
        q = query.lower()
        scores: dict[str, int] = {agent: 0 for agent in AGENT_MANIFEST}
        for agent, keywords in _CAPABILITY_KEYWORDS.items():
            scores[agent] = sum(1 for kw in keywords if kw in q)
        best = max(scores, key=lambda a: scores[a])
        return best if scores[best] > 0 else "planning_agent"

    @staticmethod
    def route_by_persona(persona: str) -> str:
        """Map a persona id to its primary agent name."""
        return _PERSONA_TO_AGENT.get(persona, "planning_agent")

    @staticmethod
    def get_manifest(agent_name: str) -> dict:
        return AGENT_MANIFEST.get(agent_name, AGENT_MANIFEST["planning_agent"])

    @staticmethod
    def capabilities_summary() -> str:
        """Compact capability listing for use in LLM planning prompts."""
        lines = []
        for name, m in AGENT_MANIFEST.items():
            caps = ", ".join(m["capabilities"][:5])
            lines.append(f"- {m['display_name']} ({name}): {caps}")
        return "\n".join(lines)

    @staticmethod
    def all_agent_names() -> list[str]:
        return list(AGENT_MANIFEST.keys())
