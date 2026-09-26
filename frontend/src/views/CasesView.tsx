import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatHiveTime } from "../lib/time";
import type { BriefPayload, SessionCase } from "../types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CasesView({
  token,
  timezone,
  detailOpen = false,
}: {
  token: string;
  timezone: string;
  detailOpen?: boolean;
}) {
  const [brief, setBrief] = useState<BriefPayload | null>(null);
  const [cases, setCases] = useState<SessionCase[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.brief(token), api.cases(token)])
      .then(([note, list]) => {
        if (cancelled) return;
        setBrief(note);
        setCases(list.cases);
        setSelected(list.cases[0]?.session_id ?? null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const active = cases.find((item) => item.session_id === selected) ?? null;

  return (
    <div
      data-testid="cases-view"
      className={`absolute inset-0 flex flex-col gap-4 overflow-hidden p-4 ${detailOpen ? "lg:right-[27.5rem]" : ""}`}
    >
      <Card data-testid="cases-brief">
        <CardHeader>
          <CardTitle>Overnight brief</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-foreground">
            {brief?.paragraph || (error ? "" : "Reading the overnight window…")}
          </p>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <div className={`grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto lg:overflow-hidden ${active ? "lg:grid-cols-[22rem_minmax(0,1fr)]" : ""}`}>
        <ScrollArea className="max-h-72 min-h-0 rounded-xl border border-white/10 lg:h-full lg:max-h-none">
          <div data-testid="cases-list" className="flex flex-col">
            {cases.map((item) => {
              const on = item.session_id === active?.session_id;
              return (
                <button
                  key={item.session_id}
                  type="button"
                  data-testid="case-row"
                  onClick={() => setSelected(item.session_id)}
                  className={`border-b border-white/10 px-4 py-3 text-left ${on ? "bg-white/5" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={item.verdict === "payload" ? "default" : "outline"}>{item.verdict_label}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{formatHiveTime(item.started, timezone)}</span>
                  </div>
                  <p className="mt-2 font-mono text-sm">{item.src_ip || "unknown"}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
                </button>
              );
            })}
            {!error && cases.length === 0 && brief ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No sessions in the retained events yet.</p>
            ) : null}
          </div>
        </ScrollArea>

        {active ? (
          <ScrollArea className="min-h-0 rounded-xl border border-white/10 lg:h-full">
            <article data-testid="case-detail" className="space-y-5 p-5">
              <div>
                <p data-testid="case-verdict" className="text-xs uppercase tracking-wide text-muted-foreground">
                  {active.verdict_label}
                </p>
                <h2 className="mt-1 font-mono text-lg">{active.src_ip || "unknown"}</h2>
                <p data-testid="case-summary" className="mt-3 text-sm leading-6">
                  {active.summary}
                </p>
                {active.cluster_line ? <p className="mt-2 text-sm text-muted-foreground">{active.cluster_line}</p> : null}
              </div>

              {active.commands.length > 0 ? (
                <section>
                  <h3 className="text-sm text-muted-foreground">Commands, in order</h3>
                  <ol className="mt-2 space-y-1 font-mono text-sm">
                    {active.commands.map((command, index) => (
                      <li key={`${index}-${command}`}>
                        {index + 1}. {command}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {active.files.length > 0 ? (
                <section>
                  <h3 className="text-sm text-muted-foreground">Files touched</h3>
                  <ul className="mt-2 space-y-1 font-mono text-sm">
                    {active.files.map((file) => (
                      <li key={file}>{file}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {active.lies.length > 0 ? (
                <section data-testid="case-lies">
                  <h3 className="text-sm text-muted-foreground">What they believed, and what the container did</h3>
                  <div className="mt-2 overflow-hidden rounded-lg border border-white/10">
                    <div className="grid grid-cols-1 border-b border-white/10 bg-[#161616] text-xs text-muted-foreground lg:grid-cols-2">
                      <div className="px-3 py-2">Attacker saw</div>
                      <div className="border-t border-white/10 px-3 py-2 lg:border-l lg:border-t-0">Real effect</div>
                    </div>
                    {active.lies.map((row, index) => (
                      <div key={`${row.timestamp}-${index}`} className="grid grid-cols-1 border-b border-white/10 text-sm last:border-b-0 lg:grid-cols-2">
                        <div className="px-3 py-2">{row.attacker_saw}</div>
                        <div className="border-t border-white/10 px-3 py-2 text-muted-foreground lg:border-l lg:border-t-0">{row.real_effect}</div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </article>
          </ScrollArea>
        ) : null}
      </div>
    </div>
  );
}
