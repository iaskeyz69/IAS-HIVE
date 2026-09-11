import { FormEvent, useState } from "react";
import { api, AuthError } from "../lib/api";
import { saveAuth } from "../lib/auth";

export function Login({ onAuthed }: { onAuthed: (token: string) => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    const token = saveAuth(user, password);
    try {
      await api.health(token);
      onAuthed(token);
    } catch (err) {
      if (err instanceof AuthError) setError("ACCESS DENIED");
      else setError("LINK DOWN");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-hive-bg">
      <form
        onSubmit={submit}
        className="hud-corners w-[380px] border border-hive-line bg-hive-panel p-8"
      >
        <span className="c-br" />
        <span className="c-bl" />
        <p className="label-hud text-hive-gold">IAS HIVE</p>
        <h1 className="mt-2 font-sans text-xl tracking-wide text-white">COMMAND CENTER</h1>
        <p className="mt-2 font-mono text-xs text-hive-muted">AUTHENTICATE TO CONTINUE</p>
        <label className="label-hud mt-6 block">OPERATOR</label>
        <input
          className="mt-1 w-full border border-hive-line bg-hive-bg px-3 py-2 font-mono text-sm text-white outline-none focus:border-hive-gold"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
          required
        />
        <label className="label-hud mt-4 block">PASSPHRASE</label>
        <input
          type="password"
          className="mt-1 w-full border border-hive-line bg-hive-bg px-3 py-2 font-mono text-sm text-white outline-none focus:border-hive-gold"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error ? <p className="mt-3 font-mono text-xs text-hive-threat">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full border border-hive-gold bg-hive-gold/10 py-2 font-sans text-xs tracking-hud text-hive-gold hover:bg-hive-gold/20 disabled:opacity-50"
        >
          {busy ? "CHECKING" : "ENGAGE"}
        </button>
      </form>
    </div>
  );
}
