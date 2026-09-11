from __future__ import annotations

import hashlib
import ipaddress
import math
from pathlib import Path

from app.config import get_settings

_city = None
_asn = None
_tried = False


def geoip_available() -> bool:
    _ensure()
    return _city is not None


def is_private_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return bool(
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
    )


def near_sensor(ip: str, sensor_lat: float, sensor_lon: float) -> tuple[float, float]:
    """Place unresolved / LAN sources a short hop from the sensor so the HUD can draw."""
    digest = hashlib.md5((ip or "unknown").encode("utf-8")).hexdigest()
    seed = int(digest[:8], 16)
    angle = (seed % 360) * math.pi / 180.0
    dist = 0.05 + (seed % 50) / 1000.0
    return (
        sensor_lat + dist * math.cos(angle),
        sensor_lon + dist * math.sin(angle),
    )


def _ensure() -> None:
    global _city, _asn, _tried
    if _tried:
        return
    _tried = True
    settings = get_settings()
    try:
        import geoip2.database
    except ImportError:
        return

    city_path = Path(settings.geoip_city)
    asn_path = Path(settings.geoip_asn)
    if city_path.exists() and city_path.stat().st_size > 0:
        try:
            _city = geoip2.database.Reader(str(city_path))
        except Exception:
            _city = None
    if asn_path.exists() and asn_path.stat().st_size > 0:
        try:
            _asn = geoip2.database.Reader(str(asn_path))
        except Exception:
            _asn = None


def lookup(ip: str) -> tuple[float | None, float | None, str, str]:
    """Return (lat, lon, country_iso, asn_label). Never calls a remote API."""
    if not ip:
        return None, None, "UNK", ""
    _ensure()
    lat = lon = None
    country = "UNK"
    asn = ""
    if _city is not None:
        try:
            rec = _city.city(ip)
            if rec.location.latitude is not None:
                lat = float(rec.location.latitude)
            if rec.location.longitude is not None:
                lon = float(rec.location.longitude)
            if rec.country.iso_code:
                country = rec.country.iso_code
        except Exception:
            pass
    if _asn is not None:
        try:
            rec = _asn.asn(ip)
            num = rec.autonomous_system_number
            org = rec.autonomous_system_organization or ""
            if num:
                asn = f"AS{num} {org}".strip()
        except Exception:
            pass
    return lat, lon, country, asn
