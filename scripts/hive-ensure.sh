#!/bin/bash
# Bring IAS Hive up on 10.0.20.3 once that NIC is present.
set -euo pipefail
ROOT=/home/satux/Documents/IAS-HIVE
MGMT=(docker compose -f "$ROOT/docker-compose.yml")
SENSORS=(docker compose -f "$ROOT/docker-compose.sensors.yml")

wait_ip() {
  local n=0
  while ! ip -4 addr show | grep -q "inet 10.0.20.3/"; do
    n=$((n + 1))
    if [ "$n" -ge 60 ]; then
      echo "ias-hive: 10.0.20.3 is not assigned" >&2
      return 1
    fi
    sleep 2
  done
}

wait_ip

cd "$ROOT"
"${MGMT[@]}" up -d
"${SENSORS[@]}" up -d
