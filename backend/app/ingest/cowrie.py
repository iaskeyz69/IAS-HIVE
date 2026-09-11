from __future__ import annotations

import json

from app.config import SensorConfig
from app.ingest.normalize import as_int, build_event, raw_line
from app.models import EventType, HiveEvent, Severity

_CONNECT = {
    "cowrie.session.connect",
    "cowrie.direct-tcpip.request",
    "cowrie.direct-tcpip.data",
    "cowrie.session.closed",
    "cowrie.client.version",
    "cowrie.client.kex",
}
_LOGIN = {"cowrie.login.failed", "cowrie.login.success"}
_COMMAND = {
    "cowrie.command.input",
    "cowrie.command.failed",
    "cowrie.command.success",
}
_PAYLOAD = {
    "cowrie.session.file_download",
    "cowrie.session.file_upload",
    "cowrie.session.file_download.failed",
}


def parse_cowrie(line: str, sensor: SensorConfig) -> HiveEvent | None:
    text = line.strip()
    if not text:
        return None
    try:
        obj = json.loads(text)
    except ValueError:
        return None
    if not isinstance(obj, dict):
        return None

    event_id = str(obj.get("eventid") or obj.get("event") or "")
    if not event_id.startswith("cowrie."):
        return None

    event_type, severity = _classify(event_id)
    protocol = str(obj.get("protocol") or "ssh").lower()
    if protocol == "unknown":
        protocol = "ssh"
    return build_event(
        sensor=sensor,
        timestamp=str(obj.get("timestamp") or obj.get("time") or ""),
        src_ip=str(obj.get("src_ip") or obj.get("src_host") or ""),
        dst_port=as_int(obj.get("dst_port") or obj.get("dest_port"), 22),
        protocol=protocol,
        event_type=event_type,
        severity=severity,
        raw=raw_line(obj),
        session_id=str(obj.get("session") or ""),
        extra_id=event_id,
    )


def _classify(event_id: str) -> tuple[EventType, Severity]:
    if event_id in _PAYLOAD:
        return "payload", "high"
    if event_id in _LOGIN:
        return "login_attempt", "medium"
    if event_id in _COMMAND:
        return "command", "medium"
    if event_id in _CONNECT:
        return "scan", "low"
    if "login" in event_id:
        return "login_attempt", "medium"
    if "command" in event_id:
        return "command", "medium"
    if "file" in event_id:
        return "payload", "high"
    return "scan", "low"
