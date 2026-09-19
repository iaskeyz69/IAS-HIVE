import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { BaitService } from "../types";

export function ConfigView({ token }: { token: string }) {
  const [rows, setRows] = useState<BaitService[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [bind, setBind] = useState("10.0.10.4");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
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
    setNote("");
  }

  async function save() {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const payload = await api.saveBait(
        token,
        Object.fromEntries(rows.map((row) => [row.id, row.enabled])),
      );
      setRows(payload.services);
      setSaved(Object.fromEntries(payload.services.map((row) => [row.id, row.enabled])));
      setNote("Saved. Apply to start or stop the bait containers.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (dirty) {
      setNote("Save first. Apply uses the last saved flags, not unsaved toggles.");
      return;
    }
    setBusy(true);
    setError("");
    setNote("");
    try {
      const result = await api.applyBait(token);
      setRows(result.services);
      setSaved(Object.fromEntries(result.services.map((row) => [row.id, row.enabled])));
      if (!result.ok) setError(result.error || "Apply failed");
      else setNote(result.actions.join(" · ") || "Applied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="config-view" className="absolute inset-0 overflow-auto bg-hive-bg p-4 pb-20 pl-[19.5rem] pr-4 pt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-sm tracking-[0.18em] text-hive-cyan">BAIT PORTS</p>
          <p className="mt-1 text-sm text-hive-quiet">
            LAN bind {bind}. Toggles only the existing Cowrie/OpenCanary services. Real SSH on 22 stays closed.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="bait-save"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-full bg-hive-cyan px-4 py-2 font-mono text-xs text-hive-bg disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            data-testid="bait-apply"
            disabled={busy || dirty}
            onClick={() => void apply()}
            className="rounded-full bg-[#00E676] px-4 py-2 font-mono text-xs text-black disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
      {dirty ? <p className="mb-3 text-sm text-hive-quiet">Unsaved changes — Save before Apply</p> : null}
      {note ? <p className="mb-3 text-sm text-hive-rec">{note}</p> : null}
      {error ? (
        <p data-testid="bait-error" className="mb-3 text-sm text-hive-sting">
          {error}
        </p>
      ) : null}
      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.map((row) => (
          <li key={row.id} className="hive-float flex items-center justify-between rounded-card px-4 py-3">
            <div>
              <p className="text-sm text-hive-ink">{row.label}</p>
              <p className="font-mono text-xs text-hive-quiet">
                :{row.port} · {row.sensor}
                {row.running == null ? "" : row.running ? " · listening" : " · stopped"}
              </p>
            </div>
            <button
              type="button"
              data-testid={`bait-toggle-${row.id}`}
              role="switch"
              aria-checked={row.enabled}
              onClick={() => toggle(row.id)}
              className={`relative h-7 w-12 rounded-full ${row.enabled ? "bg-hive-cyan" : "bg-hive-line"}`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
                  row.enabled ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
