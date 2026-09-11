from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone

from app.config import SensorConfig, get_settings
from app.geo import is_private_ip, lookup, near_sensor
from app.models import EventType, HiveEvent, Severity


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_ts(value: object) -> str:
    if value is None:
        return utc_now()
    text = str(value).strip()
    if not text:
        return utc_now()
    if text.endswith("+00:00"):
        return text.replace("+00:00", "Z")
    if "T" in text:
        return text if text.endswith("Z") else f"{text}Z" if "+" not in text[-6:] else text
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except ValueError:
        return utc_now()


def cap_raw(raw: str) -> str:
    limit = get_settings().raw_max_len
    if len(raw) <= limit:
        return raw
    return raw[:limit] + "…"


def event_id(*parts: object) -> str:
    material = "|".join("" if p is None else str(p) for p in parts)
    if material.strip("|"):
        return hashlib.sha256(material.encode("utf-8", errors="replace")).hexdigest()[:16]
    return uuid.uuid4().hex[:16]


def as_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def build_event(
    *,
    sensor: SensorConfig,
    timestamp: str,
    src_ip: str,
    dst_port: int,
    protocol: str,
    event_type: EventType,
    severity: Severity,
    raw: str,
    session_id: str = "",
    src_lat: float | None = None,
    src_lon: float | None = None,
    src_country: str | None = None,
    src_asn: str | None = None,
    extra_id: str = "",
) -> HiveEvent:
    geo_lat, geo_lon, geo_cc, geo_asn = lookup(src_ip)
    lat = src_lat if src_lat is not None else geo_lat
    lon = src_lon if src_lon is not None else geo_lon
    country = src_country or geo_cc
    asn = src_asn or geo_asn
    if lat is None or lon is None:
        lat, lon = near_sensor(src_ip, sensor.lat, sensor.lon)
        if not src_country:
            country = "LAN" if is_private_ip(src_ip) else country
    return HiveEvent(
        id=event_id(timestamp, sensor.id, src_ip, dst_port, event_type, extra_id, raw[:80]),
        timestamp=parse_ts(timestamp),
        sensor_id=sensor.id,
        sensor_lat=sensor.lat,
        sensor_lon=sensor.lon,
        src_ip=src_ip or "",
        src_lat=lat,
        src_lon=lon,
        src_country=country,
        src_asn=asn,
        dst_port=dst_port,
        protocol=(protocol or "").lower(),
        event_type=event_type,
        severity=severity,
        raw=cap_raw(raw),
        session_id=session_id or "",
    )


def raw_line(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=True, separators=(",", ":"))
