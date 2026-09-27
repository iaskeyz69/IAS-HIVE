from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class SensorConfig(BaseModel):
    id: str
    label: str
    type: str
    log_path: str
    lat: float
    lon: float


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="HIVE_",
        extra="ignore",
        env_file=(".env", "../.env"),
    )

    user: str = ""
    password: str = ""
    demo: bool = False
    db_path: str = "./data/db/hive.sqlite"
    geoip_city: str = "./data/geoip/GeoLite2-City.mmdb"
    geoip_asn: str = "./data/geoip/GeoLite2-ASN.mmdb"
    sensors_file: str = "./sensors.yaml"
    retention_days: int = 30
    sensor_online_minutes: int = 5
    raw_max_len: int = 4096
    cors_origin: str = "http://127.0.0.1:8443"
    opencanary_conf: str = "/app/sensors/opencanary.conf"
    bait_state_path: str = "/data/bait.json"
    docker_sock: str = "/var/run/docker.sock"
    cowrie_container: str = "hive-cowrie"
    opencanary_container: str = "hive-opencanary"
    tz: str = "Asia/Kuala_Lumpur"
    reports_dir: str = "./reports"


class SensorBook(BaseModel):
    sensors: list[SensorConfig] = Field(default_factory=list)

    def by_id(self, sensor_id: str) -> SensorConfig | None:
        for sensor in self.sensors:
            if sensor.id == sensor_id:
                return sensor
        return None


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if not settings.user or not settings.password:
        raise RuntimeError(
            "HIVE_USER and HIVE_PASSWORD must be set. Copy .env.example to .env."
        )
    return settings


def host_timezone() -> str:
    settings = get_settings()
    if settings.tz.strip():
        return settings.tz.strip()
    tz_file = Path("/etc/timezone")
    if tz_file.is_file():
        name = tz_file.read_text(encoding="utf-8").strip()
        if name:
            return name
    localtime = Path("/etc/localtime")
    try:
        resolved = str(localtime.resolve())
        if "zoneinfo/" in resolved:
            return resolved.rsplit("zoneinfo/", 1)[1]
    except OSError:
        pass
    return "Asia/Kuala_Lumpur"


def load_sensors(path: str | None = None) -> SensorBook:
    settings = get_settings()
    file_path = Path(path or settings.sensors_file)
    if not file_path.exists():
        raise RuntimeError(f"sensors file not found: {file_path}")
    raw = yaml.safe_load(file_path.read_text(encoding="utf-8")) or {}
    book = SensorBook.model_validate(raw)
    if not book.sensors:
        raise RuntimeError("sensors.yaml has no sensors")
    for sensor in book.sensors:
        if sensor.type not in {"cowrie", "opencanary"}:
            raise RuntimeError(
                f"unsupported sensor type '{sensor.type}' on {sensor.id} "
                "(v1 supports cowrie | opencanary)"
            )
    return book
