#!/usr/bin/env python3
"""Move a few files on the fictional jump host so a second visit is not identical.

Cowrie reads file bodies from honeyfs. These paths already exist in fs.pickle,
so a body change shows up without rebuilding the pickle. Nothing here is a real
secret. Run from the repo root, or pass --honeyfs.
"""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_HONEYFS = ROOT / "sensors" / "cowrie" / "honeyfs"
CHECK_PREFIX = "Last log check:"
TICKET_PREFIX = "- ticket IT-"
BACKUP_PREFIX = "tar czf /var/backups/home-"


def now_local() -> datetime:
    try:
        return datetime.now(ZoneInfo("Asia/Kuala_Lumpur"))
    except Exception:
        return datetime.now().astimezone()


def replace_prefixed(text: str, prefix: str, line: str) -> str:
    rows = text.splitlines()
    replaced = False
    out: list[str] = []
    for row in rows:
        if row.startswith(prefix):
            if not replaced:
                out.append(line)
                replaced = True
            continue
        out.append(row)
    if not replaced:
        if out and out[-1] != "":
            out.append(line)
        else:
            out.append(line)
    body = "\n".join(out)
    if text.endswith("\n") or not text:
        body += "\n"
    return body


def update(honeyfs: Path, moment: datetime) -> list[str]:
    stamp = moment.strftime("%d %b %Y %H:%M +08")
    day = moment.strftime("%Y%m%d")
    iso = moment.strftime("%Y-%m-%d")
    changed: list[str] = []

    motd = honeyfs / "etc" / "motd"
    if motd.is_file():
        motd.write_text(
            replace_prefixed(motd.read_text(encoding="utf-8"), CHECK_PREFIX, f"{CHECK_PREFIX} {stamp}"),
            encoding="utf-8",
        )
        changed.append(str(motd.relative_to(honeyfs)))

    todo = honeyfs / "root" / "Desktop" / "TODO.txt"
    if todo.is_file():
        todo.write_text(
            replace_prefixed(
                todo.read_text(encoding="utf-8"),
                TICKET_PREFIX,
                f"{TICKET_PREFIX}{day}: contractor VPN lease, check before end of day",
            ),
            encoding="utf-8",
        )
        changed.append(str(todo.relative_to(honeyfs)))

    backup = f"{BACKUP_PREFIX}{iso}.tgz /home/itadmin"
    for relative in ("home/itadmin/.bash_history", "root/.bash_history"):
        path = honeyfs / relative
        if not path.is_file():
            continue
        path.write_text(
            replace_prefixed(path.read_text(encoding="utf-8"), BACKUP_PREFIX, backup),
            encoding="utf-8",
        )
        changed.append(relative)
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh kl-jump-01 honeyfs so it does not look frozen.")
    parser.add_argument("--honeyfs", type=Path, default=DEFAULT_HONEYFS)
    args = parser.parse_args()
    changed = update(args.honeyfs, now_local())
    for path in changed:
        print(path)


if __name__ == "__main__":
    main()
