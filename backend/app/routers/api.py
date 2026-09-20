from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import require_basic
from app.config import SensorBook, get_settings, host_timezone
from app.db import events_since_count, last_events_for_sensors, list_events, stats, timeline
from app.geo import geoip_available
from app.bait import BIND, apply_services, current_services, save_services
from app.models import (
    BaitApplyResult,
    BaitPayload,
    BaitService,
    BaitUpdate,
    EventFilters,
    EventList,
    HealthPayload,
    SensorStatus,
    StatsPayload,
    TimelineBucket,
)


def build_router(book: SensorBook) -> APIRouter:
    api = APIRouter(dependencies=[Depends(require_basic)])

    @api.get("/health", response_model=HealthPayload)
    async def health() -> HealthPayload:
        settings = get_settings()
        return HealthPayload(
            status="ok",
            demo=settings.demo,
            sensors=len(book.sensors),
            geoip=geoip_available(),
            timezone=host_timezone(),
        )

    @api.get("/sensors", response_model=list[SensorStatus])
    async def sensors() -> list[SensorStatus]:
        settings = get_settings()
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.sensor_online_minutes)
        last_by_id = await last_events_for_sensors([sensor.id for sensor in book.sensors])
        out: list[SensorStatus] = []
        for sensor in book.sensors:
            last = last_by_id.get(sensor.id)
            path = Path(sensor.log_path)
            mtime_ok = False
            if path.exists():
                mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
                mtime_ok = mtime >= cutoff
            last_ok = False
            if last:
                try:
                    last_ok = datetime.fromisoformat(last.replace("Z", "+00:00")) >= cutoff
                except ValueError:
                    last_ok = False
            out.append(
                SensorStatus(
                    id=sensor.id,
                    label=sensor.label,
                    type=sensor.type,
                    lat=sensor.lat,
                    lon=sensor.lon,
                    log_path=sensor.log_path,
                    online=settings.demo or mtime_ok or last_ok,
                    last_event=last,
                )
            )
        return out

    @api.get("/events", response_model=EventList)
    async def events(
        sensor_id: str | None = None,
        src_ip: str | None = None,
        protocol: str | None = None,
        severity: str | None = None,
        event_type: str | None = None,
        time_from: str | None = Query(default=None, alias="from"),
        time_to: str | None = Query(default=None, alias="to"),
        q: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> EventList:
        filters = EventFilters(
            sensor_id=sensor_id,
            src_ip=src_ip,
            protocol=protocol,
            severity=severity,
            event_type=event_type,
            time_from=time_from,
            time_to=time_to,
            q=q,
            limit=limit,
            offset=offset,
        )
        rows, total = await list_events(filters)
        return EventList(events=rows, total=total)

    @api.get("/stats", response_model=StatsPayload)
    async def stats_view(
        sensor_id: str | None = None,
        event_type: str | None = None,
        src_ip: str | None = None,
        time_from: str | None = Query(default=None, alias="from"),
        time_to: str | None = Query(default=None, alias="to"),
    ) -> StatsPayload:
        return await stats(
            time_from=time_from,
            time_to=time_to,
            sensor_id=sensor_id,
            event_type=event_type,
            src_ip=src_ip,
        )

    @api.get("/timeline", response_model=list[TimelineBucket])
    async def timeline_view(
        hours: int = 1,
        sensor_id: str | None = None,
    ) -> list[TimelineBucket]:
        return await timeline(hours=hours, sensor_id=sensor_id)

    @api.get("/summary")
    async def summary() -> dict:
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        return {
            "events_24h": await events_since_count(since),
            "sensors": len(book.sensors),
        }

    @api.get("/bait", response_model=BaitPayload)
    async def bait_get() -> BaitPayload:
        return BaitPayload(bind=BIND, services=[BaitService.model_validate(row) for row in current_services()])

    @api.put("/bait", response_model=BaitPayload)
    async def bait_put(body: BaitUpdate) -> BaitPayload:
        try:
            rows = save_services(body.services)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except (RuntimeError, OSError) as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return BaitPayload(bind=BIND, services=[BaitService.model_validate(row) for row in rows])

    @api.post("/bait/apply", response_model=BaitApplyResult)
    async def bait_apply() -> BaitApplyResult:
        result = apply_services()
        return BaitApplyResult(
            ok=result["ok"],
            error=result["error"],
            actions=result["actions"],
            services=[BaitService.model_validate(row) for row in result["services"]],
            bind=BIND,
        )

    return api
