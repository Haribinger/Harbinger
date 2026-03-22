"""Search engine tools — web search integrations for agent ReAct loops.

Each search engine is a tool that agents can call. Results are returned as
markdown text for the LLM to process.
"""
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class SearchToolBase:
    """Base class for search engine tools."""

    name: str = ""
    description: str = ""

    async def execute(self, args: dict) -> str:
        raise NotImplementedError

    def schema(self) -> dict:
        return SEARCH_TOOL_SCHEMAS.get(self.name, {})


class SploitusSearch(SearchToolBase):
    """Search Sploitus exploit database."""

    name = "sploitus"

    async def execute(self, args: dict) -> str:
        query = args.get("query", "")
        max_results = min(args.get("max_results", 10), 20)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    "https://sploitus.com/search",
                    params={"query": query, "type": "exploits", "sort": "default", "offset": 0},
                    headers={"Accept": "application/json"},
                )
                if resp.status_code != 200:
                    return f"Sploitus search failed (HTTP {resp.status_code})"

                data = resp.json()
                exploits = data.get("exploits", [])[:max_results]

                if not exploits:
                    return f"No exploits found for: {query}"

                lines = [f"## Sploitus Results for: {query}\n"]
                for i, exp in enumerate(exploits, 1):
                    lines.append(f"### {i}. {exp.get('title', 'Unknown')}")
                    if exp.get("href"):
                        lines.append(f"URL: {exp['href']}")
                    if exp.get("score"):
                        lines.append(f"Score: {exp['score']}")
                    if exp.get("published"):
                        lines.append(f"Published: {exp['published']}")
                    lines.append("")

                return "\n".join(lines)

        except Exception as e:
            logger.warning("Sploitus search failed: %s", e)
            return f"Sploitus search error: {e}"


class DuckDuckGoSearch(SearchToolBase):
    """Search DuckDuckGo (instant answers API)."""

    name = "duckduckgo"

    async def execute(self, args: dict) -> str:
        query = args.get("query", "")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.duckduckgo.com/",
                    params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
                )
                if resp.status_code != 200:
                    return f"DuckDuckGo search failed (HTTP {resp.status_code})"

                data = resp.json()
                lines = [f"## DuckDuckGo Results for: {query}\n"]

                if data.get("Abstract"):
                    lines.append(f"**Summary:** {data['Abstract']}")
                    if data.get("AbstractURL"):
                        lines.append(f"Source: {data['AbstractURL']}")
                    lines.append("")

                for topic in data.get("RelatedTopics", [])[:10]:
                    if isinstance(topic, dict) and topic.get("Text"):
                        lines.append(f"- {topic['Text']}")
                        if topic.get("FirstURL"):
                            lines.append(f"  URL: {topic['FirstURL']}")

                if len(lines) <= 2:
                    return f"No results found for: {query}"

                return "\n".join(lines)

        except Exception as e:
            logger.warning("DuckDuckGo search failed: %s", e)
            return f"DuckDuckGo search error: {e}"


class GoogleSearch(SearchToolBase):
    """Google Custom Search API."""

    name = "google"

    async def execute(self, args: dict) -> str:
        import os
        api_key = os.getenv("GOOGLE_API_KEY")
        cx = os.getenv("GOOGLE_CX_KEY")
        if not api_key or not cx:
            return "Google search not configured (missing GOOGLE_API_KEY or GOOGLE_CX_KEY)"

        query = args.get("query", "")
        max_results = min(args.get("max_results", 10), 10)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params={"key": api_key, "cx": cx, "q": query, "num": max_results},
                )
                data = resp.json()
                items = data.get("items", [])

                if not items:
                    return f"No Google results for: {query}"

                lines = [f"## Google Results for: {query}\n"]
                for i, item in enumerate(items, 1):
                    lines.append(f"### {i}. {item.get('title', '')}")
                    lines.append(f"URL: {item.get('link', '')}")
                    lines.append(f"{item.get('snippet', '')}")
                    lines.append("")

                return "\n".join(lines)

        except Exception as e:
            return f"Google search error: {e}"


class TavilySearch(SearchToolBase):
    """Tavily AI-powered search."""

    name = "tavily"

    async def execute(self, args: dict) -> str:
        import os
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            return "Tavily search not configured (missing TAVILY_API_KEY)"

        query = args.get("query", "")
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.tavily.com/search",
                    json={"api_key": api_key, "query": query, "max_results": 5},
                )
                data = resp.json()

                lines = [f"## Tavily Results for: {query}\n"]
                if data.get("answer"):
                    lines.append(f"**AI Answer:** {data['answer']}\n")

                for r in data.get("results", []):
                    lines.append(f"- **{r.get('title', '')}**")
                    lines.append(f"  {r.get('content', '')[:300]}")
                    lines.append(f"  URL: {r.get('url', '')}")
                    lines.append("")

                return "\n".join(lines)

        except Exception as e:
            return f"Tavily search error: {e}"


class PerplexitySearch(SearchToolBase):
    """Perplexity AI search — full research report."""

    name = "perplexity"

    async def execute(self, args: dict) -> str:
        import os
        api_key = os.getenv("PERPLEXITY_API_KEY")
        if not api_key:
            return "Perplexity search not configured (missing PERPLEXITY_API_KEY)"

        query = args.get("query", "")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.perplexity.ai/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": os.getenv("PERPLEXITY_MODEL", "sonar"),
                        "messages": [{"role": "user", "content": query}],
                    },
                )
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return content or f"No Perplexity results for: {query}"

        except Exception as e:
            return f"Perplexity search error: {e}"


# Schema registry
SEARCH_TOOL_SCHEMAS: dict[str, dict] = {
    "sploitus": {
        "name": "sploitus",
        "description": "Search Sploitus exploit database for public exploits, PoC code, and offensive security tools.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (CVE, software name, technique)"},
                "max_results": {"type": "integer", "default": 10, "description": "Max results (up to 20)"},
            },
            "required": ["query"],
        },
    },
    "duckduckgo": {
        "name": "duckduckgo",
        "description": "Search DuckDuckGo for general information, anonymously.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    "google": {
        "name": "google",
        "description": "Google Custom Search — fast, detailed web results.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "max_results": {"type": "integer", "default": 10},
            },
            "required": ["query"],
        },
    },
    "tavily": {
        "name": "tavily",
        "description": "Tavily AI search — detailed research with AI-generated answer.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    "perplexity": {
        "name": "perplexity",
        "description": "Perplexity AI — full research report augmented by LLM.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
}

# Tool instances
_TOOLS: dict[str, SearchToolBase] = {
    "sploitus": SploitusSearch(),
    "duckduckgo": DuckDuckGoSearch(),
    "google": GoogleSearch(),
    "tavily": TavilySearch(),
    "perplexity": PerplexitySearch(),
}


def get_search_tool(name: str) -> SearchToolBase | None:
    return _TOOLS.get(name)


def get_all_search_schemas() -> dict[str, dict]:
    return dict(SEARCH_TOOL_SCHEMAS)
