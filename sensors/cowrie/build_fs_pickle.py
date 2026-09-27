#!/usr/bin/env python3
"""Overlay a honeyfs tree onto a Cowrie fs.pickle so `ls` lists decoy dirs."""
from __future__ import annotations

import argparse
import os
import pickle
import stat
import time
from pathlib import Path

A_NAME, A_TYPE, A_UID, A_GID, A_SIZE, A_MODE, A_CTIME, A_CONTENTS, A_TARGET, A_REALFILE = range(10)
T_LINK, T_DIR, T_FILE, T_BLK, T_CHR, T_SOCK, T_FIFO = range(7)

UID_MAP = {
    "root": (0, 0),
    "home/itadmin": (1001, 1001),
    "home/finance": (1002, 1002),
    "home/phil": (1000, 1000),
}


def load_tree(path: Path):
    with path.open("rb") as fh:
        try:
            return pickle.load(fh)
        except UnicodeDecodeError:
            fh.seek(0)
            return pickle.load(fh, encoding="utf8")


def get_child(node, name):
    kids = node[A_CONTENTS]
    if not isinstance(kids, list):
        return None
    for child in kids:
        if child[A_NAME] == name:
            return child
    return None


def mkdir(parent, name, uid, gid, mode=0o40755, ctime=None):
    existing = get_child(parent, name)
    if existing is not None:
        if existing[A_TYPE] != T_DIR:
            raise SystemExit(f"{name} exists and is not a directory")
        return existing
    node = [
        name,
        T_DIR,
        uid,
        gid,
        4096,
        mode,
        ctime if ctime is not None else time.time(),
        [],
        None,
        None,
    ]
    parent[A_CONTENTS].append(node)
    return node


def ensure_dir(root, parts, uid, gid, mode=0o40755):
    cur = root
    for part in parts:
        child = get_child(cur, part)
        if child is None:
            child = mkdir(cur, part, uid, gid, mode)
        cur = child
    return cur


def upsert_file(parent, name, data: bytes, uid, gid, mode, ctime):
    existing = get_child(parent, name)
    if existing is None:
        parent[A_CONTENTS].append(
            [name, T_FILE, uid, gid, len(data), mode, ctime, data, None, None]
        )
        return
    existing[A_TYPE] = T_FILE
    existing[A_UID] = uid
    existing[A_GID] = gid
    existing[A_SIZE] = len(data)
    existing[A_MODE] = mode
    existing[A_CTIME] = ctime
    existing[A_CONTENTS] = data
    existing[A_TARGET] = None
    existing[A_REALFILE] = None


def owners_for(rel: str) -> tuple[int, int]:
    for prefix, ids in UID_MAP.items():
        if rel == prefix or rel.startswith(prefix + "/"):
            return ids
    return (0, 0)


def mode_for(rel: str, is_dir: bool, path: Path) -> int:
    if is_dir:
        if rel.endswith("/.ssh") or rel.endswith(".ssh"):
            return 0o40700
        return 0o40755
    name = path.name
    if name in {"id_ed25519", "id_rsa", "auth.txt"}:
        return 0o100600
    st = path.stat().st_mode
    return stat.S_IFREG | (st & 0o777)


def overlay(root, honeyfs: Path) -> None:
    for dirpath, dirnames, filenames in os.walk(honeyfs):
        rel_dir = os.path.relpath(dirpath, honeyfs)
        parts = [] if rel_dir == "." else rel_dir.split(os.sep)
        uid, gid = owners_for("/".join(parts) if parts else "root")
        parent = ensure_dir(root, parts, uid, gid) if parts else root
        if parts and (parts[-1] == ".ssh"):
            parent[A_MODE] = 0o40700
            parent[A_UID], parent[A_GID] = uid, gid
        for name in filenames:
            fpath = Path(dirpath) / name
            rel = "/".join(parts + [name]) if parts else name
            f_uid, f_gid = owners_for(rel)
            data = fpath.read_bytes()
            ctime = fpath.stat().st_mtime
            upsert_file(parent, name, data, f_uid, f_gid, mode_for(rel, False, fpath), ctime)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", type=Path, required=True)
    ap.add_argument("--honeyfs", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    tree = load_tree(args.base)
    overlay(tree, args.honeyfs)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("wb") as fh:
        pickle.dump(tree, fh, protocol=5)
    print(f"wrote {args.out} ({args.out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
