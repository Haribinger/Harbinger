"""Continuous mission mode — scan, diff, scan new targets, repeat."""
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ContinuousMission:
    """A mission that runs indefinitely, monitoring for changes."""

    def __init__(self, mission_id: int, scan_interval: int = 3600):
        self.mission_id = mission_id
        self.scan_interval = scan_interval
        self._running = False
        self._task: asyncio.Task | None = None
        self.cycle_count = 0
        self.last_cycle: datetime | None = None

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("Continuous mission %d started (interval: %ds)", self.mission_id, self.scan_interval)

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Continuous mission %d stopped after %d cycles", self.mission_id, self.cycle_count)

    async def _loop(self):
        while self._running:
            try:
                self.cycle_count += 1
                self.last_cycle = datetime.utcnow()
                logger.info("Continuous mission %d — cycle %d", self.mission_id, self.cycle_count)

                # Each cycle creates fresh tasks from the template
                # The scheduler handles execution
                # TODO: Wire to actual scheduler when integrated

                await asyncio.sleep(self.scan_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Continuous mission %d cycle failed: %s", self.mission_id, e)
                await asyncio.sleep(60)  # Back off on error

    @property
    def status(self) -> dict:
        return {
            "mission_id": self.mission_id,
            "running": self._running,
            "cycle_count": self.cycle_count,
            "last_cycle": self.last_cycle.isoformat() if self.last_cycle else None,
            "scan_interval": self.scan_interval,
        }


# Track active continuous missions
_active: dict[int, ContinuousMission] = {}

def get_continuous(mission_id: int) -> ContinuousMission | None:
    return _active.get(mission_id)

async def start_continuous(mission_id: int, scan_interval: int = 3600) -> ContinuousMission:
    if mission_id in _active:
        return _active[mission_id]
    cm = ContinuousMission(mission_id, scan_interval)
    _active[mission_id] = cm
    await cm.start()
    return cm

async def stop_continuous(mission_id: int):
    cm = _active.pop(mission_id, None)
    if cm:
        await cm.stop()
