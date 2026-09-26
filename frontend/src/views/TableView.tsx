import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { HitFilters } from "../components/HitFilters";
import { TypeFilter } from "../components/TypeFilter";
import { eventTypeColor, eventTypeLabel } from "../lib/colors";
import { eventSummary, portLabel } from "../lib/eventSummary";
import { formatHiveClock, formatHiveDate, tzAbbrev } from "../lib/time";
import { sanitizeDisplay } from "../lib/sanitize";
import type { EventType, HiveEvent, TimeWindow } from "../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Col = "timestamp" | "event_type" | "src_ip" | "summary" | "dst_port" | "session_id";

export function TableView({
  events,
  typeCounts,
  eventType,
  onEventType,
  timezone,
  timeWindow,
  onTimeWindow,
  srcIp,
  onSrcIp,
  country,
  onCountry,
  dstPort,
  onDstPort,
  sessionId,
  onSessionId,
  ipCounts,
  countryCounts,
  portCounts,
  sessions,
  search,
  onSearch,
  selectedId,
  onSelect,
  page,
  pageCount,
  pageSize,
  total,
  onPage,
  detailOpen = false,
}: {
  events: HiveEvent[];
  typeCounts: Record<string, number>;
  eventType: EventType | null;
  onEventType: (next: EventType | null) => void;
  timezone: string;
  timeWindow: TimeWindow | null;
  onTimeWindow: (next: TimeWindow | null) => void;
  srcIp: string | null;
  onSrcIp: (next: string | null) => void;
  country: string | null;
  onCountry: (next: string | null) => void;
  dstPort: number | null;
  onDstPort: (next: number | null) => void;
  sessionId: string | null;
  onSessionId: (next: string | null) => void;
  ipCounts: Record<string, number>;
  countryCounts: Record<string, number>;
  portCounts: Record<string, number>;
  sessions: string[];
  search: string;
  onSearch: (next: string) => void;
  selectedId: string | null;
  onSelect: (event: HiveEvent) => void;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  detailOpen?: boolean;
}) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "timestamp", dir: -1 });

  const rows = useMemo(() => {
    return [...events].sort((a, b) => {
      const av = sort.col === "summary" ? eventSummary(a) : a[sort.col];
      const bv = sort.col === "summary" ? eventSummary(b) : b[sort.col];
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
  }, [events, sort]);

  const filtered =
    Boolean(eventType || timeWindow || srcIp || country || dstPort != null || sessionId || search.trim());

  function header(col: Col, label: string) {
    return (
      <TableHead>
        <button
          type="button"
          data-testid={`table-sort-${col}`}
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() =>
            setSort((prev) => (prev.col === col ? { col, dir: prev.dir === 1 ? -1 : 1 } : { col, dir: -1 }))
          }
        >
          {label}
          {sort.col === col ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
        </button>
      </TableHead>
    );
  }

  function clearFilters() {
    onEventType(null);
    onTimeWindow(null);
    onSrcIp(null);
    onCountry(null);
    onDstPort(null);
    onSessionId(null);
    onSearch("");
  }

  return (
    <div
      data-testid="table-view"
      className={`absolute bottom-0 left-0 top-0 flex flex-col bg-background p-4 ${detailOpen ? "right-[27.5rem]" : "right-0"}`}
    >
      <div className="mb-3 flex flex-col gap-3">
        <TypeFilter value={eventType} counts={typeCounts} onChange={onEventType} />
        <HitFilters
          timezone={timezone}
          timeWindow={timeWindow}
          onTimeWindow={onTimeWindow}
          srcIp={srcIp}
          onSrcIp={onSrcIp}
          country={country}
          onCountry={onCountry}
          dstPort={dstPort}
          onDstPort={onDstPort}
          sessionId={sessionId}
          onSessionId={onSessionId}
          ipCounts={ipCounts}
          countryCounts={countryCounts}
          portCounts={portCounts}
          sessions={sessions}
          search={search}
          onSearch={onSearch}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10 bg-card">
        {rows.length === 0 ? (
          <div data-testid="table-empty" className="px-4 py-10 text-center text-sm text-muted-foreground">
            <p>No hits match these filters.</p>
            {filtered ? (
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {header("event_type", "Type")}
                {header("timestamp", `Time (${tzAbbrev(timezone)})`)}
                {header("src_ip", "Source")}
                {header("summary", "What happened")}
                {header("dst_port", "Port")}
                {header("session_id", "Session")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((event) => {
                const selected = selectedId === event.id;
                const accent = eventTypeColor(event.event_type);
                const summary = eventSummary(event);
                return (
                  <TableRow
                    key={event.id}
                    data-testid="table-row"
                    onClick={() => onSelect(event)}
                    className={`cursor-pointer ${selected ? "bg-white/5" : ""}`}
                    style={{ boxShadow: `inset 3px 0 0 ${accent}` }}
                  >
                    <TableCell>
                      <Badge
                        data-testid="table-type"
                        variant="outline"
                        className="font-medium"
                        style={{ color: accent, borderColor: accent }}
                      >
                        {eventTypeLabel(event.event_type)}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid="table-time" className="font-mono text-foreground">
                      <div>{formatHiveClock(event.timestamp, timezone)}</div>
                      <div className="text-xs text-muted-foreground">{formatHiveDate(event.timestamp, timezone)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-foreground">
                        <FilterValue
                          label={sanitizeDisplay(event.src_ip)}
                          onPick={() => onSrcIp(event.src_ip)}
                          testid="table-ip"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <FilterValue
                          label={sanitizeDisplay(event.src_country) || "UNK"}
                          onPick={() => onCountry(event.src_country)}
                          testid="table-country"
                        />
                      </div>
                    </TableCell>
                    <TableCell data-testid="table-summary" className="max-w-[28rem] text-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate">{summary}</span>
                        </TooltipTrigger>
                        <TooltipContent>{summary}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      <FilterValue
                        label={portLabel(event.dst_port, event.protocol)}
                        onPick={() => onDstPort(event.dst_port)}
                        testid="table-port"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {event.session_id ? (
                        <FilterValue
                          label={sanitizeDisplay(event.session_id)}
                          onPick={() => onSessionId(event.session_id)}
                          testid="table-session"
                        />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div data-testid="table-pager" className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-muted-foreground">
          {total === 0 ? "0 hits" : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total}`}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <PagerButton testid="table-page-prev" disabled={page <= 0} onClick={() => onPage(page - 1)}>
            Prev
          </PagerButton>
          {pageWindow(page, pageCount).map((item, i) =>
            item === "gap" ? (
              <span key={`gap-${i}`} className="px-1 font-mono text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <PagerButton key={item} testid={`table-page-${item}`} active={item - 1 === page} onClick={() => onPage(item - 1)}>
                {item}
              </PagerButton>
            ),
          )}
          <PagerButton testid="table-page-next" disabled={page + 1 >= pageCount} onClick={() => onPage(page + 1)}>
            Next
          </PagerButton>
        </div>
      </div>
    </div>
  );
}

function FilterValue({ label, onPick, testid }: { label: string; onPick: () => void; testid: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <span className="truncate">{label}</span>
      <button
        type="button"
        data-testid={testid}
        title="Filter to this value"
        className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
        onClick={(ev) => {
          ev.stopPropagation();
          onPick();
        }}
      >
        <Filter className="h-3 w-3" />
      </button>
    </span>
  );
}

function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  const current = page + 1;
  if (pageCount <= 0) return [];
  if (pageCount <= 9) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const items: (number | "gap")[] = [1];
  const start = Math.max(2, current - 2);
  const end = Math.min(pageCount - 1, current + 2);
  if (start > 2) items.push("gap");
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < pageCount - 1) items.push("gap");
  items.push(pageCount);
  return items;
}

function PagerButton({
  children,
  onClick,
  disabled,
  active,
  testid,
}: {
  children: string | number;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  testid: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
      className="min-w-8"
    >
      {children}
    </Button>
  );
}
