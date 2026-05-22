"""
Task State — tracks multi-step task execution across named agents.
Implements "Update Task Information" in the Multi-agent Protocol.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE    = "done"
    FAILED  = "failed"


@dataclass
class TaskStep:
    step_id: str
    agent: str           # coding_agent | retrieval_agent | citation_agent | planning_agent | qa_agent
    action: str          # natural-language description of what this step should do
    depends_on: list[str] = field(default_factory=list)  # step_ids that must be DONE first
    status: StepStatus = StepStatus.PENDING
    result: str | None = None
    started_at: float | None = None
    finished_at: float | None = None

    @property
    def duration_s(self) -> float | None:
        if self.started_at and self.finished_at:
            return round(self.finished_at - self.started_at, 2)
        return None

    def to_dict(self) -> dict:
        return {
            "step_id":      self.step_id,
            "agent":        self.agent,
            "action":       self.action,
            "status":       self.status.value,
            "depends_on":   self.depends_on,
            "duration_s":   self.duration_s,
            "result_preview": (self.result or "")[:300],
        }


@dataclass
class TaskPlanState:
    query: str
    steps: list[TaskStep] = field(default_factory=list)

    # ── state transitions ──────────────────────────────────────────────────────

    def mark_running(self, step_id: str) -> None:
        for s in self.steps:
            if s.step_id == step_id:
                s.status = StepStatus.RUNNING
                s.started_at = time.time()

    def mark_done(self, step_id: str, result: str) -> None:
        for s in self.steps:
            if s.step_id == step_id:
                s.status = StepStatus.DONE
                s.result = result
                s.finished_at = time.time()

    def mark_failed(self, step_id: str, error: str) -> None:
        for s in self.steps:
            if s.step_id == step_id:
                s.status = StepStatus.FAILED
                s.result = error
                s.finished_at = time.time()

    # ── scheduling ────────────────────────────────────────────────────────────

    def get_ready_steps(self) -> list[TaskStep]:
        """Steps whose dependencies are all DONE and which are still PENDING."""
        done_ids = {s.step_id for s in self.steps if s.status == StepStatus.DONE}
        return [
            s for s in self.steps
            if s.status == StepStatus.PENDING
            and all(dep in done_ids for dep in s.depends_on)
        ]

    def all_done(self) -> bool:
        return all(s.status in (StepStatus.DONE, StepStatus.FAILED) for s in self.steps)

    # ── serialisation ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "query": self.query,
            "steps": [s.to_dict() for s in self.steps],
            "complete": self.all_done(),
            "agents_used": list(dict.fromkeys(s.agent for s in self.steps)),
        }
