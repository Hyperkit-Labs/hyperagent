export const SESSION_TOKEN_COOKIE_NAMES = [
  "hyperagent_session_token",
  "rt",
] as const;

export function sessionTokenFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const item = part.trim();
    if (!item) continue;
    const eq = item.indexOf("=");
    if (eq <= 0) continue;
    const key = item.slice(0, eq).trim();
    if (
      !SESSION_TOKEN_COOKIE_NAMES.includes(
        key as (typeof SESSION_TOKEN_COOKIE_NAMES)[number],
      )
    ) {
      continue;
    }
    const value = item.slice(eq + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}
