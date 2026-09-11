import { severityColor, severityLabel } from "../lib/colors";
import { sanitizeDisplay } from "../lib/sanitize";
import type { HiveEvent, SensorStatus } from "../types";

export function DetailPanel({
  event,
  sensor,
  sensorEvents,
  onClose,
  onEvent,
}: {
  event: HiveEvent | null;
  sensor: SensorStatus | null;
  sensorEvents: HiveEvent[];
  onClose: () => void;
  onEvent: (event: HiveEvent) => void;
}) {
  if (!event && !sensor) return null;

  return (
    <div
      data-testid="detail-panel"
      className="hive-float absolute bottom-24 left-3 z-30 max-h-[42%] w-[22rem] overflow-auto rounded-card p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-sm font-medium tracking-wide text-hive-ink">{event ? "Hit" : "Sensor"}</p>
        <button
          type="button"
          data-testid="detail-close"
          onClick={onClose}
          className="text-sm text-hive-quiet hover:text-hive-ink"
        >
          Close
        </button>
      </div>
      {event ? <EventDetail event={event} /> : null}
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
                <button
                  type="button"
                  onClick={() => onEvent(item)}
                  className="w-full text-left text-sm text-hive-quiet hover:text-hive-ink"
                >
                  {item.timestamp.slice(11, 19)} {sanitizeDisplay(item.src_ip)} {sanitizeDisplay(item.protocol)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function EventDetail({ event }: { event: HiveEvent }) {
  const rows: [string, string][] = [
    ["IP", sanitizeDisplay(event.src_ip)],
    ["ASN", sanitizeDisplay(event.src_asn) || "—"],
    ["Country", sanitizeDisplay(event.src_country)],
    ["Sensor", sanitizeDisplay(event.sensor_id)],
    ["Protocol", `${sanitizeDisplay(event.protocol)} / ${event.dst_port}`],
    ["Type", sanitizeDisplay(event.event_type)],
    ["Session", sanitizeDisplay(event.session_id) || "—"],
    ["UTC", sanitizeDisplay(event.timestamp)],
  ];
  return (
    <div>
      <p className="mb-3 text-sm font-medium" style={{ color: severityColor(event.severity) }}>
        {severityLabel(event.severity)}
      </p>
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-hive-quiet">{k}</dt>
            <dd
              data-testid={k === "IP" ? "detail-ip" : undefined}
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
