"""Channel notification bridge — sends barrier questions to Discord/Telegram/Slack
via the Go backend's channel API, and routes inbound responses back to barriers."""

import logging

import httpx

from src.config import settings

logger = logging.getLogger(__name__)

# Go backend URL for channel operations
GO_BACKEND_URL = getattr(settings, "GO_BACKEND_URL", "http://localhost:8080")


async def notify_channels(barrier) -> None:
    """Send a barrier question to all configured channels.

    Called as an on_ask callback from AskUserBarrier.
    Formats the question for each platform and sends via Go channel API.
    """
    message = format_barrier_message(barrier)

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Get configured channels from Go backend
        try:
            resp = await client.get(
                f"{GO_BACKEND_URL}/api/channels",
                headers=_auth_headers(),
            )
            if resp.status_code != 200:
                logger.warning("Failed to list channels: %s", resp.status_code)
                return
            channels = resp.json()
        except httpx.HTTPError as e:
            logger.warning("Cannot reach Go backend for channels: %s", e)
            return

        # Send to each configured and connected channel
        for ch in channels if isinstance(channels, list) else channels.get("items", []):
            channel_name = ch.get("name", ch.get("channel", ""))
            if ch.get("status") != "connected":
                continue

            try:
                await client.post(
                    f"{GO_BACKEND_URL}/api/channels/{channel_name}/send",
                    json={
                        "text": message["text"],
                        "payload": message["payload"],
                        "barrier_subtask_id": barrier.subtask_id,
                    },
                    headers=_auth_headers(),
                )
                logger.info("Barrier notification sent to %s", channel_name)
            except httpx.HTTPError as e:
                logger.warning("Failed to send to %s: %s", channel_name, e)


def format_barrier_message(barrier) -> dict:
    """Format a barrier question for channel delivery.

    Returns a dict with 'text' (universal plaintext) and 'payload'
    (structured data for rich formatting).
    """
    # Plain text version
    lines = [
        "🔔 **OPERATOR INPUT NEEDED**",
        "",
        f"**Agent:** {barrier.agent_codename}",
        f"**Mission:** {barrier.mission_id}",
        f"**Subtask:** {barrier.subtask_id}",
        "",
        f"**Question:** {barrier.question}",
    ]

    if barrier.options:
        lines.append("")
        lines.append("**Options:**")
        for i, opt in enumerate(barrier.options, 1):
            lines.append(f"  {i}. {opt}")

    lines.extend([
        "",
        f"Reply with: `/respond {barrier.subtask_id} <your answer>`",
    ])

    text = "\n".join(lines)

    # Structured payload for rich formatting
    payload = {
        "type": "barrier_ask",
        "subtask_id": barrier.subtask_id,
        "mission_id": barrier.mission_id,
        "agent_codename": barrier.agent_codename,
        "question": barrier.question,
        "options": barrier.options,
        # Platform-specific formatting hints
        "discord": format_discord_embed(barrier),
        "telegram": format_telegram_message(barrier),
        "slack": format_slack_blocks(barrier),
    }

    return {"text": text, "payload": payload}


def format_discord_embed(barrier) -> dict:
    """Discord embed format."""
    embed = {
        "title": "🔔 Operator Input Needed",
        "color": 15782720,  # #F0C040 (Harbinger gold)
        "fields": [
            {"name": "Agent", "value": barrier.agent_codename, "inline": True},
            {"name": "Mission", "value": barrier.mission_id or "—", "inline": True},
            {"name": "Question", "value": barrier.question},
        ],
        "footer": {"text": f"Subtask: {barrier.subtask_id}"},
    }
    if barrier.options:
        options_text = "\n".join(
            f"**{i}.** {opt}" for i, opt in enumerate(barrier.options, 1)
        )
        embed["fields"].append({"name": "Options", "value": options_text})
    return {"embeds": [embed]}


def format_telegram_message(barrier) -> dict:
    """Telegram inline keyboard format."""
    text = (
        f"🔔 *OPERATOR INPUT NEEDED*\n\n"
        f"*Agent:* {barrier.agent_codename}\n"
        f"*Question:* {barrier.question}"
    )

    result: dict = {"text": text, "parse_mode": "Markdown"}

    if barrier.options:
        # Inline keyboard with option buttons
        result["reply_markup"] = {
            "inline_keyboard": [
                [{"text": opt, "callback_data": f"barrier:{barrier.subtask_id}:{opt}"}]
                for opt in barrier.options
            ]
        }

    return result


def format_slack_blocks(barrier) -> dict:
    """Slack Block Kit format."""
    blocks: list[dict] = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": "🔔 Operator Input Needed"},
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Agent:* {barrier.agent_codename}"},
                {"type": "mrkdwn", "text": f"*Mission:* {barrier.mission_id or '—'}"},
            ],
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Question:* {barrier.question}"},
        },
    ]

    if barrier.options:
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": opt},
                    "action_id": f"barrier_respond_{barrier.subtask_id}_{i}",
                    "value": opt,
                }
                for i, opt in enumerate(barrier.options)
            ],
        })

    return {"blocks": blocks}


def _auth_headers() -> dict:
    """Get auth headers for Go backend requests.

    Signs a short-lived JWT with the shared secret so the Go backend
    can verify the caller is the Python engine (not just anyone with the secret).
    """
    secret = getattr(settings, "jwt_secret", "") or getattr(settings, "JWT_SECRET", "")
    if not secret:
        return {}
    try:
        import jwt
        import time
        payload = {
            "sub": "prowlrbot-engine",
            "iss": "harbinger",
            "iat": int(time.time()),
            "exp": int(time.time()) + 300,  # 5 min expiry
        }
        token = jwt.encode(payload, secret, algorithm="HS256")
        return {"Authorization": f"Bearer {token}"}
    except ImportError:
        logger.warning("PyJWT not installed — falling back to no auth")
        return {}
