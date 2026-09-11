const KEY = "hive_auth";

export function loadAuth(): string | null {
  return sessionStorage.getItem(KEY);
}

export function saveAuth(username: string, password: string): string {
  const token = btoa(`${username}:${password}`);
  sessionStorage.setItem(KEY, token);
  return token;
}

export function clearAuth(): void {
  sessionStorage.removeItem(KEY);
}

export function authHeader(token: string): HeadersInit {
  return { Authorization: `Basic ${token}` };
}
