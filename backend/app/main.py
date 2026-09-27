from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings, load_sensors
from app.db import backfill_missing_src_geo, init_db, purge_old
from app.ingest.demo import run_demo
from app.ingest.tailer import run_tailers
from app.routers.api import build_router
from app.routers.stream import router as stream_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("hive")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    book = load_sensors()
    app.state.book = book
    await init_db()
    filled = await backfill_missing_src_geo()
    if filled:
        log.info("backfilled src geo on %s events", filled)
    log.info("hive api up  demo=%s  sensors=%s", settings.demo, len(book.sensors))

    stop = asyncio.Event()
    tasks = [
        asyncio.create_task(run_tailers(book, stop), name="tailers"),
        asyncio.create_task(_retention_loop(stop), name="retention"),
    ]
    if settings.demo:
        tasks.append(asyncio.create_task(run_demo(book, stop), name="demo"))

    yield

    stop.set()
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


def create_app() -> FastAPI:
    settings = get_settings()
    book = load_sensors()
    app = FastAPI(title="IAS Hive", docs_url=None, redoc_url=None, lifespan=lifespan)
    origins = {
        settings.cors_origin,
        "http://127.0.0.1:8443",
        "http://localhost:8443",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://10.0.20.3:8443",
    }
    app.add_middleware(
        CORSMiddleware,
        allow_origins=sorted(origins),
        allow_credentials=True,
        allow_methods=["GET", "PUT", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(build_router(book), prefix="/api")
    app.include_router(stream_router)
    return app


async def _retention_loop(stop: asyncio.Event) -> None:
    days = get_settings().retention_days
    while not stop.is_set():
        try:
            deleted = await purge_old(days)
            if deleted:
                log.info("purged %s events older than %s days", deleted, days)
        except Exception:
            log.exception("retention purge failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=3600)
        except asyncio.TimeoutError:
            continue


app = create_app()
