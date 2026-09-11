from __future__ import annotations

from app.bus import bus
from app.config import SensorConfig
from app.db import insert_event
from app.ingest.cowrie import parse_cowrie
from app.ingest.opencanary import parse_opencanary
from app.models import HiveEvent


def parse_line(line: str, sensor: SensorConfig) -> HiveEvent | None:
    if sensor.type == "cowrie":
        return parse_cowrie(line, sensor)
    if sensor.type == "opencanary":
        return parse_opencanary(line, sensor)
    return None


async def ingest_event(event: HiveEvent) -> None:
    await insert_event(event)
    bus.publish(event)


async def ingest_line(line: str, sensor: SensorConfig) -> HiveEvent | None:
    event = parse_line(line, sensor)
    if event is None:
        return None
    await ingest_event(event)
    return event
