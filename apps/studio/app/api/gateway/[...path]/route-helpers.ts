type HeadersCarrier = { headers: Headers };

const SESSION_TOKEN_COOKIE_NAME = "hyperagent_session_token";

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
    if (key !== SESSION_TOKEN_COOKIE_NAME) continue;
    const value = item.slice(eq + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
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

  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
    return headers;
  }

  const cookieToken = sessionTokenFromCookieHeader(request.headers.get("cookie"));
  if (cookieToken) {
    headers.set("authorization", `Bearer ${cookieToken}`);
  }

  return headers;
}
