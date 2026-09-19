# IAS Hive — Honeypot Command Center

Self-hosted dashboard for Cowrie and OpenCanary telemetry. The management
stack tails sensor JSON logs, normalizes events, and draws them on a dark HUD.
Bait listeners are a **separate** compose project (`docker-compose.sensors.yml`).
Hive does not invent new listen ports; Config only toggles that fixed catalog.

## What you get

- FastAPI backend: JSONL tailers, MaxMind GeoLite2 (offline), SQLite, REST, WebSocket
- React HUD: Mapbox globe / 2D, table, stats, live feed, timeline, **Config**
- Management compose on `hive_mgmt`; bait compose on `hive_bait`
- Event retention **30 days** (`HIVE_RETENTION_DAYS`)

## Network model

```
VLAN / LAN bait                         Management host
Cowrie :2222  ─┐
OpenCanary    ─┴─ JSON logs ──► ./data/logs ──► hive-api + hive-ui
  21/23/3306/6379/8080                         127.0.0.1:8443
                                               10.0.10.4:8443   ← Wi-Fi LAN
                                               10.0.20.3:8443   ← enx68e43b309f1c
```

- Do **not** attach `hive_mgmt` to a bait bridge.
- Do **not** publish `8443` on `0.0.0.0` or the public internet.
- Real SSH stays on the host (never bait port 22). Cowrie is `10.0.10.4:2222` and `10.0.20.3:2222`.
- Mapbox tiles load in the **operator browser**. The API container does not need a default route for GeoIP (local `.mmdb`).

## After git clone (Docker)

This folder must already be a committed git repo with a remote before anyone
else can `git clone` it. Never commit `.env`.

```bash
git clone <your-repo-url> ias-hive
cd ias-hive

cp .env.example .env
```

Edit `.env` before the first build:

| Variable | What to set |
|---|---|
| `HIVE_USER` / `HIVE_PASSWORD` | Dashboard login. The API will not start if these are empty. Use a long unique password. |
| `HIVE_DEMO` | `1` for the first run (synthetic events, no sensor logs required). `0` in production. |
| `HIVE_RETENTION_DAYS` | How long hits stay in SQLite. Default `30`. |
| `HIVE_SENSOR_ONLINE_MINUTES` | Rail "online" window. Default `5`. This is **log freshness**, not "container is up". |
| `DOCKER_GID` | Host `docker` group GID (`getent group docker`). Needed for Config → Apply. |
| `VITE_MAPBOX_TOKEN` | Public Mapbox `pk.` token in **this root `.env`** so `docker compose build` bakes it into the UI. |

URL-restrict the Mapbox token to `http://127.0.0.1:8443`, `http://10.0.10.4:8443`, and `http://10.0.20.3:8443` (plus `http://localhost:5173` for Vite).

```bash
# Dashboard
docker compose up -d --build

# Bait sensors (same host, separate project)
docker compose -f docker-compose.sensors.yml up -d
```

Open **http://10.0.20.3:8443** or **http://10.0.10.4:8443** on the LAN, or **http://127.0.0.1:8443** locally.
Sign in with `HIVE_USER` / `HIVE_PASSWORD`. Hard-refresh after a UI rebuild.

### Dashboard bind

`hive-ui` publishes `:8443` on specific addresses only — never `0.0.0.0`.

| Address | Interface | Who can open it |
|---|---|---|
| `127.0.0.1:8443` | loopback | This host |
| `10.0.10.4:8443` | `wlp58s0` | `10.0.10.0/24` (UFW) |
| `10.0.20.3:8443` | `enx68e43b309f1c` | `10.0.20.0/24` (UFW) |

Bait listeners stay on `10.0.10.4`. Adding another mgmt NIC means a compose
`ports:` line, a UFW allow from that subnet to `8443/tcp`, the CORS origin in
`backend/app/main.py`, and the same URL on the Mapbox token restriction.

```bash
docker compose ps
docker compose logs -f api
docker compose -f docker-compose.sensors.yml ps
```

Rebuild the UI whenever you change `VITE_MAPBOX_TOKEN`. Stop the dashboard with
`docker compose down`. That does **not** stop Cowrie/OpenCanary.

Remote operator (if you drop the LAN bind and keep loopback only):

```bash
ssh -L 8443:127.0.0.1:8443 user@mgmt-host
```

For local Vite (no Docker), also copy `frontend/.env.example` → `frontend/.env`.

## Config (bait toggles)

**Config** on the HUD enables or disables the existing catalog only. You cannot
type a new port or bind IP.

| Id | Sensor | Host port |
|---|---|---|
| `cowrie-ssh` | Cowrie | `10.0.10.4:2222` and `10.0.20.3:2222` |
| `ftp` | OpenCanary | 21 |
| `telnet` | OpenCanary | 23 |
| `mysql` | OpenCanary | 3306 |
| `redis` | OpenCanary | 6379 |
| `http` | OpenCanary | 8080 |

SSH/80/443/RDP and other OpenCanary modules stay off. OpenCanary ports stay on `10.0.10.4`.
UFW allows Cowrie `2222/tcp` from `10.0.10.0/24` and `10.0.20.0/24`.

1. Toggle services.
2. **Save** writes `sensors/opencanary.conf` (`*.enabled` only) and `/data/bait.json` (Cowrie flag).
3. **Apply** talks to Docker over `/var/run/docker.sock`: start/stop `hive-cowrie`, restart `hive-opencanary` so it reloads the bind-mounted conf.

Save still persists files if the socket is missing; Apply then returns a clear error.

A sensor can be **listening** on Config and still show **red** on the rail when
nobody has hit it for `HIVE_SENSOR_ONLINE_MINUTES`. Cowrie only appends
`cowrie.json` on SSH sessions, not on process start. OpenCanary logs
`Canary running!!!` on restart, so it often looks online after Apply.

## Point it at VLAN 7 sensors

If sensors run on another host, mount or rsync JSONL under `./data/logs/<sensor_id>/`.

| Sensor     | File on the sensor host                         | Mount here                         |
|------------|--------------------------------------------------|------------------------------------|
| Cowrie     | `/var/log/cowrie/cowrie.json`                    | `./data/logs/cowrie-01/cowrie.json` |
| OpenCanary | configured JSON logger (often `/var/tmp/opencanary/opencanary.log`) | `./data/logs/opencanary-01/opencanary.log` |

On this host the sensor compose already bind-mounts those paths.

1. Copy `sensors.yaml.example` → `sensors.yaml` if you need a fresh list.
   `log_path` is as seen **inside hive-api** (`/logs/...` = `./data/logs/...`).
   `lat`/`lon` are the sensor (homelab), not the attacker.
2. Drop MaxMind databases into `./data/geoip/`:
   - `GeoLite2-City.mmdb`
   - `GeoLite2-ASN.mmdb`
   Sign up at [MaxMind](https://www.maxmind.com/en/geolite2/signup). They are not vendored.
3. Set `HIVE_DEMO=0` once real logs are flowing.

Dionaea and T-Pot Elasticsearch ingest are not in this version.

## Local development (no Docker)

From the repo root, give the API host paths (the checked-in `.env` uses
container paths):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export HIVE_USER=operator
export HIVE_PASSWORD=change-me-now
export HIVE_DEMO=1
export HIVE_DB_PATH=../data/db/hive.sqlite
export HIVE_SENSORS_FILE=../sensors.yaml
export HIVE_GEOIP_CITY=../data/geoip/GeoLite2-City.mmdb
export HIVE_GEOIP_ASN=../data/geoip/GeoLite2-ASN.mmdb
export HIVE_OPENCANARY_CONF=../sensors/opencanary.conf
export HIVE_BAIT_STATE_PATH=../data/db/bait.json

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` and `/ws` to `127.0.0.1:8000`. Config → Apply still needs
a Docker socket the API user can open.

Live HUD tests (Playwright) live in `e2e/`. They need `HIVE_USER`,
`HIVE_PASSWORD`, and a running dashboard. `HIVE_BASE_URL` defaults to
`http://10.0.10.4:8443`; use `http://10.0.20.3:8443` if you test from that NIC.

## API (all REST routes require HTTP Basic)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Process + GeoIP + demo flag |
| GET | `/api/sensors` | Configured sensors + online/offline |
| GET | `/api/events` | Paginated/filterable history |
| GET | `/api/stats` | Countries, ports, time series, protocols |
| GET | `/api/timeline?hours=1` | Minute buckets for the scrubber |
| GET | `/api/summary` | 24h count |
| GET | `/api/bait` | Allowlisted bait toggles + running state |
| PUT | `/api/bait` | Persist allowlisted `enabled` flags only |
| POST | `/api/bait/apply` | start/stop/restart the two sensor containers |
| WS | `/ws/events?token=<base64 user:pass>` | Live normalized events |

`PUT /api/bait` body: `{ "services": { "cowrie-ssh": true, "ftp": false, ... } }`.
Unknown ids return `400`. Ports and bind IPs are not writable.

Browsers cannot set an `Authorization` header on `WebSocket`, so the UI sends
the same Basic credential as a `token` query parameter.

## Port forwarding (WAN)

Forward **bait only**. Do not put the dashboard or the real host on the internet.

| Forward | Port | Why |
|---|---|---|
| Yes | `2222` | Cowrie SSH honeypot (`10.0.10.4` and `10.0.20.3`) |
| Optional | `21` `23` `3306` `6379` `8080` | OpenCanary on `10.0.10.4` only |
| **Never** | `8443` | Hive UI + API. Basic auth is weak if unchanged. The API has the Docker socket. |
| **Never** | `22` | Real host SSH |
| **Never** | `80` `443` `3389` | Host services, not bait |

Router NAT should target the bait IPs above, not `0.0.0.0` on the host. UFW
already limits `:8443` to `10.0.10.0/24` and `10.0.20.0/24`. Do not add
`8443` from Anywhere.

## Security

- Treat every log field as attacker-controlled. The UI renders strings as text
  nodes and strips control characters. There is no `dangerouslySetInnerHTML`.
  Raw lines are length-capped on ingest.
- HTTP Basic is required on every REST call, including `/api/health`.
- Change `HIVE_PASSWORD`. The API refuses to start if user or password is unset.
- Keep the dashboard off the public internet. `:8443` is bound to loopback,
  `10.0.10.4`, and `10.0.20.3` only. Do not forward 8443 from a WAN router.
- `/var/run/docker.sock` in `hive-api` is a privilege boundary. The API only
  start/stops `hive-cowrie` and restarts `hive-opencanary`. A compromised API
  process can still reach the Docker Engine — restrict who can reach `:8443`.
- GeoLite2 is local so attacker IPs are not sent to a third-party API.
- Nginx sends `X-Frame-Options`, `nosniff`, and a strict referrer policy.
- Credentials stay in `sessionStorage` (tab lifetime), not `localStorage`.

## Layout

```
backend/                      FastAPI, tailers, GeoIP, SQLite, bait apply
frontend/                     React + Vite + Tailwind + Mapbox GL
nginx/                        SPA + /api + /ws reverse proxy
docker-compose.yml            hive-api + hive-ui
docker-compose.sensors.yml    hive-cowrie + hive-opencanary
sensors.yaml                  sensor book (ids, log paths, geo)
sensors/opencanary.conf       OpenCanary modules (enabled flags only from Config)
data/logs/                    bind-mount target for sensor JSONL
data/geoip/                   GeoLite2-City.mmdb + GeoLite2-ASN.mmdb
data/db/                      hive.sqlite + bait.json
e2e/                          Playwright against the live HUD
```
