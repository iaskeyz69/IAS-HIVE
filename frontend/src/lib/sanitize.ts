/** Strip control chars from attacker-controlled strings. Render as text only. */
export function sanitizeDisplay(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "");
}
