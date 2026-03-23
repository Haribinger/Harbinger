"""Headless browser tool — navigate, screenshot, extract content via CDP."""
import logging
import httpx

logger = logging.getLogger(__name__)

SCRAPER_URL = "http://scraper:443"  # Docker service


class BrowserTool:
    """Interact with headless browser via scraper service."""

    def __init__(self, scraper_url: str | None = None):
        self.scraper_url = scraper_url or SCRAPER_URL

    async def execute(self, args: dict) -> str:
        url = args.get("url", "")
        action = args.get("action", "navigate")

        if not url:
            return "Error: url is required"

        try:
            # Scraper is internal Docker service — self-signed cert is expected
            async with httpx.AsyncClient(timeout=30.0, verify=False) as client:  # noqa: S501 internal service
                if action == "navigate":
                    resp = await client.post(f"{self.scraper_url}/navigate", json={"url": url})
                    return resp.text[:16384] if resp.status_code == 200 else f"Navigate failed: {resp.status_code}"
                elif action == "extract":
                    resp = await client.post(f"{self.scraper_url}/extract", json={"url": url})
                    return resp.text[:16384] if resp.status_code == 200 else f"Extract failed: {resp.status_code}"
                elif action == "screenshot":
                    resp = await client.post(f"{self.scraper_url}/screenshot", json={"url": url})
                    if resp.status_code == 200:
                        return f"Screenshot saved ({len(resp.content)} bytes)"
                    return f"Screenshot failed: {resp.status_code}"
                else:
                    return f"Unknown browser action: {action}"
        except Exception as e:
            logger.warning("Browser tool failed: %s", e)
            return f"Browser error: {e}. Is the scraper service running?"

    @staticmethod
    def schema() -> dict:
        return {
            "name": "browser",
            "description": "Open headless browser to navigate, extract content, or screenshot a URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to visit"},
                    "action": {"type": "string", "enum": ["navigate", "extract", "screenshot"], "default": "navigate"},
                },
                "required": ["url"],
            },
        }
