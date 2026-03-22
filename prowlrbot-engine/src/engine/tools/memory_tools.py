"""
Memory tools — agent-callable tools for semantic memory search and storage.

Seven tools matching the v2.0 spec:
  - search_in_memory   — general semantic search across all collections
  - search_guide       — search stored guides/techniques
  - store_guide        — store a new guide (anonymized)
  - search_answer      — search stored Q&A pairs
  - store_answer       — store a Q&A pair
  - search_code        — search stored code samples
  - store_code         — store a code sample
"""

import logging

logger = logging.getLogger(__name__)


# ── Tool schemas ─────────────────────────────────────────────────────────────

MEMORY_SCHEMAS: dict[str, dict] = {
    "search_in_memory": {
        "name": "search_in_memory",
        "description": (
            "Search the shared semantic memory for relevant past findings, "
            "guides, code, and answers. Returns the most similar entries."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What to search for",
                },
                "collection": {
                    "type": "string",
                    "description": "Optional filter: answer, guide, code, or general",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 5)",
                },
            },
            "required": ["query"],
        },
    },
    "search_guide": {
        "name": "search_guide",
        "description": "Search stored guides, techniques, and runbooks.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What technique or guide to find",
                },
            },
            "required": ["query"],
        },
    },
    "store_guide": {
        "name": "store_guide",
        "description": (
            "Store a new guide or technique for future reference. "
            "Content is anonymized (no target-specific data)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "The guide content to store",
                },
                "title": {
                    "type": "string",
                    "description": "Brief title for the guide",
                },
            },
            "required": ["content"],
        },
    },
    "search_answer": {
        "name": "search_answer",
        "description": "Search stored Q&A pairs from past agent interactions.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The question to search for",
                },
            },
            "required": ["query"],
        },
    },
    "store_answer": {
        "name": "store_answer",
        "description": "Store a Q&A pair for future reference.",
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The question",
                },
                "answer": {
                    "type": "string",
                    "description": "The answer",
                },
            },
            "required": ["question", "answer"],
        },
    },
    "search_code": {
        "name": "search_code",
        "description": "Search stored code samples, exploits, and scripts.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What code to find",
                },
            },
            "required": ["query"],
        },
    },
    "store_code": {
        "name": "store_code",
        "description": "Store a code sample or script for future reference.",
        "parameters": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "The code to store",
                },
                "language": {
                    "type": "string",
                    "description": "Programming language",
                },
                "description": {
                    "type": "string",
                    "description": "What this code does",
                },
            },
            "required": ["content"],
        },
    },
}

MEMORY_TOOL_NAMES = set(MEMORY_SCHEMAS.keys())


class MemoryTool:
    """Agent-callable tool for semantic memory operations."""

    def __init__(self, tool_name: str, agent_id: str = "", mission_id: str = ""):
        if tool_name not in MEMORY_SCHEMAS:
            raise ValueError(f"Unknown memory tool: {tool_name}")
        self.tool_name = tool_name
        self._agent_id = agent_id
        self._mission_id = mission_id

    def schema(self) -> dict:
        return MEMORY_SCHEMAS[self.tool_name]

    async def execute(self, args: dict) -> str:
        """Execute the memory operation."""
        try:
            from src.memory.store import search, store
        except ImportError:
            return "Memory store not available — missing dependencies."

        try:
            if self.tool_name == "search_in_memory":
                return await self._search(
                    args.get("query", ""),
                    collection=args.get("collection"),
                    limit=args.get("limit", 5),
                )
            elif self.tool_name == "search_guide":
                return await self._search(args.get("query", ""), collection="guide")
            elif self.tool_name == "store_guide":
                return await self._store(
                    args.get("content", ""),
                    collection="guide",
                    metadata={"title": args.get("title", "")},
                )
            elif self.tool_name == "search_answer":
                return await self._search(args.get("query", ""), collection="answer")
            elif self.tool_name == "store_answer":
                q = args.get("question", "")
                a = args.get("answer", "")
                content = f"Q: {q}\nA: {a}"
                return await self._store(
                    content, collection="answer",
                    metadata={"question": q},
                )
            elif self.tool_name == "search_code":
                return await self._search(args.get("query", ""), collection="code")
            elif self.tool_name == "store_code":
                content = args.get("content", "")
                lang = args.get("language", "")
                desc = args.get("description", "")
                if lang:
                    content = f"```{lang}\n{content}\n```"
                if desc:
                    content = f"{desc}\n\n{content}"
                return await self._store(
                    content, collection="code",
                    metadata={"language": lang, "description": desc},
                )
            return f"Unknown memory tool: {self.tool_name}"
        except Exception as exc:
            logger.error("memory tool %s failed: %s", self.tool_name, exc)
            return f"Memory operation failed: {exc}"

    async def _search(
        self, query: str, collection: str | None = None, limit: int = 5
    ) -> str:
        from src.memory.store import search

        if not query:
            return "No query provided."

        results = await search(
            query=query,
            collection=collection,
            agent_id=None,
            mission_id=None,
            limit=limit,
            threshold=0.2,
        )

        if not results:
            return "No relevant memories found."

        lines = [f"Found {len(results)} result(s):\n"]
        for i, r in enumerate(results, 1):
            score_pct = int(r["score"] * 100)
            lines.append(f"--- Result {i} (relevance: {score_pct}%) ---")
            lines.append(r["content"][:2000])
            if r.get("metadata"):
                meta_str = ", ".join(f"{k}={v}" for k, v in r["metadata"].items() if v)
                if meta_str:
                    lines.append(f"[{meta_str}]")
            lines.append("")

        return "\n".join(lines)

    async def _store(
        self, content: str, collection: str, metadata: dict | None = None
    ) -> str:
        from src.memory.store import store

        if not content:
            return "No content to store."

        row_id = await store(
            content=content,
            collection=collection,
            agent_id=self._agent_id,
            mission_id=self._mission_id,
            metadata=metadata,
        )
        return f"Stored in {collection} memory (id={row_id})"
