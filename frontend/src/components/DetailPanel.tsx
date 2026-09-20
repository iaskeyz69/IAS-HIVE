import { eventTypeColor, eventTypeLabel, severityColor } from "../lib/colors";
import { eventKind, eventMeta, eventSummary, loginOutcome } from "../lib/eventSummary";
import { formatHiveClock, formatHiveTime, tzAbbrev } from "../lib/time";
import { sanitizeDisplay } from "../lib/sanitize";
import type { HiveEvent, SensorStatus } from "../types";

export function DetailPanel({
  event,
  sensor,
  sensorEvents,
  onClose,
  onEvent,
  timezone,
}: {
  event: HiveEvent | null;
  sensor: SensorStatus | null;
  sensorEvents: HiveEvent[];
  onClose: () => void;
  onEvent: (event: HiveEvent) => void;
  timezone: string;
}) {
  if (!event && !sensor) return null;

  return (
    <div
      data-testid="detail-panel"
      className="hive-float absolute bottom-24 left-3 z-30 max-h-[42%] w-[22rem] overflow-auto rounded-card p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-sm font-medium tracking-wide text-hive-ink">{event ? "Hit" : "Sensor"}</p>
        <button type="button" data-testid="detail-close" onClick={onClose} className="text-sm text-hive-quiet hover:text-hive-ink">
          Close
        </button>
      </div>
      {event ? <EventDetail event={event} timezone={timezone} /> : null}
      {sensor && !event ? (
        <div>
          <p data-testid="detail-sensor-label" className="text-hive-ink">
            {sanitizeDisplay(sensor.label)}
          </p>
          <p className="text-sm text-hive-quiet">
            {sensor.lat.toFixed(4)}, {sensor.lon.toFixed(4)} · {sanitizeDisplay(sensor.type)}
          </p>
          <ul className="mt-3 space-y-1">
            {sensorEvents.slice(0, 12).map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onEvent(item)} className="w-full text-left text-sm text-hive-quiet hover:text-hive-ink">
                  {formatHiveClock(item.timestamp, timezone)} {sanitizeDisplay(item.src_ip)} {eventSummary(item)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function EventDetail({ event, timezone }: { event: HiveEvent; timezone: string }) {
  const obj = eventMeta(event);
  const username = String(obj.username ?? "");
  const password = String(obj.password ?? "");
  const input = String(obj.input ?? "");
  const dest = String(obj.destfile ?? obj.outfile ?? "");
  const shasum = String(obj.shasum ?? "");
  const outcome = loginOutcome(event);
  const kind = eventKind(event);
  const rows: [string, string][] = [
    ["IP", sanitizeDisplay(event.src_ip)],
    ["ASN", sanitizeDisplay(event.src_asn) || "—"],
    ["Country", sanitizeDisplay(event.src_country)],
    ["Sensor", sanitizeDisplay(event.sensor_id)],
    ["Protocol", `${sanitizeDisplay(event.protocol)} / ${event.dst_port}`],
    ["Type", eventTypeLabel(event.event_type)],
    ["Event", sanitizeDisplay(kind) || "—"],
    ["What", eventSummary(event)],
    ["Session", sanitizeDisplay(event.session_id) || "—"],
    [`Time (${tzAbbrev(timezone)})`, formatHiveTime(event.timestamp, timezone)],
    ["UTC", sanitizeDisplay(event.timestamp)],
  ];
  if (username || password) rows.splice(6, 0, ["Credential", sanitizeDisplay(`${username}/${password}`)]);
  if (outcome) rows.splice(6, 0, ["Login", outcome === "success" ? "success" : "failed"]);
  if (input) rows.splice(6, 0, ["Command", sanitizeDisplay(input)]);
  if (dest) rows.splice(6, 0, ["File", sanitizeDisplay(dest)]);
  if (shasum) rows.splice(6, 0, ["SHA-256", sanitizeDisplay(shasum)]);

  return (
    <div>
      <p className="mb-3 text-sm font-medium" style={{ color: eventTypeColor(event.event_type) }}>
        {eventTypeLabel(event.event_type)}
        <span className="ml-2 text-xs" style={{ color: severityColor(event.severity) }}>
          {event.severity}
        </span>
      </p>
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-hive-quiet">{k}</dt>
            <dd
              data-testid={k === "IP" ? "detail-ip" : k === "What" ? "detail-summary" : undefined}
              className="min-w-0 break-all text-right text-hive-ink"
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 font-mono text-xs font-medium uppercase tracking-wide text-hive-quiet">Raw</p>
      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-hive-bg p-2 text-[11px] leading-5 text-hive-ink">
        {sanitizeDisplay(event.raw)}
      </pre>
    </div>
  );
}
