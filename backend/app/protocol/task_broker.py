"""
Task Broker — inter-agent task routing, context sharing, and handoff formatting.
Implements "Share Tasks" in the Multi-agent Protocol.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class HandoffContext:
    from_agent: str
    to_agent: str
    task: str
    cumulative_result: str
    shared_data: dict = field(default_factory=dict)


class TaskBroker:
    """
    Stateless utility that formats agent-to-agent handoffs and maintains
    a shared context dictionary visible to all agents in a plan run.
    One instance per orchestrator.run() call.
    """

    def __init__(self) -> None:
        self._shared: dict = {}
        self._handoff_log: list[HandoffContext] = []

    # ── context sharing ────────────────────────────────────────────────────────

    def share(self, key: str, value) -> None:
        """Broadcast a value to all agents for this run."""
        self._shared[key] = value

    def get_shared(self, key: str, default=None):
        return self._shared.get(key, default)

    # ── handoff ────────────────────────────────────────────────────────────────

    def handoff(
        self,
        from_agent: str,
        to_agent: str,
        task: str,
        cumulative_result: str = "",
        data: dict | None = None,
    ) -> str:
        """
        Format the input string for a receiving agent, injecting
        context from prior steps and any shared data.
        Returns the enriched prompt string.
        """
        ctx = HandoffContext(
            from_agent=from_agent,
            to_agent=to_agent,
            task=task,
            cumulative_result=cumulative_result,
            shared_data=data or {},
        )
        self._handoff_log.append(ctx)

        if not cumulative_result:
            return task  # first agent — no prior result to inject

        prior = cumulative_result[:600]
        return (
            f"[Context from {from_agent}]\n{prior}\n\n"
            f"[Your task as {to_agent}]\n{task}"
        )

    # ── audit ──────────────────────────────────────────────────────────────────

    def agent_chain(self) -> list[str]:
        """Ordered list of unique agents involved so far."""
        seen: list[str] = []
        for h in self._handoff_log:
            for name in (h.from_agent, h.to_agent):
                if name not in seen and name != "orchestrator":
                    seen.append(name)
        return seen

    def handoff_summary(self) -> list[dict]:
        return [
            {
                "from": h.from_agent,
                "to":   h.to_agent,
                "task": h.task[:120],
            }
            for h in self._handoff_log
        ]
