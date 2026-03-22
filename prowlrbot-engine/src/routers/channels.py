"""Channel webhook receiver — Go backend forwards inbound messages here."""

from fastapi import APIRouter
from pydantic import BaseModel

from src.channels.inbound import route_inbound_message

router = APIRouter(prefix="/api/v2/channels", tags=["channels"])


class InboundMessage(BaseModel):
    channel: str           # discord, telegram, slack
    sender_id: str
    text: str
    session_id: str = ""
    metadata: dict = {}


@router.post("/inbound")
async def receive_inbound_message(msg: InboundMessage):
    """Receive a channel message forwarded from Go backend.

    If the message matches a pending barrier, resolves it.
    """
    result = await route_inbound_message(
        channel_name=msg.channel,
        sender_id=msg.sender_id,
        text=msg.text,
        metadata=msg.metadata,
    )
    return {"ok": True, **result}
