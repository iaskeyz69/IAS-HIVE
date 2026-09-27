import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { eventTypeColor, eventTypeLabel, severityColor } from "../lib/colors";
import { eventKind, eventMeta, eventSummary, loginOutcome } from "../lib/eventSummary";
import { formatHiveClock, formatHiveTime, tzAbbrev } from "../lib/time";
import { sanitizeDisplay } from "../lib/sanitize";
import type { HiveEvent, SensorStatus } from "../types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
    <Sheet open modal={false} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        overlay={false}
        data-testid="detail-panel"
        className="bottom-[4.75rem] left-3 right-3 top-[7.25rem] h-auto w-auto max-w-none overflow-hidden rounded-xl lg:bottom-20 lg:left-auto lg:right-3 lg:top-[4.25rem] lg:w-[26rem] lg:max-w-[calc(100vw-1.5rem)]"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="flex items-center justify-between gap-3 pr-2">
          <SheetTitle className="text-sm font-medium">{event ? "Hit" : "Sensor"}</SheetTitle>
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="sm" data-testid="detail-close">
              Close
            </Button>
          </SheetClose>
        </div>
        <Separator />
        <ScrollArea className="min-h-0 flex-1">
          {event ? <EventDetail event={event} timezone={timezone} /> : null}
          {sensor && !event ? (
            <div>
              <p data-testid="detail-sensor-label" className="text-foreground">
                {sanitizeDisplay(sensor.label)}
              </p>
              <p className="text-sm text-muted-foreground">
                {sensor.lat.toFixed(4)}, {sensor.lon.toFixed(4)} · {sanitizeDisplay(sensor.type)}
              </p>
              <ul className="mt-3 space-y-1">
                {sensorEvents.slice(0, 12).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onEvent(item)}
                      className="w-full text-left text-sm text-muted-foreground hover:text-foreground"
                    >
                      <span className="font-mono">{formatHiveClock(item.timestamp, timezone)}</span> {sanitizeDisplay(item.src_ip)}{" "}
                      {eventSummary(item)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function copyValue(value: string, label: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`Copied ${label}`),
    () => toast.error(`Could not copy ${label}`),
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
  const rows: { key: string; value: string; copy?: boolean; testid?: string }[] = [
    { key: "IP", value: sanitizeDisplay(event.src_ip), copy: true, testid: "detail-ip" },
    { key: "ASN", value: sanitizeDisplay(event.src_asn) || "—" },
    { key: "Country", value: sanitizeDisplay(event.src_country) },
    { key: "Sensor", value: sanitizeDisplay(event.sensor_id) },
    { key: "Protocol", value: `${sanitizeDisplay(event.protocol)} / ${event.dst_port}` },
    { key: "Type", value: eventTypeLabel(event.event_type) },
    { key: "Event", value: sanitizeDisplay(kind) || "—" },
    { key: "What", value: eventSummary(event), testid: "detail-summary" },
    { key: "Session", value: sanitizeDisplay(event.session_id) || "—", copy: Boolean(event.session_id) },
    { key: `Time (${tzAbbrev(timezone)})`, value: formatHiveTime(event.timestamp, timezone) },
    { key: "UTC", value: sanitizeDisplay(event.timestamp) },
  ];
  if (username || password) rows.splice(6, 0, { key: "Credential", value: sanitizeDisplay(`${username}/${password}`) });
  if (outcome) rows.splice(6, 0, { key: "Login", value: outcome === "success" ? "success" : "failed" });
  if (input) rows.splice(6, 0, { key: "Command", value: sanitizeDisplay(input), copy: true });
  if (dest) rows.splice(6, 0, { key: "File", value: sanitizeDisplay(dest) });
  if (shasum) rows.splice(6, 0, { key: "SHA-256", value: sanitizeDisplay(shasum) });

  const raw = prettyRaw(event.raw);
  const copies = [
    { label: "IP", value: sanitizeDisplay(event.src_ip) },
    event.session_id ? { label: "Session", value: sanitizeDisplay(event.session_id) } : null,
    input ? { label: "Command", value: sanitizeDisplay(input) } : null,
    { label: "Raw event", value: raw },
  ].filter((item): item is { label: string; value: string } => Boolean(item?.value));

  return (
    <div className="pr-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium" style={{ color: eventTypeColor(event.event_type) }}>
          {eventTypeLabel(event.event_type)}
          <span className="ml-2 text-xs" style={{ color: severityColor(event.severity) }}>
            {event.severity}
          </span>
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {copies.map((item) => (
              <DropdownMenuItem key={item.label} onSelect={() => copyValue(item.value, item.label)}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <dl className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.key} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">{row.key}</dt>
            <dd data-testid={row.testid} className="flex min-w-0 items-start justify-end gap-1 break-all text-right font-mono text-foreground">
              <span>{row.value}</span>
              {row.copy && row.value && row.value !== "—" ? (
                <button
                  type="button"
                  className="mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  title={`Copy ${row.key}`}
                  onClick={() => copyValue(row.value, row.key)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs font-medium uppercase text-muted-foreground">Raw</p>
        <button
          type="button"
          className="rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          title="Copy raw event"
          onClick={() => copyValue(raw, "raw event")}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <pre className="mt-1 max-h-56 overflow-auto rounded-lg border border-white/10 bg-[#111111] p-3 font-mono text-xs leading-5 text-white/70">
        {raw.split("\n").map((line, index) => (
          <span key={index} className="flex gap-3">
            <span className="w-6 shrink-0 select-none text-right text-white/30">{index + 1}</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">{highlightJson(line)}</span>
          </span>
        ))}
      </pre>
    </div>
  );
}

function prettyRaw(raw: string): string {
  const text = sanitizeDisplay(raw);
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function highlightJson(line: string): ReactNode {
  const nodes: ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(line))) {
    if (match.index > last) nodes.push(<span key={i++}>{line.slice(last, match.index)}</span>);
    const full = match[0];
    const str = match[1];
    const colon = match[2];
    if (str && colon) {
      nodes.push(
        <span key={i++} className="text-white/75">
          {str}
        </span>,
      );
      nodes.push(
        <span key={i++} className="text-white/40">
          {colon}
        </span>,
      );
    } else if (str) {
      nodes.push(
        <span key={i++} className="text-[#fafaf9]">
          {str}
        </span>,
      );
    } else {
      nodes.push(
        <span key={i++} className="text-white/80">
          {full}
        </span>,
      );
    }
    last = match.index + full.length;
  }
  if (last < line.length) nodes.push(<span key={i++}>{line.slice(last)}</span>);
  return nodes;
}
