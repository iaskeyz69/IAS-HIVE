from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import aiosqlite

from app.config import get_settings
from app.geo import is_private_ip, near_sensor
from app.models import (
    EventFilters,
    HitSnippet,
    HiveEvent,
    NamedCount,
    PortCount,
    StatsPayload,
    TimelineBucket,
    TypeTimeBucket,
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
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

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




async def backfill_missing_src_geo() -> int:
    conn = await connect()
    try:
        cur = await conn.execute(
            """
            SELECT id, src_ip, sensor_lat, sensor_lon, src_country
            FROM events
            WHERE src_lat IS NULL OR src_lon IS NULL
            """
        )
        rows = await cur.fetchall()
        count = 0
        for row in rows:
            lat, lon = near_sensor(
                row["src_ip"] or "",
                float(row["sensor_lat"] or 0.0),
                float(row["sensor_lon"] or 0.0),
            )
            country = row["src_country"] or "UNK"
            if is_private_ip(row["src_ip"] or "") and country in ("", "UNK"):
                country = "LAN"
            await conn.execute(
                "UPDATE events SET src_lat = ?, src_lon = ?, src_country = ? WHERE id = ?",
                (lat, lon, country, row["id"]),
            )
            count += 1
        await conn.commit()
        return count
    finally:
        await conn.close()

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
    if filters.event_type:
        clauses.append("event_type = ?")
        params.append(filters.event_type)
    if filters.src_country:
        clauses.append("src_country = ?")
        params.append(filters.src_country)
    if filters.dst_port is not None:
        clauses.append("dst_port = ?")
        params.append(filters.dst_port)
    if filters.session_id:
        clauses.append("session_id = ?")
        params.append(filters.session_id)
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
    found = await last_events_for_sensors([sensor_id])
    return found.get(sensor_id)


async def last_events_for_sensors(sensor_ids: list[str]) -> dict[str, str | None]:
    result: dict[str, str | None] = {sid: None for sid in sensor_ids}
    if not sensor_ids:
        return result
    placeholders = ",".join("?" for _ in sensor_ids)
    conn = await connect()
    try:
        cur = await conn.execute(
            f"SELECT sensor_id, MAX(timestamp) AS ts FROM events WHERE sensor_id IN ({placeholders}) GROUP BY sensor_id",
            sensor_ids,
        )
        for row in await cur.fetchall():
            result[row["sensor_id"]] = row["ts"]
        return result
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



def _and_where(where: str, extra: str) -> str:
    return f"{where} AND {extra}" if where else f"WHERE {extra}"


def _snippet_from_raw(raw: str, kind: str) -> str:
    try:
        obj = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return ""
    if not isinstance(obj, dict):
        return ""
    if kind == "command":
        return str(obj.get("input") or "")[:160]
    dest = obj.get("destfile") or obj.get("outfile") or ""
    sha = obj.get("shasum") or ""
    if dest:
        return str(dest)[:160]
    if sha:
        return f"sha {str(sha)[:16]}"
    return "file transfer"


async def stats(
    time_from: str | None = None,
    time_to: str | None = None,
    sensor_id: str | None = None,
    event_type: str | None = None,
    src_ip: str | None = None,
    src_country: str | None = None,
    dst_port: int | None = None,
    session_id: str | None = None,
) -> StatsPayload:
    filters = EventFilters(
        sensor_id=sensor_id,
        event_type=event_type,
        src_ip=src_ip,
        src_country=src_country,
        dst_port=dst_port,
        session_id=session_id,
        time_from=time_from,
        time_to=time_to,
        limit=1,
    )
    where, params = _filter_sql(filters)
    census_filters = filters.model_copy(update={"event_type": None})
    census_where, census_params = _filter_sql(census_filters)
    since_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    conn = await connect()
    try:
        cur = await conn.execute(
            "SELECT COUNT(*) AS n FROM events WHERE timestamp >= ?", (since_24h,)
        )
        events_24h = int((await cur.fetchone())["n"])

        async def grouped(
            column: str,
            limit: int = 8,
            extra: str = "",
            *,
            clause: str | None = None,
            bind: list | None = None,
        ) -> list[tuple[str, int]]:
            use_where = where if clause is None else clause
            use_params = params if bind is None else bind
            sql_where = _and_where(use_where, extra) if extra else use_where
            cur_g = await conn.execute(
                f"""
                SELECT {column} AS name, COUNT(*) AS n
                FROM events {sql_where}
                GROUP BY {column}
                ORDER BY n DESC
                LIMIT ?
                """,
                [*use_params, limit],
            )
            return [(row["name"] or "UNK", int(row["n"])) for row in await cur_g.fetchall()]

        async def scalar(sql: str, extra_params: list | None = None) -> int:
            cur_s = await conn.execute(sql, extra_params if extra_params is not None else params)
            row = await cur_s.fetchone()
            return int(row["n"] or 0) if row else 0

        unique_ips = await scalar(f"SELECT COUNT(DISTINCT src_ip) AS n FROM events {where}")
        lan_where = _and_where(where, "src_country = 'LAN'")
        net_where = _and_where(where, "src_country != 'LAN'")
        login_ok_where = _and_where(where, "event_type = 'login_attempt' AND raw LIKE '%login.success%'")
        login_fail_where = _and_where(
            where,
            "event_type = 'login_attempt' AND (raw LIKE '%login.failed%' OR raw LIKE '%login.fail%')",
        )
        lan_count = await scalar(f"SELECT COUNT(*) AS n FROM events {lan_where}")
        internet_count = await scalar(f"SELECT COUNT(*) AS n FROM events {net_where}")
        login_success = await scalar(f"SELECT COUNT(*) AS n FROM events {login_ok_where}")
        login_fail = await scalar(f"SELECT COUNT(*) AS n FROM events {login_fail_where}")

        by_type = await grouped("event_type", 8)
        TYPE_KEYS = ("scan", "login_attempt", "command", "payload")
        type_map = dict(await grouped("event_type", 8, clause=census_where, bind=census_params))
        type_totals = [(key, int(type_map.get(key, 0))) for key in TYPE_KEYS]
        facet_ips = await grouped("src_ip", 250, clause=census_where, bind=census_params)
        facet_countries = await grouped("src_country", 80, clause=census_where, bind=census_params)
        cur = await conn.execute(
            f"""
            SELECT dst_port AS port, COUNT(*) AS n
            FROM events {census_where}
            GROUP BY dst_port
            ORDER BY n DESC
            LIMIT 40
            """,
            census_params,
        )
        facet_ports = [(int(row["port"] or 0), int(row["n"])) for row in await cur.fetchall()]
        sess_clause = _and_where(census_where, "session_id != ''")
        cur = await conn.execute(
            f"""
            SELECT session_id AS name, COUNT(*) AS n
            FROM events {sess_clause}
            GROUP BY session_id
            ORDER BY MAX(timestamp) DESC
            LIMIT 80
            """,
            census_params,
        )
        facet_sessions = [row["name"] for row in await cur.fetchall() if row["name"]]
        countries = await grouped("src_country", 8, "src_country != 'LAN'")
        protocols = await grouped("protocol")
        top_ips = await grouped("src_ip", 8)

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

        cur = await conn.execute(
            f"""
            SELECT substr(timestamp, 1, 13) AS bucket, event_type AS kind, COUNT(*) AS n
            FROM events {where}
            GROUP BY bucket, event_type
            ORDER BY bucket
            """,
            params,
        )
        by_bucket: dict[str, dict[str, int]] = {}
        for row in await cur.fetchall():
            bucket = row["bucket"]
            kind = row["kind"] or "scan"
            slot = by_bucket.setdefault(
                bucket, {"scan": 0, "login_attempt": 0, "command": 0, "payload": 0}
            )
            if kind in slot:
                slot[kind] = int(row["n"])
            else:
                slot["scan"] += int(row["n"])
        over_by_type = [
            TypeTimeBucket(t=f"{bucket}:00:00Z", **counts)
            for bucket, counts in sorted(by_bucket.items())
        ]

        async def recent_hits(kind: str) -> list[HitSnippet]:
            clause = _and_where(where, "event_type = ?")
            cur_h = await conn.execute(
                f"""
                SELECT timestamp, src_ip, raw
                FROM events {clause}
                ORDER BY timestamp DESC
                LIMIT 8
                """,
                [*params, kind],
            )
            out: list[HitSnippet] = []
            for row in await cur_h.fetchall():
                text = _snippet_from_raw(row["raw"] or "", kind)
                if not text:
                    continue
                out.append(
                    HitSnippet(
                        timestamp=row["timestamp"] or "",
                        src_ip=row["src_ip"] or "",
                        text=text,
                    )
                )
            return out

        recent_commands = await recent_hits("command")
        recent_payloads = await recent_hits("payload")
    finally:
        await conn.close()

    return StatsPayload(
        events_24h=events_24h,
        unique_ips=unique_ips,
        by_type=[NamedCount(name=n, count=c) for n, c in by_type],
        login_success=login_success,
        login_fail=login_fail,
        lan_count=lan_count,
        internet_count=internet_count,
        top_countries=[NamedCount(name=n, count=c) for n, c in countries],
        top_ports=[PortCount(port=p, count=c) for p, c in ports],
        over_time=over,
        over_time_by_type=over_by_type,
        protocols=[NamedCount(name=n, count=c) for n, c in protocols],
        top_ips=[NamedCount(name=n, count=c) for n, c in top_ips],
        recent_commands=recent_commands,
        recent_payloads=recent_payloads,
        type_totals=[NamedCount(name=n, count=c) for n, c in type_totals],
        facet_ips=[NamedCount(name=n, count=c) for n, c in facet_ips],
        facet_countries=[NamedCount(name=n, count=c) for n, c in facet_countries],
        facet_ports=[PortCount(port=p, count=c) for p, c in facet_ports],
        facet_sessions=facet_sessions,
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
