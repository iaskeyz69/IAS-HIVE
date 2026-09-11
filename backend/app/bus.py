from __future__ import annotations

import asyncio

from app.models import HiveEvent


class EventBus:
    def __init__(self) -> None:
        self._subs: set[asyncio.Queue[HiveEvent]] = set()

    def subscribe(self) -> asyncio.Queue[HiveEvent]:
        queue: asyncio.Queue[HiveEvent] = asyncio.Queue(maxsize=256)
        self._subs.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[HiveEvent]) -> None:
        self._subs.discard(queue)

    def publish(self, event: HiveEvent) -> None:
        for queue in list(self._subs):
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                continue


bus = EventBus()
