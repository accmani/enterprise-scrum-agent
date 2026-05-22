"""
SDLC Orchestrator — full Agentic AI implementation.

Architecture (matching the attached diagram):

  ┌──────────────────────────────────────────────────────────────┐
  │  Orchestrator LLM  (SDLCOrchestrator)                        │
  │                                                              │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
  │  │  Memory  │  │ Planning │  │ Feedback │  │Multi-agent │  │
  │  │ session  │  │   Task   │  │ Output   │  │  Protocol  │  │
  │  │+persist  │  │ Planner  │  │Evaluator │  │ Registry   │  │
  │  └──────────┘  └──────────┘  └──────────┘  │ Broker     │  │
  │                                             │ TaskState  │  │
  └─────────────────────────────────────────────┴────────────┘──┘
                              │
              routes via Multi-agent Protocol
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐   ┌───────────────┐   ┌──────────────┐
   │ Coding      │   │ Retrieval     │   │ Citation     │
   │ Agent       │   │ Agent         │   │ Agent        │
   │ (design,    │   │ (Jira, GitHub,│   │ (reports +   │
   │ code, PRs)  │   │  DB, metrics) │   │  sources)    │
   └─────────────┘   └───────────────┘   └──────────────┘
          │                   │                   │
   ┌─────────────┐   ┌───────────────┐
   │ Planning    │   │ QA Agent      │
   │ Agent       │   │ (tests, BDD)  │
   │ (sprint,    │   └───────────────┘
   │ backlog)    │
   └─────────────┘
                              │
                         ┌────▼────┐
                         │ Output  │
                         └─────────┘
"""

from __future__ import annotations

import re
import time
import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.mrkl_agent import ScrumMRKLAgent
from app.agents.personas import PERSONAS, DEFAULT_PERSONA
from app.memory.session_memory import SessionMemory
from app.memory.persistent_memory import PersistentMemory
from app.planning.task_planner import TaskPlanner
from app.feedback.evaluator import OutputEvaluator, PASS_THRESHOLD
from app.protocol.agent_registry import AgentRegistry, AGENT_MANIFEST
from app.protocol.task_broker import TaskBroker
from app.models.metrics import AgentMetric

# ── module-level singletons (instantiated once, shared across requests) ────────
_session_memory = SessionMemory()
_persistent_memory = PersistentMemory()
_task_planner = TaskPlanner()
_evaluator = OutputEvaluator()

# ── keyword helpers ────────────────────────────────────────────────────────────

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "planning":    ["sprint", "backlog", "story", "estimate", "velocity", "standup", "retro"],
    "engineering": ["design", "code", "pr", "pull request", "github", "branch", "architecture", "api"],
    "qa":          ["test", "bdd", "scenario", "acceptance", "qa", "coverage", "edge case"],
    "delivery":    ["release", "deploy", "changelog", "version", "rollout", "close sprint"],
    "database":    ["claim", "patient", "db", "database", "sql", "query", "deductible", "copay"],
    "metrics":     ["metric", "performance", "analytics", "dashboard", "stats", "defect"],
}

_SEVERITY_KEYWORDS = {
    "critical": ["critical", "crash", "null pointer", "exception", "down", "outage"],
    "high":     ["high", "overcharg", "off-by-one", "incorrect", "wrong"],
    "medium":   ["medium", "slow", "warning", "minor issue"],
    "low":      ["low", "cosmetic", "typo", "style"],
}

_DEFECT_CATEGORY_KEYWORDS = {
    "null-check":    ["null", "nullpointerexception", "npe", "none check"],
    "logic":         ["logic", "off-by-one", "boundary", "condition", "deductible", "copay"],
    "concurrency":   ["concurrentmodification", "thread", "race", "batch", "iterator"],
    "eligibility":   ["eligibility", "coverage", "terminated", "expired"],
    "icd10":         ["icd", "diagnosis", "z00", "wellness"],
    "authorization": ["prior auth", "authorization", "specialist"],
    "validation":    ["validation", "zero dollar", "empty", "missing field"],
}


def _infer_category(query: str) -> str:
    q = query.lower()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        if any(k in q for k in keywords):
            return category
    return "general"


def _infer_defect_info(query: str) -> tuple[bool, str | None, str | None]:
    q = query.lower()
    is_defect = any(w in q for w in ["bug", "fix", "defect", "error", "exception", "patch"])
    severity = next((sev for sev, kws in _SEVERITY_KEYWORDS.items() if any(k in q for k in kws)), None)
    category = next((cat for cat, kws in _DEFECT_CATEGORY_KEYWORDS.items() if any(k in q for k in kws)), None)
    return is_defect, severity, category


def _extract_tools_used(response: str) -> str:
    matches = re.findall(r"Action:\s*(\w+)", response)
    return ",".join(dict.fromkeys(matches)) if matches else ""


class SDLCOrchestrator:
    """
    Full Agentic AI Orchestrator with:
    - Memory (session + persistent)
    - Planning (task decomposition via LLM)
    - Multi-agent Protocol (Agent Registry + Task Broker + Task State)
    - Feedback (output quality evaluation + retry)
    """

    def __init__(self, db_session: AsyncSession | None = None):
        self.db_session = db_session

    async def run(
        self,
        query: str,
        persona: str = DEFAULT_PERSONA,
        session_id: str | None = None,
        session_history=None,
    ) -> dict:
        session_id = session_id or str(uuid.uuid4())
        persona_config = PERSONAS.get(persona, PERSONAS[DEFAULT_PERSONA])
        start = time.time()
        broker = TaskBroker()

        # ── 1. MEMORY — load session context ──────────────────────────────────
        SessionMemory.add_message(session_id, "user", query)
        context_window = SessionMemory.get_context_window(session_id)
        persistent_hint = PersistentMemory.format_for_prompt(query)

        # ── 2. PLANNING — decompose query into named-agent steps ───────────────
        plan_state = await _task_planner.decompose(query, context_window)

        # ── 3. MULTI-AGENT PROTOCOL — execute steps via TaskBroker ────────────
        cumulative_result = ""
        agent_chain: list[str] = []
        _MAX_STEPS = 10  # hard cap against infinite loops

        for _iteration in range(_MAX_STEPS):
            ready = plan_state.get_ready_steps()
            if not ready:
                break

            for step in ready:
                plan_state.mark_running(step.step_id)

                # Discover the agent's persona config
                agent_manifest = AGENT_MANIFEST.get(step.agent, AGENT_MANIFEST["planning_agent"])
                step_persona = agent_manifest["persona"]
                step_persona_config = PERSONAS.get(step_persona, persona_config)

                # Broker: format enriched input (injects prior results + memory)
                enriched_input = broker.handoff(
                    from_agent="orchestrator" if not agent_chain else agent_chain[-1],
                    to_agent=step.agent,
                    task=step.action,
                    cumulative_result=cumulative_result,
                )

                # Prepend persistent memory hint if relevant
                if persistent_hint:
                    enriched_input = f"{persistent_hint}\n\n{enriched_input}"

                # ── Execute the named agent ────────────────────────────────────
                try:
                    executor = ScrumMRKLAgent(
                        db_session=self.db_session,
                        persona=step_persona,
                        persona_config=step_persona_config,
                    )
                    step_result = await executor.run(enriched_input)
                    plan_state.mark_done(step.step_id, step_result)
                    cumulative_result = (
                        f"{cumulative_result}\n\n[{step.agent}]\n{step_result}"
                        if cumulative_result else step_result
                    )
                    agent_chain.append(step.agent)
                    SessionMemory.record_agent(session_id, step.agent)
                except Exception as exc:
                    plan_state.mark_failed(step.step_id, str(exc))
                    cumulative_result += f"\n[{step.agent} error: {exc}]"

            if plan_state.all_done():
                break

        final_reply = cumulative_result.strip() or "I was unable to process that request."

        # ── 4. FEEDBACK — evaluate quality, retry once if below threshold ──────
        eval_score, eval_reason = await _evaluator.evaluate(query, final_reply)
        if eval_score < PASS_THRESHOLD:
            try:
                retry_input = (
                    f"The previous response was incomplete ({eval_reason}). "
                    f"Please provide a thorough answer to: {query}"
                )
                fallback = ScrumMRKLAgent(
                    db_session=self.db_session,
                    persona=persona,
                    persona_config=persona_config,
                )
                final_reply = await fallback.run(retry_input)
                eval_score, _ = await _evaluator.evaluate(query, final_reply)
                agent_chain.append(f"{AgentRegistry.route_by_persona(persona)}[retry]")
            except Exception:
                pass  # keep original if retry fails

        # ── 5. MEMORY — store result ───────────────────────────────────────────
        SessionMemory.add_message(session_id, "assistant", final_reply[:600], agent=agent_chain[-1] if agent_chain else "")

        # Persist defect-tagged facts for future sessions
        is_defect, severity, defect_category = _infer_defect_info(query)
        if is_defect and severity:
            PersistentMemory.store_fact(
                key=f"defect:{session_id}:{int(time.time())}",
                value={
                    "query": query[:200],
                    "severity": severity,
                    "category": defect_category,
                    "agents": ",".join(agent_chain),
                    "reply_preview": final_reply[:300],
                },
            )

        # ── 6. METRICS LOG ─────────────────────────────────────────────────────
        duration_ms = int((time.time() - start) * 1000)
        await self._log_metric(
            persona=persona,
            super_agent=(",".join(agent_chain) or persona_config.get("super_agent", "orchestrator"))[:100],
            query_preview=query[:200],
            query_category=_infer_category(query),
            tools_invoked=_extract_tools_used(final_reply),
            duration_ms=duration_ms,
            success=not final_reply.startswith("Error"),
            is_defect_fix=is_defect,
            defect_severity=severity,
            defect_category=defect_category,
            session_id=session_id,
        )

        return {
            "reply":          final_reply,
            "persona":        persona,
            "super_agent":    agent_chain[0] if agent_chain else persona_config.get("super_agent", "orchestrator"),
            "duration_ms":    duration_ms,
            # ── new Agentic AI fields ──────────────────────────────────────────
            "agent_chain":    agent_chain,
            "task_plan":      plan_state.to_dict(),
            "memory_summary": SessionMemory.get_summary(session_id),
            "eval_score":     round(eval_score, 2),
        }

    async def _log_metric(self, **kwargs) -> None:
        if self.db_session is None:
            return
        try:
            metric = AgentMetric(created_at=datetime.utcnow(), **kwargs)
            self.db_session.add(metric)
            await self.db_session.commit()
        except Exception:
            try:
                await self.db_session.rollback()
            except Exception:
                pass
