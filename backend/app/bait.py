from __future__ import annotations

import http.client
import json
import os
import socket
import tempfile
from pathlib import Path
from typing import Any

from app.config import get_settings

CATALOG: list[dict[str, Any]] = [
    {
        "id": "cowrie-ssh",
        "label": "Cowrie SSH",
        "port": 2222,
        "sensor": "cowrie-01",
        "kind": "cowrie",
        "conf_key": None,
    },
    {
        "id": "ftp",
        "label": "FTP",
        "port": 21,
        "sensor": "opencanary-01",
        "kind": "opencanary",
        "conf_key": "ftp.enabled",
    },
    {
        "id": "telnet",
        "label": "Telnet",
        "port": 23,
        "sensor": "opencanary-01",
        "kind": "opencanary",
        "conf_key": "telnet.enabled",
    },
    {
        "id": "mysql",
        "label": "MySQL",
        "port": 3306,
        "sensor": "opencanary-01",
        "kind": "opencanary",
        "conf_key": "mysql.enabled",
    },
    {
        "id": "redis",
        "label": "Redis",
        "port": 6379,
        "sensor": "opencanary-01",
        "kind": "opencanary",
        "conf_key": "redis.enabled",
    },
    {
        "id": "http",
        "label": "HTTP",
        "port": 8080,
        "sensor": "opencanary-01",
        "kind": "opencanary",
        "conf_key": "http.enabled",
    },
]

ALLOWED_IDS = {item["id"] for item in CATALOG}
BIND = "10.0.10.4"


class UnixHTTPConnection(http.client.HTTPConnection):
    def __init__(self, sock_path: str) -> None:
        super().__init__("localhost")
        self.sock_path = sock_path

    def connect(self) -> None:
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(self.sock_path)


def _conf_path() -> Path:
    return Path(get_settings().opencanary_conf)


def _state_path() -> Path:
    return Path(get_settings().bait_state_path)


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw if isinstance(raw, dict) else {}


def _write_json(path: Path, data: dict[str, Any]) -> None:
    payload = json.dumps(data, indent=2) + "\n"
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    fd, tmp_name = tempfile.mkstemp(prefix=f"{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
        try:
            os.replace(tmp_name, path)
            tmp_name = ""
        except OSError:
            path.write_text(payload, encoding="utf-8")
    finally:
        if tmp_name:
            Path(tmp_name).unlink(missing_ok=True)


def _docker(method: str, url: str) -> tuple[int, Any]:
    sock = get_settings().docker_sock
    if not Path(sock).exists():
        raise FileNotFoundError("docker socket is not mounted")
    conn = UnixHTTPConnection(sock)
    try:
        conn.request(method, url)
        res = conn.getresponse()
        body = res.read()
        payload: Any = None
        if body:
            try:
                payload = json.loads(body.decode("utf-8"))
            except json.JSONDecodeError:
                payload = body.decode("utf-8", errors="replace")
        return res.status, payload
    finally:
        conn.close()


def container_running(name: str) -> bool | None:
    try:
        status, payload = _docker("GET", f"/containers/{name}/json")
    except (FileNotFoundError, PermissionError, OSError):
        return None
    if status != 200 or not isinstance(payload, dict):
        return None
    state = payload.get("State") or {}
    return bool(state.get("Running"))


def _docker_action(name: str, action: str) -> None:
    status, payload = _docker("POST", f"/containers/{name}/{action}?t=8")
    if status not in {204, 304}:
        detail = payload if payload else status
        raise RuntimeError(f"docker {action} {name} failed: {detail}")


def current_services() -> list[dict[str, Any]]:
    conf = _read_json(_conf_path())
    state = _read_json(_state_path())
    cowrie_flag = state.get("cowrie-ssh")
    cowrie_running = container_running(get_settings().cowrie_container)
    oc_running = container_running(get_settings().opencanary_container)
    rows: list[dict[str, Any]] = []
    for item in CATALOG:
        if item["kind"] == "cowrie":
            enabled = bool(cowrie_flag) if isinstance(cowrie_flag, bool) else bool(cowrie_running if cowrie_running is not None else True)
            running = cowrie_running
        else:
            enabled = bool(conf.get(item["conf_key"], False))
            running = oc_running if enabled else False
        rows.append(
            {
                "id": item["id"],
                "label": item["label"],
                "port": item["port"],
                "sensor": item["sensor"],
                "enabled": enabled,
                "running": running,
            }
        )
    return rows


def save_services(flags: dict[str, bool]) -> list[dict[str, Any]]:
    unknown = set(flags) - ALLOWED_IDS
    if unknown:
        raise ValueError(f"unknown bait service: {sorted(unknown)}")
    conf_path = _conf_path()
    conf = _read_json(conf_path)
    if not conf:
        raise RuntimeError(f"opencanary conf missing or empty: {conf_path}")
    state = _read_json(_state_path())
    for item in CATALOG:
        if item["id"] not in flags:
            continue
        enabled = bool(flags[item["id"]])
        if item["kind"] == "cowrie":
            state["cowrie-ssh"] = enabled
        else:
            conf[item["conf_key"]] = enabled
    _write_json(conf_path, conf)
    _write_json(_state_path(), state)
    return current_services()


def apply_services() -> dict[str, Any]:
    rows = current_services()
    wanted = {row["id"]: row["enabled"] for row in rows}
    settings = get_settings()
    actions: list[str] = []
    try:
        cowrie_up = container_running(settings.cowrie_container)
        if wanted.get("cowrie-ssh"):
            if cowrie_up is True:
                actions.append("hive-cowrie already running")
            else:
                _docker_action(settings.cowrie_container, "start")
                actions.append("start hive-cowrie")
        elif cowrie_up is False:
            actions.append("hive-cowrie already stopped")
        else:
            _docker_action(settings.cowrie_container, "stop")
            actions.append("stop hive-cowrie")
        _docker_action(settings.opencanary_container, "restart")
        actions.append("restart hive-opencanary")
    except (FileNotFoundError, PermissionError, OSError, RuntimeError) as exc:
        return {"ok": False, "error": str(exc), "actions": actions, "services": current_services()}
    return {"ok": True, "error": None, "actions": actions, "services": current_services()}
