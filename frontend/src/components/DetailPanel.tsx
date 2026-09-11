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
    <div className="absolute inset-x-4 bottom-4 z-20 max-h-[42%] overflow-auto border border-hive-line bg-hive-bg/95 p-4 md:inset-auto md:right-4 md:top-14 md:w-80">
      <div className="mb-2 flex items-center justify-between">
        <p className="label-hud text-hive-gold">{event ? "ATTACKER" : "SENSOR FEED"}</p>
        <button type="button" onClick={onClose} className="label-hud hover:text-white">
          CLOSE
        </button>
      </div>
      {event ? <EventDetail event={event} /> : null}
      {sensor && !event ? (
        <div>
          <p className="font-sans text-sm text-white">{sanitizeDisplay(sensor.label)}</p>
          <p className="font-mono text-xs text-hive-muted">
            {sensor.lat.toFixed(4)}, {sensor.lon.toFixed(4)} · {sanitizeDisplay(sensor.type)}
          </p>
          <ul className="mt-3 space-y-1">
            {sensorEvents.slice(0, 12).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onEvent(item)}
                  className="w-full text-left font-mono text-[11px] text-hive-muted hover:text-white"
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
    ["COUNTRY", sanitizeDisplay(event.src_country)],
    ["SENSOR", sanitizeDisplay(event.sensor_id)],
    ["PROTOCOL", `${sanitizeDisplay(event.protocol)} / ${event.dst_port}`],
    ["TYPE", sanitizeDisplay(event.event_type)],
    ["SESSION", sanitizeDisplay(event.session_id) || "—"],
    ["UTC", sanitizeDisplay(event.timestamp)],
  ];
  return (
    <div>
      <p className="mb-2 font-mono text-xs" style={{ color: severityColor(event.severity) }}>
        {severityLabel(event.severity)}
      </p>
      <dl className="space-y-1 font-mono text-[11px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-hive-muted">{k}</dt>
            <dd className="truncate text-right text-white">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="label-hud mt-3">RAW</p>
      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-hive-muted">
        {sanitizeDisplay(event.raw)}
      </pre>
    </div>
  );
}
