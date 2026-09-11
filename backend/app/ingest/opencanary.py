from __future__ import annotations

import json

from app.config import SensorConfig
from app.ingest.normalize import as_int, build_event, raw_line
from app.models import EventType, HiveEvent, Severity

# OpenCanary logtype integers (opencanary.logger)
_LOGTYPES: dict[int, tuple[str, EventType, Severity]] = {
    1001: ("generic", "scan", "low"),
    1004: ("ping", "scan", "low"),
    2000: ("ftp", "login_attempt", "medium"),
    3000: ("http", "scan", "low"),
    3001: ("http", "login_attempt", "medium"),
    4000: ("ssh", "scan", "low"),
    4001: ("ssh", "scan", "low"),
    4002: ("ssh", "login_attempt", "medium"),
    5000: ("smb", "payload", "high"),
    5001: ("tcp", "scan", "low"),
    6001: ("telnet", "login_attempt", "medium"),
    7001: ("http-proxy", "login_attempt", "medium"),
    8001: ("mysql", "login_attempt", "medium"),
    9001: ("mssql", "login_attempt", "medium"),
    9002: ("mssql", "login_attempt", "medium"),
    10001: ("tftp", "scan", "low"),
    11001: ("ntp", "scan", "low"),
    12001: ("vnc", "login_attempt", "medium"),
    13001: ("snmp", "scan", "low"),
    14001: ("rdp", "scan", "medium"),
    15001: ("sip", "scan", "low"),
    16001: ("git", "scan", "low"),
    17001: ("redis", "command", "medium"),
    18001: ("tcp", "scan", "low"),
    18002: ("tcp", "scan", "low"),
}


def parse_opencanary(line: str, sensor: SensorConfig) -> HiveEvent | None:
    text = line.strip()
    if not text:
        return None
    try:
        obj = json.loads(text)
    except ValueError:
        return None
    if not isinstance(obj, dict):
        return None

    # OpenCanary JSON logger; skip obviously non-canary lines
    if "src_host" not in obj and "src_ip" not in obj and "logtype" not in obj:
        return None

    logtype = as_int(obj.get("logtype"), -1)
    mapped = _LOGTYPES.get(logtype)
    if mapped:
        protocol, event_type, severity = mapped
    else:
        protocol, event_type, severity = _from_strings(obj)

    src_ip = str(obj.get("src_host") or obj.get("src_ip") or "")
    dst_port = as_int(obj.get("dst_port") or obj.get("dest_port"), 0)
    timestamp = str(obj.get("utc_time") or obj.get("local_time") or obj.get("timestamp") or "")
    session_id = str(obj.get("node_id") or obj.get("session") or "")

    return build_event(
        sensor=sensor,
        timestamp=timestamp,
        src_ip=src_ip,
        dst_port=dst_port,
        protocol=protocol,
        event_type=event_type,
        severity=severity,
        raw=raw_line(obj),
        session_id=session_id,
        extra_id=str(logtype),
    )


def _from_strings(obj: dict) -> tuple[str, EventType, Severity]:
    blob = " ".join(
        str(obj.get(k) or "")
        for k in ("logdata", "logtype", "reason", "event")
    ).lower()
    if "login" in blob or "password" in blob or "username" in blob:
        return "unknown", "login_attempt", "medium"
    if "scan" in blob or "syn" in blob or "port" in blob:
        return "tcp", "scan", "low"
    return "unknown", "scan", "low"
