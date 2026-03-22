"""Channel bridge setup — connects barrier notifications to channel adapters."""

from src.engine.ask_barrier import ask_barrier
from src.channels.notify import notify_channels


def setup_channel_bridge():
    """Register channel notification as a barrier callback.

    Call this at FastAPI startup after the barrier singleton is created.
    """
    ask_barrier.on_ask(notify_channels)
