from __future__ import annotations

from pathlib import Path

from app.config import get_settings

_city = None
_asn = None
_tried = False


def geoip_available() -> bool:
    _ensure()
    return _city is not None


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
    if city_path.exists():
        try:
            _city = geoip2.database.Reader(str(city_path))
        except Exception:
            _city = None
    if asn_path.exists():
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
