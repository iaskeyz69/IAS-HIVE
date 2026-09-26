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


class TypeTimeBucket(BaseModel):
    t: str
    scan: int = 0
    login_attempt: int = 0
    command: int = 0
    payload: int = 0


class HitSnippet(BaseModel):
    timestamp: str = ""
    src_ip: str = ""
    text: str = ""


class NamedCount(BaseModel):
    name: str
    count: int


class PortCount(BaseModel):
    port: int
    count: int


class StatsPayload(BaseModel):
    events_24h: int
    unique_ips: int = 0
    by_type: list[NamedCount] = Field(default_factory=list)
    login_success: int = 0
    login_fail: int = 0
    lan_count: int = 0
    internet_count: int = 0
    top_countries: list[NamedCount]
    top_ports: list[PortCount]
    over_time: list[TimelineBucket]
    over_time_by_type: list[TypeTimeBucket] = Field(default_factory=list)
    protocols: list[NamedCount]
    top_ips: list[NamedCount] = Field(default_factory=list)
    recent_commands: list[HitSnippet] = Field(default_factory=list)
    recent_payloads: list[HitSnippet] = Field(default_factory=list)
    type_totals: list[NamedCount] = Field(default_factory=list)
    facet_ips: list[NamedCount] = Field(default_factory=list)
    facet_countries: list[NamedCount] = Field(default_factory=list)
    facet_ports: list[PortCount] = Field(default_factory=list)
    facet_sessions: list[str] = Field(default_factory=list)


class EventList(BaseModel):
    events: list[HiveEvent]
    total: int


class HealthPayload(BaseModel):
    status: str = "ok"
    demo: bool = False
    sensors: int = 0
    geoip: bool = False
    timezone: str = "Asia/Kuala_Lumpur"


class EventFilters(BaseModel):
    sensor_id: str | None = None
    src_ip: str | None = None
    protocol: str | None = None
    severity: str | None = None
    event_type: str | None = None
    src_country: str | None = None
    dst_port: int | None = None
    session_id: str | None = None
    time_from: str | None = Field(default=None, alias="from")
    time_to: str | None = Field(default=None, alias="to")
    q: str | None = None
    limit: int = 100
    offset: int = 0

    model_config = {"populate_by_name": True}


class BaitService(BaseModel):
    id: str
    label: str
    port: int
    sensor: str
    enabled: bool
    running: bool | None = None


class BaitPayload(BaseModel):
    bind: str = "10.0.20.3"
    services: list[BaitService]


class BaitUpdate(BaseModel):
    services: dict[str, bool]


class BaitApplyResult(BaseModel):
    ok: bool
    error: str | None = None
    actions: list[str] = Field(default_factory=list)
    services: list[BaitService] = Field(default_factory=list)
    bind: str = "10.0.20.3"
