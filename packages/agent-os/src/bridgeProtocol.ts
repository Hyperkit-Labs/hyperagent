/**
 * Bridge protocol: remote session lifecycle, heartbeat, reconnect state machine.
 * Separates transport from execution. The control plane uses these types to manage
 * session spawning, health monitoring, and graceful shutdown.
 */

export const SESSION_STATES = [
  "spawning",
  "active",
  "reconnecting",
  "draining",
  "terminated",
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export const BRIDGE_EVENTS = [
  "session_spawned",
  "heartbeat",
  "reconnect",
  "shutdown",
  "error",
] as const;
export type BridgeEvent = (typeof BRIDGE_EVENTS)[number];

export interface HeartbeatPayload {
  sessionId: string;
  timestamp: number;
  taskCount: number;
  memoryUsageMb: number;
}

export interface SessionTransition {
  from: SessionState;
  to: SessionState;
  event: BridgeEvent;
}

const VALID_TRANSITIONS: readonly SessionTransition[] = [
  { from: "spawning", to: "active", event: "session_spawned" },
  { from: "spawning", to: "terminated", event: "error" },
  { from: "active", to: "reconnecting", event: "reconnect" },
  { from: "active", to: "draining", event: "shutdown" },
  { from: "active", to: "terminated", event: "error" },
  { from: "reconnecting", to: "active", event: "session_spawned" },
  { from: "reconnecting", to: "terminated", event: "error" },
  { from: "draining", to: "terminated", event: "shutdown" },
  { from: "draining", to: "terminated", event: "error" },
];

export function canTransitionSession(from: SessionState, to: SessionState): boolean {
  return VALID_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export function getTransitionEvent(from: SessionState, to: SessionState): BridgeEvent | null {
  const t = VALID_TRANSITIONS.find((t) => t.from === from && t.to === to);
  return t?.event ?? null;
}

export function isTerminalSessionState(state: SessionState): boolean {
  return state === "terminated";
}

export function getValidTransitionsFrom(state: SessionState): readonly SessionTransition[] {
  return VALID_TRANSITIONS.filter((t) => t.from === state);
}
