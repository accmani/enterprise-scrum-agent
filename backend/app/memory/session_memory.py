"""
Session Memory — per-session conversation history and context store.
Implements the Memory component of the Agentic AI architecture.
"""
from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Literal

_MAX_TURNS = 20  # messages retained per session


@dataclass
class MemoryMessage:
    role: Literal["user", "assistant", "tool"]
    content: str
    agent: str = ""
    timestamp: float = field(default_factory=time.time)


class SessionMemory:
    """
    Module-level singleton — one shared instance across all requests.
    Stores conversation history, agent chain, and free-form context per session_id.
    """

    _messages: dict[str, list[MemoryMessage]] = defaultdict(list)
    _context: dict[str, dict] = defaultdict(dict)
    _agent_chain: dict[str, list[str]] = defaultdict(list)

    @classmethod
    def add_message(cls, session_id: str, role: str, content: str, agent: str = "") -> None:
        msgs = cls._messages[session_id]
        msgs.append(MemoryMessage(role=role, content=content, agent=agent))
        if len(msgs) > _MAX_TURNS:
            cls._messages[session_id] = msgs[-_MAX_TURNS:]

    @classmethod
    def get_context_window(cls, session_id: str, max_turns: int = 8) -> list[dict]:
        """Return recent turns formatted for LLM injection."""
        msgs = cls._messages[session_id][-max_turns:]
        return [{"role": m.role, "content": m.content} for m in msgs]

    @classmethod
    def get_context_string(cls, session_id: str, max_turns: int = 6) -> str:
        """Return recent history as a compact string."""
        turns = cls.get_context_window(session_id, max_turns)
        if not turns:
            return ""
        lines = [f"{t['role'].capitalize()}: {t['content'][:300]}" for t in turns]
        return "\n".join(lines)

    @classmethod
    def set_context(cls, session_id: str, key: str, value) -> None:
        cls._context[session_id][key] = value

    @classmethod
    def get_context(cls, session_id: str, key: str, default=None):
        return cls._context[session_id].get(key, default)

    @classmethod
    def record_agent(cls, session_id: str, agent_name: str) -> None:
        cls._agent_chain[session_id].append(agent_name)

    @classmethod
    def get_summary(cls, session_id: str) -> str:
        msg_count = len(cls._messages.get(session_id, []))
        agents = cls._agent_chain.get(session_id, [])
        last_agents = list(dict.fromkeys(agents))[-3:]  # unique, last 3
        return f"{msg_count} messages | agents: {', '.join(last_agents) or 'none'}"

    @classmethod
    def clear(cls, session_id: str) -> None:
        cls._messages.pop(session_id, None)
        cls._context.pop(session_id, None)
        cls._agent_chain.pop(session_id, None)
