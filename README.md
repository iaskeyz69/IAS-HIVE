# IAS Hive — Honeypot Command Center

Self-hosted dashboard for Cowrie and OpenCanary telemetry. Sensors stay on
VLAN 7. This stack only tails their log files, normalizes events, and draws
them on a dark command-center HUD. It does not run honeypot daemons or
publish bait ports.

## What you get

- FastAPI backend: JSONL tailers, MaxMind GeoLite2 (offline), SQLite, REST, WebSocket
- React HUD: Mapbox 2D / pitched 3D, table, stats, live feed, timeline scrubber
- `docker-compose` on an **internal** management network; UI bound to `127.0.0.1:8443`

## Network model

```
VLAN 7 (bait)          Management host              Operator
Cowrie / OpenCanary --> NFS/SMB/rsync logs --> hive-api + hive-ui
                                               127.0.0.1:8443  <-- SSH tunnel / VPN
```

- Do **not** attach `hive_mgmt` to a VLAN 7 / bait bridge.
- Do **not** publish `8443` on `0.0.0.0`. Compose binds loopback only.
- The compose network is `internal: true` so the API/UI have no default route
  to the internet. GeoIP is a local `.mmdb` file.

## After git clone (Docker)

This folder must already be a committed git repo with a remote before anyone
else can `git clone` it. Never commit `.env`.

On the management host you need Docker Compose. The **operator browser** needs
internet for Mapbox tiles (the API container does not).

```bash
git clone <your-repo-url> ias-hive
cd ias-hive

cp .env.example .env
```

Edit `.env` before the first build:

| Variable | What to set |
|---|---|
| `HIVE_USER` / `HIVE_PASSWORD` | Dashboard login. The API will not start if these are empty. Change the example password. |
| `HIVE_DEMO` | `1` for the first run (synthetic TEST-NET events, no sensor logs required). |
| `VITE_MAPBOX_TOKEN` | Your public Mapbox `pk.` token. Must be in **this root `.env`** so `docker compose build` bakes it into the UI. If it is missing, the map shows `SET VITE_MAPBOX_TOKEN`. |

URL-restrict the Mapbox token to `http://127.0.0.1:8443` (and `http://localhost:5173` if you also run Vite).

```bash
docker compose up -d --build
```

Open **http://127.0.0.1:8443** and sign in with `HIVE_USER` / `HIVE_PASSWORD`.

```bash
docker compose ps
docker compose logs -f api
```

Rebuild the UI whenever you change `VITE_MAPBOX_TOKEN` (`docker compose up -d --build` again). Stop with `docker compose down`.

If Docker Desktop never publishes `8443`, remove `internal: true` from the `hive_mgmt` network in `docker-compose.yml` and keep the `127.0.0.1:8443` bind.

Remote operator (dashboard stays on loopback):

```bash
ssh -L 8443:127.0.0.1:8443 user@mgmt-host
```

For local Vite (no Docker), also copy `frontend/.env.example` → `frontend/.env` and set the same `VITE_MAPBOX_TOKEN`.

## Point it at VLAN 7 sensors

1. On the management host, mount or rsync each sensor JSON log under `./data/logs/<sensor_id>/`.
   Typical sources:

   | Sensor     | File on the sensor host                         | Mount here                         |
   |------------|--------------------------------------------------|------------------------------------|
   | Cowrie     | `/var/log/cowrie/cowrie.json`                    | `./data/logs/cowrie-01/cowrie.json` |
   | OpenCanary | configured JSON logger (often `/var/tmp/opencanary.log`) | `./data/logs/opencanary-01/opencanary.log` |

2. Copy `sensors.yaml.example` → `sensors.yaml` (already present as a starter).
   Set `id`, `type` (`cowrie` or `opencanary`), `log_path` **as seen inside the
   API container** (`/logs/...` = `./data/logs/...` on the host), and `lat`/`lon`
   for the sensor (your homelab geo, not the attacker).

3. Drop MaxMind databases into `./data/geoip/`:

   - `GeoLite2-City.mmdb`
   - `GeoLite2-ASN.mmdb`

   Sign up at [MaxMind](https://www.maxmind.com/en/geolite2/signup), generate a
   license key, and download the editions yourself. They are not vendored.

4. Set `HIVE_DEMO=0` in `.env` once real logs are flowing. Without GeoLite2,
   table/stats still work; attacker lat/lon stay empty.

5. `docker compose up -d`

Dionaea and T-Pot Elasticsearch ingest are not in this version. Add a collector
that writes Cowrie/OpenCanary-compatible JSONL, or extend `backend/app/ingest/`.

## Local development (no Docker)

From the repo root, give the API host paths (the checked-in `.env` uses
container paths):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux
pip install -r requirements.txt

set HIVE_USER=operator
set HIVE_PASSWORD=change-me-now
set HIVE_DEMO=1
set HIVE_DB_PATH=../data/db/hive.sqlite
set HIVE_SENSORS_FILE=../sensors.yaml
set HIVE_GEOIP_CITY=../data/geoip/GeoLite2-City.mmdb
set HIVE_GEOIP_ASN=../data/geoip/GeoLite2-ASN.mmdb
# On Linux/macOS use export instead of set

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` and `/ws` to `127.0.0.1:8000`.

## API (all routes require HTTP Basic)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Process + GeoIP + demo flag |
| GET | `/api/sensors` | Configured sensors + online/offline |
| GET | `/api/events` | Paginated/filterable history |
| GET | `/api/stats` | Countries, ports, time series, protocols |
| GET | `/api/timeline?hours=1` | Minute buckets for the scrubber |
| GET | `/api/summary` | 24h count |
| WS | `/ws/events?token=<base64 user:pass>` | Live normalized events |

Browsers cannot set an `Authorization` header on `WebSocket`, so the UI sends
the same Basic credential as a `token` query parameter.

## Security

- Treat every log field as attacker-controlled. The UI renders strings as text
  nodes and strips control characters. There is no `dangerouslySetInnerHTML`.
  Raw lines are length-capped on ingest.
- HTTP Basic is required on every REST call, including `/api/health`.
- Change `HIVE_PASSWORD`. The API refuses to start if user or password is unset.
- Keep the dashboard off the bait segment. Bait listeners and this UI must not
  share a reachable LAN path from the internet.
- GeoLite2 is local so attacker IPs are not sent to a third-party API.
- No honeypot containers and no bait ports are defined in this compose file.

## Layout

```
backend/     FastAPI, tailers, GeoIP, SQLite
frontend/    React + Vite + Tailwind + Mapbox GL
nginx/       SPA + /api + /ws reverse proxy
data/logs/   bind-mount target for VLAN 7 JSONL
data/geoip/  GeoLite2-City.mmdb + GeoLite2-ASN.mmdb
data/db/     hive.sqlite
```
