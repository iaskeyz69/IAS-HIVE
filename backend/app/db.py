from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import aiosqlite

from app.config import get_settings
from app.models import (
    EventFilters,
    HiveEvent,
    NamedCount,
    PortCount,
    StatsPayload,
    TimelineBucket,
)

_CREATE = """
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    sensor_id TEXT NOT NULL,
    sensor_lat REAL,
    sensor_lon REAL,
    src_ip TEXT,
    src_lat REAL,
    src_lon REAL,
    src_country TEXT,
    src_asn TEXT,
    dst_port INTEGER,
    protocol TEXT,
    event_type TEXT,
    severity TEXT,
    raw TEXT,
    session_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_sensor ON events(sensor_id);
CREATE INDEX IF NOT EXISTS idx_events_src ON events(src_ip);
CREATE INDEX IF NOT EXISTS idx_events_proto ON events(protocol);

CREATE TABLE IF NOT EXISTS tail_state (
    log_path TEXT PRIMARY KEY,
    inode INTEGER,
    offset INTEGER
);
"""


def _db_path() -> Path:
    path = Path(get_settings().db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


async def connect() -> aiosqlite.Connection:
    conn = await aiosqlite.connect(_db_path())
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA synchronous=NORMAL")
    return conn


async def init_db() -> None:
    conn = await connect()
    try:
        await conn.executescript(_CREATE)
        await conn.commit()
    finally:
        await conn.close()


def _row_to_event(row: aiosqlite.Row) -> HiveEvent:
    return HiveEvent(
        id=row["id"],
        timestamp=row["timestamp"],
        sensor_id=row["sensor_id"],
        sensor_lat=row["sensor_lat"] or 0.0,
        sensor_lon=row["sensor_lon"] or 0.0,
        src_ip=row["src_ip"] or "",
        src_lat=row["src_lat"],
        src_lon=row["src_lon"],
        src_country=row["src_country"] or "UNK",
        src_asn=row["src_asn"] or "",
        dst_port=row["dst_port"] or 0,
        protocol=row["protocol"] or "",
        event_type=row["event_type"] or "scan",
        severity=row["severity"] or "low",
        raw=row["raw"] or "",
        session_id=row["session_id"] or "",
    )


async def insert_event(event: HiveEvent) -> None:
    conn = await connect()
    try:
        await conn.execute(
            """
            INSERT OR IGNORE INTO events (
                id, timestamp, sensor_id, sensor_lat, sensor_lon,
                src_ip, src_lat, src_lon, src_country, src_asn,
                dst_port, protocol, event_type, severity, raw, session_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event.id,
                event.timestamp,
                event.sensor_id,
                event.sensor_lat,
                event.sensor_lon,
                event.src_ip,
                event.src_lat,
                event.src_lon,
                event.src_country,
                event.src_asn,
                event.dst_port,
                event.protocol,
                event.event_type,
                event.severity,
                event.raw,
                event.session_id,
            ),
        )
        await conn.commit()
    finally:
        await conn.close()


def _filter_sql(filters: EventFilters) -> tuple[str, list]:
    clauses: list[str] = []
    params: list = []
    if filters.sensor_id:
        clauses.append("sensor_id = ?")
        params.append(filters.sensor_id)
    if filters.src_ip:
        clauses.append("src_ip = ?")
        params.append(filters.src_ip)
    if filters.protocol:
        clauses.append("protocol = ?")
        params.append(filters.protocol)
    if filters.severity:
        clauses.append("severity = ?")
        params.append(filters.severity)
    if filters.time_from:
        clauses.append("timestamp >= ?")
        params.append(filters.time_from)
    if filters.time_to:
        clauses.append("timestamp <= ?")
        params.append(filters.time_to)
    if filters.q:
        clauses.append("(src_ip LIKE ? OR raw LIKE ? OR session_id LIKE ?)")
        like = f"%{filters.q}%"
        params.extend([like, like, like])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


async def list_events(filters: EventFilters) -> tuple[list[HiveEvent], int]:
    where, params = _filter_sql(filters)
    limit = max(1, min(filters.limit, 500))
    offset = max(0, filters.offset)
    conn = await connect()
    try:
        cur = await conn.execute(
            f"SELECT COUNT(*) AS n FROM events {where}", params
        )
        total = int((await cur.fetchone())["n"])
        cur = await conn.execute(
            f"""
            SELECT * FROM events {where}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        )
        rows = await cur.fetchall()
        return [_row_to_event(row) for row in rows], total
    finally:
        await conn.close()


async def last_event_for_sensor(sensor_id: str) -> str | None:
    conn = await connect()
    try:
        cur = await conn.execute(
            "SELECT timestamp FROM events WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 1",
            (sensor_id,),
        )
        row = await cur.fetchone()
        return row["timestamp"] if row else None
    finally:
        await conn.close()


async def events_since_count(since_iso: str, sensor_id: str | None = None) -> int:
    conn = await connect()
    try:
        if sensor_id:
            cur = await conn.execute(
                "SELECT COUNT(*) AS n FROM events WHERE timestamp >= ? AND sensor_id = ?",
                (since_iso, sensor_id),
            )
        else:
            cur = await conn.execute(
                "SELECT COUNT(*) AS n FROM events WHERE timestamp >= ?",
                (since_iso,),
            )
        return int((await cur.fetchone())["n"])
    finally:
        await conn.close()


async def timeline(hours: int = 1, sensor_id: str | None = None) -> list[TimelineBucket]:
    hours = max(1, min(hours, 168))
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours)
    start_iso = start.replace(second=0, microsecond=0).isoformat()
    extra = "AND sensor_id = ?" if sensor_id else ""
    params: list = [start_iso]
    if sensor_id:
        params.append(sensor_id)
    conn = await connect()
    try:
        cur = await conn.execute(
            f"""
            SELECT substr(timestamp, 1, 16) AS bucket, COUNT(*) AS n
            FROM events
            WHERE timestamp >= ? {extra}
            GROUP BY bucket
            ORDER BY bucket
            """,
            params,
        )
        rows = await cur.fetchall()
        counts = {row["bucket"]: int(row["n"]) for row in rows}
    finally:
        await conn.close()

    buckets: list[TimelineBucket] = []
    cursor = start.replace(second=0, microsecond=0)
    end = now.replace(second=0, microsecond=0)
    while cursor <= end:
        key = cursor.strftime("%Y-%m-%dT%H:%M")
        buckets.append(TimelineBucket(t=cursor.isoformat().replace("+00:00", "Z"), count=counts.get(key, 0)))
        cursor += timedelta(minutes=1)
    return buckets


async def stats(
    time_from: str | None = None,
    time_to: str | None = None,
    sensor_id: str | None = None,
) -> StatsPayload:
    filters = EventFilters(
        sensor_id=sensor_id,
        time_from=time_from,
        time_to=time_to,
        limit=1,
    )
    where, params = _filter_sql(filters)
    since_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    conn = await connect()
    try:
        cur = await conn.execute(
            "SELECT COUNT(*) AS n FROM events WHERE timestamp >= ?", (since_24h,)
        )
        events_24h = int((await cur.fetchone())["n"])

        async def grouped(column: str, limit: int = 8) -> list[tuple[str, int]]:
            cur_g = await conn.execute(
                f"""
                SELECT {column} AS name, COUNT(*) AS n
                FROM events {where}
                GROUP BY {column}
                ORDER BY n DESC
                LIMIT ?
                """,
                [*params, limit],
            )
            return [(row["name"] or "UNK", int(row["n"])) for row in await cur_g.fetchall()]

        countries = await grouped("src_country")
        protocols = await grouped("protocol")
        cur = await conn.execute(
            f"""
            SELECT dst_port AS port, COUNT(*) AS n
            FROM events {where}
            GROUP BY dst_port
            ORDER BY n DESC
            LIMIT 8
            """,
            params,
        )
        ports = [(int(row["port"] or 0), int(row["n"])) for row in await cur.fetchall()]

        cur = await conn.execute(
            f"""
            SELECT substr(timestamp, 1, 13) AS bucket, COUNT(*) AS n
            FROM events {where}
            GROUP BY bucket
            ORDER BY bucket
            """,
            params,
        )
        over = [
            TimelineBucket(t=f"{row['bucket']}:00:00Z", count=int(row["n"]))
            for row in await cur.fetchall()
        ]
    finally:
        await conn.close()

    return StatsPayload(
        events_24h=events_24h,
        top_countries=[NamedCount(name=n, count=c) for n, c in countries],
        top_ports=[PortCount(port=p, count=c) for p, c in ports],
        over_time=over,
        protocols=[NamedCount(name=n, count=c) for n, c in protocols],
    )


async def purge_old(days: int) -> int:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    conn = await connect()
    try:
        cur = await conn.execute("DELETE FROM events WHERE timestamp < ?", (cutoff,))
        await conn.commit()
        return cur.rowcount or 0
    finally:
        await conn.close()


async def get_tail_state(log_path: str) -> tuple[int, int] | None:
    conn = await connect()
    try:
        cur = await conn.execute(
            "SELECT inode, offset FROM tail_state WHERE log_path = ?", (log_path,)
        )
        row = await cur.fetchone()
        if not row:
            return None
        return int(row["inode"]), int(row["offset"])
    finally:
        await conn.close()


async def save_tail_state(log_path: str, inode: int, offset: int) -> None:
    conn = await connect()
    try:
        await conn.execute(
            """
            INSERT INTO tail_state (log_path, inode, offset)
            VALUES (?, ?, ?)
            ON CONFLICT(log_path) DO UPDATE SET inode = excluded.inode, offset = excluded.offset
            """,
            (log_path, inode, offset),
        )
        await conn.commit()
    finally:
        await conn.close()


def dump_event_json(event: HiveEvent) -> str:
    return json.dumps(event.model_dump(), separators=(",", ":"))
