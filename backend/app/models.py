from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high"]
EventType = Literal["scan", "login_attempt", "payload", "command"]


class HiveEvent(BaseModel):
    id: str
    timestamp: str
    sensor_id: str
    sensor_lat: float
    sensor_lon: float
    src_ip: str
    src_lat: float | None = None
    src_lon: float | None = None
    src_country: str = "UNK"
    src_asn: str = ""
    dst_port: int = 0
    protocol: str = ""
    event_type: EventType = "scan"
    severity: Severity = "low"
    raw: str = ""
    session_id: str = ""


class SensorStatus(BaseModel):
    id: str
    label: str
    type: str
    lat: float
    lon: float
    log_path: str
    online: bool
    last_event: str | None = None


class TimelineBucket(BaseModel):
    t: str
    count: int


class NamedCount(BaseModel):
    name: str
    count: int


class PortCount(BaseModel):
    port: int
    count: int


class StatsPayload(BaseModel):
    events_24h: int
    top_countries: list[NamedCount]
    top_ports: list[PortCount]
    over_time: list[TimelineBucket]
    protocols: list[NamedCount]


class EventList(BaseModel):
    events: list[HiveEvent]
    total: int


class HealthPayload(BaseModel):
    status: str = "ok"
    demo: bool = False
    sensors: int = 0
    geoip: bool = False


class EventFilters(BaseModel):
    sensor_id: str | None = None
    src_ip: str | None = None
    protocol: str | None = None
    severity: str | None = None
    time_from: str | None = Field(default=None, alias="from")
    time_to: str | None = Field(default=None, alias="to")
    q: str | None = None
    limit: int = 100
    offset: int = 0

    model_config = {"populate_by_name": True}
