import { FormEvent, useState } from "react";
import { api, AuthError } from "../lib/api";
import { clearAuth, saveAuth } from "../lib/auth";

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
      clearAuth();
      if (err instanceof AuthError) setError("Wrong user or password");
      else setError("Hive is unreachable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-hive-bg px-4">
      <form data-testid="login-form" onSubmit={submit} className="hive-float w-full max-w-sm rounded-card p-6">
        <p className="font-mono text-lg font-semibold tracking-[0.28em] text-hive-cyan">HIVE</p>
        <p className="mt-2 text-sm text-hive-quiet">Sign in to watch the bait sensors.</p>
        <label className="mt-6 block font-mono text-xs tracking-wide text-hive-quiet" htmlFor="operator">
          Operator
        </label>
        <input
          id="operator"
          data-testid="login-user"
          className="mt-1 w-full rounded-lg bg-hive-bg px-3 py-2 text-sm text-hive-ink outline-none ring-1 ring-hive-line focus:ring-hive-cyan"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
          required
        />
        <label className="mt-4 block font-mono text-xs tracking-wide text-hive-quiet" htmlFor="passphrase">
          Password
        </label>
        <input
          id="passphrase"
          data-testid="login-pass"
          type="password"
          className="mt-1 w-full rounded-lg bg-hive-bg px-3 py-2 text-sm text-hive-ink outline-none ring-1 ring-hive-line focus:ring-hive-cyan"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error ? (
          <p data-testid="login-error" role="alert" className="mt-3 text-sm text-hive-sting">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          data-testid="login-submit"
          disabled={busy}
          className="mt-6 w-full rounded-full bg-hive-cyan py-2.5 text-sm font-medium text-hive-bg hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Checking" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
