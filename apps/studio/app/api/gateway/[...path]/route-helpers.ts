type HeadersCarrier = { headers: Headers };

const SESSION_TOKEN_COOKIE_NAMES = ["hyperagent_session_token", "rt"] as const;
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9._:-]{1,128}$/;

export function sessionTokenFromCookieHeader(
  cookieHeader: string | null,
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

export function sanitizeGatewayPathSegments(path: string[]): string[] {
  if (!Array.isArray(path) || path.length === 0) {
    throw new Error("gateway.invalid_path");
  }
  return path.map((segment) => {
    const normalized = segment.trim();
    if (
      !normalized ||
      normalized === "." ||
      normalized === ".." ||
      !SAFE_PATH_SEGMENT.test(normalized)
    ) {
      throw new Error("gateway.invalid_path_segment");
    }
    return normalized;
  });
}

export function buildUpstreamHeaders(request: HeadersCarrier): Headers {
  const headers = new Headers();
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const xRequestId = request.headers.get("x-request-id");
  if (xRequestId) headers.set("x-request-id", xRequestId);

  const xWorkspaceId = request.headers.get("x-workspace-id");
  if (xWorkspaceId) headers.set("x-workspace-id", xWorkspaceId);

  const xAgentSession = request.headers.get("x-agent-session");
  if (xAgentSession) headers.set("x-agent-session", xAgentSession);

  const traceparent = request.headers.get("traceparent");
  if (traceparent) headers.set("traceparent", traceparent);

  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
    return headers;
  }

  const cookieToken = sessionTokenFromCookieHeader(
    request.headers.get("cookie"),
  );
  if (cookieToken) {
    headers.set("authorization", `Bearer ${cookieToken}`);
  }

  return headers;
}
