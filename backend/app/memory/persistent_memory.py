"""
Persistent Memory — cross-session fact storage for the Agentic AI architecture.
Stores key decisions, defect history, and learned context across sessions.
"""
from __future__ import annotations

import json
import threading
import time
from pathlib import Path

_MEMORY_FILE = Path("./agent_memory.json")
_lock = threading.Lock()


class PersistentMemory:
    """
    JSON-file backed persistent store. Survives process restarts.
    Keeps last 500 facts; older entries are pruned on write.
    """

    _cache: dict | None = None

    @classmethod
    def _load(cls) -> dict:
        if cls._cache is not None:
            return cls._cache
        if _MEMORY_FILE.exists():
            try:
                cls._cache = json.loads(_MEMORY_FILE.read_text())
            except Exception:
                cls._cache = {}
        else:
            cls._cache = {}
        return cls._cache

    @classmethod
    def _save(cls, data: dict) -> None:
        try:
            _MEMORY_FILE.write_text(json.dumps(data, indent=2))
        except Exception:
            pass

    @classmethod
    def store_fact(cls, key: str, value: dict) -> None:
        with _lock:
            data = cls._load()
            data[key] = {**value, "stored_at": time.time()}
            # Prune to 500 most recent
            if len(data) > 500:
                sorted_keys = sorted(data, key=lambda k: data[k].get("stored_at", 0))
                for old_key in sorted_keys[:len(data) - 500]:
                    del data[old_key]
            cls._cache = data
            cls._save(data)

    @classmethod
    def recall(cls, prefix: str, limit: int = 5) -> list[dict]:
        """Return facts whose key starts with the given prefix, newest first."""
        data = cls._load()
        matches = [
            {"key": k, **v}
            for k, v in data.items()
            if k.startswith(prefix)
        ]
        matches.sort(key=lambda x: x.get("stored_at", 0), reverse=True)
        return matches[:limit]

    @classmethod
    def format_for_prompt(cls, query: str) -> str:
        """Return a compact memory block relevant to the query."""
        q_lower = query.lower()
        data = cls._load()
        relevant = []
        for key, val in data.items():
            if any(word in key.lower() for word in q_lower.split() if len(word) > 4):
                relevant.append(f"- [{key}]: {json.dumps(val)[:200]}")
        if not relevant:
            return ""
        return "Relevant memory from previous sessions:\n" + "\n".join(relevant[:3])
