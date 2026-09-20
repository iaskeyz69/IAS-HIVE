import { useMemo, useRef, useState, type MouseEvent } from "react";
import { formatHiveTime } from "../lib/time";
import type { TimelineBucket, TimeWindow } from "../types";

export function TimelineScrubber({
  buckets,
  window,
  onChange,
  timezone,
}: {
  buckets: TimelineBucket[];
  window: TimeWindow | null;
  onChange: (window: TimeWindow | null) => void;
  timezone: string;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const drag = useRef<{ start: number; end: number } | null>(null);
  const [preview, setPreview] = useState<[number, number] | null>(null);

  function endOfMinute(iso: string): string {
    const d = new Date(iso);
    d.setUTCSeconds(59, 999);
    return d.toISOString();
  }

  const selected = useMemo(() => {
    if (preview) return preview;
    if (!window) return null;
    const from = buckets.findIndex((b) => b.t >= window.from);
    const to = buckets.findIndex((b) => b.t > window.to);
    return [from === -1 ? 0 : from, to === -1 ? buckets.length - 1 : to - 1] as [number, number];
  }, [buckets, preview, window]);

  function idxFromEvent(ev: MouseEvent<HTMLDivElement>) {
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(ev.clientX - rect.left, 0), rect.width - 1);
    return Math.floor((x / rect.width) * buckets.length);
  }

  function commit(a: number, b: number) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const from = buckets[lo]?.t;
    const to = buckets[hi]?.t;
    if (from && to) onChange({ from, to: endOfMinute(to) });
  }

  return (
    <div data-testid="timeline" className="hive-float flex h-14 items-center gap-4 rounded-card px-4">
      <div className="w-24 shrink-0">
        <p className="font-mono text-sm text-hive-ink">Last hour</p>
        <button
          type="button"
          data-testid="timeline-live"
          className="text-sm text-hive-quiet hover:text-hive-cyan"
          onClick={() => onChange(null)}
        >
          {window ? "Clear window" : "Live"}
        </button>
      </div>
      <div
        data-testid="timeline-bars"
        className="flex h-8 flex-1 cursor-ew-resize items-end gap-px"
        onMouseDown={(ev) => {
          const i = idxFromEvent(ev);
          drag.current = { start: i, end: i };
          setPreview([i, i]);
        }}
        onMouseMove={(ev) => {
          if (!drag.current) return;
          const i = idxFromEvent(ev);
          drag.current.end = i;
          setPreview([drag.current.start, i]);
        }}
        onMouseUp={() => {
          if (drag.current) commit(drag.current.start, drag.current.end);
          drag.current = null;
          setPreview(null);
        }}
        onMouseLeave={() => {
          if (drag.current) commit(drag.current.start, drag.current.end);
          drag.current = null;
          setPreview(null);
        }}
      >
        {buckets.map((bucket, i) => {
          const active =
            selected && i >= Math.min(selected[0], selected[1]) && i <= Math.max(selected[0], selected[1]);
          const h = Math.max(2, Math.round((bucket.count / max) * 28));
          return (
            <div
              key={bucket.t}
              title={`${formatHiveTime(bucket.t, timezone)} · ${bucket.count}`}
              className={`flex-1 ${active ? "bg-hive-blue" : "bg-hive-blue/30"}`}
              style={{ height: h }}
            />
          );
        })}
      </div>
    </div>
  );
}
