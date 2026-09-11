from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from app.config import SensorBook
from app.db import get_tail_state, save_tail_state
from app.ingest.pipeline import ingest_line

log = logging.getLogger("hive.tailer")


async def run_tailers(book: SensorBook, stop: asyncio.Event) -> None:
    tasks = [
        asyncio.create_task(_tail_sensor(sensor, stop), name=f"tail-{sensor.id}")
        for sensor in book.sensors
    ]
    try:
        await stop.wait()
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


async def _tail_sensor(sensor, stop: asyncio.Event) -> None:
    path = Path(sensor.log_path)
    log.info("tailing %s (%s) at %s", sensor.id, sensor.type, path)
    while not stop.is_set():
        try:
            await _follow(path, sensor, stop)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("tailer error on %s", sensor.id)
            await _sleep(stop, 2.0)


async def _follow(path: Path, sensor, stop: asyncio.Event) -> None:
    while not stop.is_set():
        if not path.exists():
            await _sleep(stop, 2.0)
            continue

        stat = path.stat()
        inode = int(getattr(stat, "st_ino", 0) or 0)
        saved = await get_tail_state(str(path))
        offset = 0
        if saved and saved[0] == inode and saved[1] <= stat.st_size:
            offset = saved[1]

        with path.open("r", encoding="utf-8", errors="replace") as handle:
            handle.seek(offset)
            while not stop.is_set():
                line = handle.readline()
                if line:
                    if line.endswith("\n") or line.endswith("\r"):
                        await ingest_line(line, sensor)
                        offset = handle.tell()
                        await save_tail_state(str(path), inode, offset)
                    else:
                        handle.seek(offset)
                        await _sleep(stop, 0.4)
                    continue

                offset = handle.tell()
                await save_tail_state(str(path), inode, offset)
                await _sleep(stop, 0.5)
                if not path.exists():
                    break
                now = path.stat()
                new_inode = int(getattr(now, "st_ino", 0) or 0)
                if new_inode != inode or now.st_size < offset:
                    break


async def _sleep(stop: asyncio.Event, seconds: float) -> None:
    try:
        await asyncio.wait_for(stop.wait(), timeout=seconds)
    except asyncio.TimeoutError:
        return
