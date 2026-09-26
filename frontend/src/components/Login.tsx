import { FormEvent, useState } from "react";
import { api, AuthError } from "../lib/api";
import { clearAuth, saveAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="flex h-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <form data-testid="login-form" onSubmit={submit} className="p-6">
          <p className="text-2xl font-medium">Hive</p>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to watch the bait sensors.</p>
          <Label className="mt-6 block" htmlFor="operator">
            Operator
          </Label>
          <Input
            id="operator"
            data-testid="login-user"
            className="mt-1.5"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            required
          />
          <Label className="mt-4 block" htmlFor="passphrase">
            Password
          </Label>
          <Input
            id="passphrase"
            data-testid="login-pass"
            type="password"
            className="mt-1.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error ? (
            <p data-testid="login-error" role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" data-testid="login-submit" disabled={busy} className="mt-6 w-full">
            {busy ? "Checking" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
