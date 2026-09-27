import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import type { BaitService } from "../types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export function ConfigView({ token, detailOpen = false }: { token: string; detailOpen?: boolean }) {
  const [rows, setRows] = useState<BaitService[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [bind, setBind] = useState("10.0.20.3");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .bait(token)
      .then((payload) => {
        setRows(payload.services);
        setSaved(Object.fromEntries(payload.services.map((row) => [row.id, row.enabled])));
        setBind(payload.bind);
      })
      .catch((err: Error) => setError(err.message));
  }, [token]);

  const dirty = useMemo(
    () => rows.some((row) => saved[row.id] !== row.enabled),
    [rows, saved],
  );

  function toggle(id: string) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, enabled: !row.enabled } : row)));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const payload = await api.saveBait(
        token,
        Object.fromEntries(rows.map((row) => [row.id, row.enabled])),
      );
      setRows(payload.services);
      setSaved(Object.fromEntries(payload.services.map((row) => [row.id, row.enabled])));
      toast.success("Saved. Apply to start or stop the bait containers.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (dirty) {
      toast.message("Save first. Apply uses the last saved flags, not unsaved toggles.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.applyBait(token);
      setRows(result.services);
      setSaved(Object.fromEntries(result.services.map((row) => [row.id, row.enabled])));
      if (!result.ok) setError(result.error || "Apply failed");
      else toast.success(result.actions.join(" · ") || "Applied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-testid="config-view"
      className={`absolute bottom-0 left-0 top-0 overflow-auto bg-background p-4 ${detailOpen ? "lg:right-[27.5rem]" : "right-0"}`}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Bait ports</p>
          <p className="mt-1 text-sm text-muted-foreground">
            LAN bind {bind}. Toggles only the existing Cowrie/OpenCanary services. Real SSH on 22 stays closed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" data-testid="bait-save" disabled={busy} onClick={() => void save()}>
            Save
          </Button>
          <Button type="button" variant="outline" data-testid="bait-apply" disabled={busy || dirty} onClick={() => void apply()}>
            Apply
          </Button>
        </div>
      </div>
      {dirty ? <p className="mb-3 text-sm text-muted-foreground">Unsaved changes — Save before Apply</p> : null}
      {error ? (
        <p data-testid="bait-error" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.map((row) => (
          <Card key={row.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm text-foreground">{row.label}</p>
              <p className="font-mono text-xs text-muted-foreground">
                :{row.port} · {row.sensor}
                {row.running == null ? "" : row.running ? " · listening" : " · stopped"}
              </p>
            </div>
            <Switch
              data-testid={`bait-toggle-${row.id}`}
              checked={row.enabled}
              onCheckedChange={() => toggle(row.id)}
              aria-label={row.label}
            />
          </Card>
        ))}
      </ul>
    </div>
  );
}
