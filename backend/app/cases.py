"""Turn stored honeypot events into session cases, clusters, and a morning note."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Protocol
from zoneinfo import ZoneInfo

PAYLOAD_VERBS = {
    "wget",
    "curl",
    "tftp",
    "scp",
    "nc",
    "ncat",
    "netcat",
    "base64",
    "python",
    "python3",
    "perl",
    "php",
}
URL_RE = re.compile(r"https?://\S+")
VERDICT_LABEL = {
    "scanner": "Scanner",
    "password_guess": "Password guess",
    "hands": "Hands on keyboard",
    "payload": "Payload",
}


class EventLike(Protocol):
    timestamp: str
    src_ip: str
    src_country: str
    dst_port: int
    protocol: str
    event_type: str
    raw: str
    session_id: str


@dataclass
class LieRow:
    timestamp: str
    command: str
    attacker_saw: str
    real_effect: str


@dataclass
class SessionCase:
    session_id: str
    src_ip: str
    src_country: str
    protocol: str
    dst_port: int
    started: str
    ended: str
    verdict: str
    verdict_label: str
    summary: str
    commands: list[str] = field(default_factory=list)
    files: list[str] = field(default_factory=list)
    cluster_name: str = ""
    cluster_line: str = ""
    lies: list[LieRow] = field(default_factory=list)


def malaysia_tz() -> ZoneInfo:
    try:
        return ZoneInfo("Asia/Kuala_Lumpur")
    except Exception:
        return timezone(timedelta(hours=8))  # type: ignore[return-value]


def parse_raw(raw: str) -> dict:
    if not raw:
        return {}
    try:
        obj = json.loads(raw)
    except ValueError:
        return {}
    return obj if isinstance(obj, dict) else {}


def _text(obj: dict, *keys: str) -> str:
    for key in keys:
        value = obj.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def command_verb(command: str) -> str:
    parts = command.strip().split()
    if not parts:
        return ""
    verb = parts[0].rsplit("/", 1)[-1].lower()
    if verb == "sudo" and len(parts) > 1:
        verb = parts[1].rsplit("/", 1)[-1].lower()
    return verb


def _eventid(obj: dict) -> str:
    return _text(obj, "eventid", "event")


def _is_payload_command(command: str) -> bool:
    verb = command_verb(command)
    if verb in PAYLOAD_VERBS:
        return True
    lowered = command.lower()
    return "chmod +x" in lowered or "base64 -d" in lowered or "/dev/tcp" in lowered


def _files_from(obj: dict, command: str) -> list[str]:
    found: list[str] = []
    for key in ("destfile", "outfile", "url", "shasum"):
        value = _text(obj, key)
        if value:
            found.append(value)
    found.extend(URL_RE.findall(command))
    return found


def _lie(obj: dict, event_type: str, command: str) -> tuple[str, str] | None:
    eventid = _eventid(obj)
    if "login.success" in eventid:
        return (
            "Shell prompt after a successful login.",
            "No shell ran on the host. Cowrie answered.",
        )
    if "login.failed" in eventid or "login.fail" in eventid:
        user = _text(obj, "username") or "that account"
        return (
            f"Authentication failed for {user}.",
            "The host account database was not checked.",
        )
    if "file_download.failed" in eventid:
        return (
            "The download failed.",
            "Nothing was stored, on the host or in the container.",
        )
    if "file_download" in eventid or "file_upload" in eventid or event_type == "payload":
        name = _text(obj, "destfile", "outfile", "url", "shasum") or "the file"
        return (
            f"The transfer of {name} looked finished.",
            "The bytes stayed inside the Cowrie container. The management host did not run the file.",
        )
    if command or event_type == "command" or "command" in eventid:
        shown = command or _text(obj, "input", "message") or "the command"
        message = _text(obj, "message")
        if message and message != shown:
            saw = message
        elif "command.failed" in eventid:
            saw = f"Cowrie printed a failure for `{shown}`."
        else:
            saw = f"Cowrie accepted `{shown}` and printed an emulated reply."
        return (
            saw,
            "The command was not executed on the host. Outbound from the bait VLAN stays in the bait VLAN.",
        )
    return None


def _verdict(events: list[EventLike]) -> str:
    commands: list[str] = []
    payload = False
    logins = False
    for event in events:
        obj = parse_raw(event.raw)
        command = _text(obj, "input")
        if command:
            commands.append(command)
        if event.event_type == "payload" or "file_" in _eventid(obj):
            payload = True
        if command and _is_payload_command(command):
            payload = True
        if event.event_type == "login_attempt" or "login" in _eventid(obj):
            logins = True
    if payload:
        return "payload"
    if commands:
        return "hands"
    if logins:
        return "password_guess"
    return "scanner"


def _summary(
    verdict: str,
    ip: str,
    country: str,
    commands: list[str],
    files: list[str],
    login_fails: int,
    login_ok: int,
) -> str:
    where = ip or "an unknown address"
    if country and country not in {"UNK", "LAN"}:
        where = f"{where} ({country})"
    if verdict == "scanner":
        return f"Scanner from {where}. The session connected and left without a login."
    if verdict == "password_guess":
        if login_ok and not login_fails:
            return f"Password guess from {where}. Login succeeded, then no commands."
        noun = "failed login" if login_fails == 1 else "failed logins"
        count = login_fails or "several"
        return f"Password guess from {where}. {count} {noun}, then no commands."
    preview = ", ".join(commands[:4])
    typed = _count_phrase(len(commands), "command")
    if verdict == "payload":
        touched = ", ".join(files[:3]) if files else "a download or upload"
        return f"Payload from {where}. After {typed} the session touched {touched}."
    return f"Hands on keyboard from {where}. Typed {typed}: {preview}."


def _weekday(iso: str, tz: ZoneInfo) -> str:
    try:
        moment = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return "an earlier day"
    return moment.astimezone(tz).strftime("%A")


def build_cases(events: list[EventLike], tz: ZoneInfo | None = None) -> list[SessionCase]:
    zone = tz or malaysia_tz()
    grouped: dict[str, list[EventLike]] = defaultdict(list)
    for event in events:
        if event.session_id:
            grouped[event.session_id].append(event)

    shapes: dict[str, tuple[str, ...]] = {}
    started: dict[str, str] = {}
    drafts: list[tuple[str, list[EventLike], str, list[str], list[str], list[LieRow], int, int]] = []

    for session_id, rows in grouped.items():
        rows.sort(key=lambda item: item.timestamp)
        commands: list[str] = []
        files: list[str] = []
        lies: list[LieRow] = []
        login_fails = 0
        login_ok = 0
        for event in rows:
            obj = parse_raw(event.raw)
            command = _text(obj, "input")
            eventid = _eventid(obj)
            if command and command not in commands:
                commands.append(command)
            if "login.failed" in eventid or "login.fail" in eventid:
                login_fails += 1
            if "login.success" in eventid:
                login_ok += 1
            for name in _files_from(obj, command):
                if name not in files:
                    files.append(name)
            pair = _lie(obj, event.event_type, command)
            if pair and len(lies) < 40:
                lies.append(LieRow(timestamp=event.timestamp, command=command or eventid or event.event_type, attacker_saw=pair[0], real_effect=pair[1]))
        verdict = _verdict(rows)
        shapes[session_id] = tuple(command_verb(command) for command in commands if command_verb(command))
        started[session_id] = rows[0].timestamp
        drafts.append((session_id, rows, verdict, commands, files, lies, login_fails, login_ok))

    by_shape: dict[tuple[str, ...], list[str]] = defaultdict(list)
    for session_id, shape in shapes.items():
        if shape:
            by_shape[shape].append(session_id)

    cases: list[SessionCase] = []
    for session_id, rows, verdict, commands, files, lies, login_fails, login_ok in drafts:
        shape = shapes[session_id]
        earlier_ids = []
        if shape:
            earlier_ids = [
                other
                for other in by_shape[shape]
                if other != session_id and started[other] < started[session_id]
            ]
            earlier_ids.sort(key=lambda other: started[other])
        cluster_name = " · ".join(shape[:6]) if shape else ""
        if earlier_ids:
            weekday = _weekday(started[earlier_ids[0]], zone)
            noun = "session" if len(earlier_ids) == 1 else "sessions"
            cluster_line = f"Same cluster as {weekday}, {len(earlier_ids)} earlier {noun}."
        elif cluster_name:
            cluster_line = f"Cluster {cluster_name}. First time this command shape has shown up."
        else:
            cluster_line = ""
        first = rows[0]
        cases.append(
            SessionCase(
                session_id=session_id,
                src_ip=first.src_ip,
                src_country=first.src_country,
                protocol=first.protocol,
                dst_port=first.dst_port,
                started=rows[0].timestamp,
                ended=rows[-1].timestamp,
                verdict=verdict,
                verdict_label=VERDICT_LABEL[verdict],
                summary=_summary(verdict, first.src_ip, first.src_country, commands, files, login_fails, login_ok),
                commands=commands[:30],
                files=files[:12],
                cluster_name=cluster_name,
                cluster_line=cluster_line,
                lies=lies,
            )
        )
    cases.sort(key=lambda item: item.ended, reverse=True)
    return cases


def brief_window(now: datetime | None = None, tz: ZoneInfo | None = None) -> tuple[datetime, datetime]:
    zone = tz or malaysia_tz()
    moment = (now or datetime.now(timezone.utc)).astimezone(zone)
    end = moment.replace(hour=8, minute=0, second=0, microsecond=0)
    if moment < end:
        end = end - timedelta(days=1)
    return end - timedelta(days=1), end


def _count_phrase(count: int, singular: str, plural: str | None = None) -> str:
    word = singular if count == 1 else (plural or f"{singular}s")
    return f"{count} {word}"


def overnight_paragraph(cases: list[SessionCase], start: datetime, end: datetime) -> str:
    inside = []
    for case in cases:
        try:
            opened = datetime.fromisoformat(case.started.replace("Z", "+00:00"))
        except ValueError:
            continue
        if start.astimezone(timezone.utc) <= opened < end.astimezone(timezone.utc):
            inside.append(case)
    if not inside:
        label = end.strftime("%d %b %Y 08:00 MYT")
        return f"No SSH sessions in the overnight window that closed at {label}."

    counts = defaultdict(int)
    clusters: dict[str, int] = defaultdict(int)
    for case in inside:
        counts[case.verdict] += 1
        if case.cluster_name:
            clusters[case.cluster_name] += 1
    bits = []
    if counts["scanner"]:
        bits.append(_count_phrase(counts["scanner"], "scanner"))
    if counts["password_guess"]:
        bits.append(_count_phrase(counts["password_guess"], "password guess", "password guesses"))
    if counts["hands"]:
        bits.append(_count_phrase(counts["hands"], "hands-on session"))
    if counts["payload"]:
        bits.append(_count_phrase(counts["payload"], "payload"))
    sentence = ", ".join(bits) + "."
    repeated = [(name, count) for name, count in clusters.items() if count > 1]
    repeated.sort(key=lambda item: item[1], reverse=True)
    if repeated:
        name, count = repeated[0]
        sentence += f" {count} sessions shared the cluster {name}."
    sentence += f" Window closed {end.strftime('%d %b %Y 08:00 MYT')}."
    return sentence[0].upper() + sentence[1:]
