from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone

from app.config import SensorBook, SensorConfig
from app.ingest.normalize import build_event, utc_now
from app.ingest.pipeline import ingest_event
from app.models import EventType, Severity

# Documentation / TEST-NET addresses only. Coords are assigned locally (no GeoIP).
_SOURCES = [
    {"ip": "203.0.113.14", "lat": 35.6762, "lon": 139.6503, "country": "JP", "asn": "AS64496 DEMO-JP"},
    {"ip": "203.0.113.88", "lat": 37.5665, "lon": 126.9780, "country": "KR", "asn": "AS64497 DEMO-KR"},
    {"ip": "198.51.100.23", "lat": 52.5200, "lon": 13.4050, "country": "DE", "asn": "AS64498 DEMO-DE"},
    {"ip": "198.51.100.201", "lat": 51.5074, "lon": -0.1278, "country": "GB", "asn": "AS64499 DEMO-GB"},
    {"ip": "192.0.2.44", "lat": 40.7128, "lon": -74.0060, "country": "US", "asn": "AS64500 DEMO-US"},
    {"ip": "192.0.2.91", "lat": 1.3521, "lon": 103.8198, "country": "SG", "asn": "AS64501 DEMO-SG"},
    {"ip": "203.0.113.177", "lat": 55.7558, "lon": 37.6173, "country": "RU", "asn": "AS64502 DEMO-RU"},
    {"ip": "198.51.100.66", "lat": -23.5505, "lon": -46.6333, "country": "BR", "asn": "AS64503 DEMO-BR"},
    {"ip": "192.0.2.130", "lat": 28.6139, "lon": 77.2090, "country": "IN", "asn": "AS64504 DEMO-IN"},
    {"ip": "203.0.113.250", "lat": 31.2304, "lon": 121.4737, "country": "CN", "asn": "AS64505 DEMO-CN"},
]

_KINDS: list[tuple[EventType, Severity, str, int, str]] = [
    ("scan", "low", "ssh", 22, "session.connect"),
    ("scan", "low", "telnet", 23, "portscan"),
    ("login_attempt", "medium", "ssh", 22, "login.failed"),
    ("login_attempt", "medium", "ftp", 21, "ftp.login"),
    ("login_attempt", "medium", "http", 80, "http.post"),
    ("command", "medium", "ssh", 22, "command.input"),
    ("payload", "high", "ssh", 22, "file_download"),
    ("scan", "low", "http", 8080, "http.get"),
    ("login_attempt", "medium", "mysql", 3306, "mysql.login"),
    ("scan", "low", "rdp", 3389, "rdp.syn"),
]


def _raw(sensor: SensorConfig, src: dict, kind: tuple) -> str:
    event_type, _sev, proto, port, name = kind
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    return (
        '{"demo":true,"event":"%s","sensor":"%s","src_ip":"%s",'
        '"dst_port":%s,"protocol":"%s","timestamp":"%s","note":"synthetic"}'
        % (name, sensor.id, src["ip"], port, proto, stamp)
    )


async def run_demo(book: SensorBook, stop: asyncio.Event) -> None:
    sensors = book.sensors
    if not sensors:
        return
    while not stop.is_set():
        burst = random.randint(1, 3)
        for _ in range(burst):
            sensor = random.choice(sensors)
            src = random.choice(_SOURCES)
            kind = random.choice(_KINDS)
            event_type, severity, proto, port, name = kind
            event = build_event(
                sensor=sensor,
                timestamp=utc_now(),
                src_ip=src["ip"],
                dst_port=port,
                protocol=proto,
                event_type=event_type,
                severity=severity,
                raw=_raw(sensor, src, kind),
                session_id=f"demo-{random.randint(1000, 9999)}",
                src_lat=src["lat"],
                src_lon=src["lon"],
                src_country=src["country"],
                src_asn=src["asn"],
                extra_id=f"{name}-{random.random()}",
            )
            await ingest_event(event)
        try:
            await asyncio.wait_for(stop.wait(), timeout=random.uniform(1.2, 3.4))
        except asyncio.TimeoutError:
            continue
