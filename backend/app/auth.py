from __future__ import annotations

import base64
import hmac
import secrets

from fastapi import Depends, HTTPException, WebSocket, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.config import get_settings

_basic = HTTPBasic()


def _creds_ok(username: str, password: str) -> bool:
    settings = get_settings()
    user_ok = hmac.compare_digest(username.encode(), settings.user.encode())
    pass_ok = hmac.compare_digest(password.encode(), settings.password.encode())
    return user_ok and pass_ok


def require_basic(credentials: HTTPBasicCredentials = Depends(_basic)) -> str:
    if not _creds_ok(credentials.username, credentials.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


def _decode_basic_token(token: str) -> tuple[str, str] | None:
    try:
        decoded = base64.b64decode(token).decode("utf-8")
        username, password = decoded.split(":", 1)
        return username, password
    except Exception:
        return None


async def require_ws_auth(websocket: WebSocket) -> bool:
    header = websocket.headers.get("authorization", "")
    token = websocket.query_params.get("token", "")
    username = password = ""

    if header.lower().startswith("basic "):
        parsed = _decode_basic_token(header.split(" ", 1)[1].strip())
        if parsed:
            username, password = parsed
    elif token:
        parsed = _decode_basic_token(token)
        if parsed:
            username, password = parsed

    if username and _creds_ok(username, password):
        return True

    await websocket.close(code=4401)
    return False


def new_nonce() -> str:
    return secrets.token_hex(8)
