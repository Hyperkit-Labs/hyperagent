# Bridge / Control Plane

The bridge manages remote session lifecycle and control-plane orchestration.

## Definition

The bridge is the transport and coordination layer between the local agent runtime and remote execution environments. It handles session spawning, heartbeats, reconnections, and shutdown. It does not contain execution logic.

## Responsibilities

- Session spawning and teardown
- Heartbeat monitoring
- Reconnection after transient failures
- Graceful shutdown and draining
- Worktree and session coordination
- Transport boundary enforcement

## Boundaries

The bridge must not:

- Mix transport with execution policy
- Contain agent reasoning logic
- Own task lifecycle
- Make tool invocation decisions
- Store persistent application state

## Session states

Defined in `packages/agent-os/src/bridgeProtocol.ts`:

| State | Description | Terminal |
|---|---|---|
| spawning | Session is being created | no |
| active | Session is running and healthy | no |
| reconnecting | Session lost connectivity, attempting recovery | no |
| draining | Session is shutting down gracefully | no |
| terminated | Session has ended | yes |

## State transitions

| From | To | Event |
|---|---|---|
| spawning | active | session_spawned |
| active | reconnecting | reconnect |
| active | draining | shutdown |
| reconnecting | active | heartbeat |
| reconnecting | terminated | error |
| draining | terminated | shutdown |

Invalid transitions are rejected by `canTransitionSession(from, to)`.

## Bridge events

| Event | When |
|---|---|
| session_spawned | New session successfully created |
| heartbeat | Periodic liveness signal from active session |
| reconnect | Session re-established after interruption |
| shutdown | Graceful termination initiated |
| error | Unrecoverable failure |

## Heartbeat protocol

The `HeartbeatPayload` includes:

- `sessionId`: Which session this heartbeat belongs to
- `timestamp`: ISO-8601 time of heartbeat
- `uptimeMs`: Milliseconds since session started
- `activeTasks`: Number of in-flight tasks

If no heartbeat arrives within the configured timeout, the session transitions from `active` to `reconnecting`.

## Recovery rules

1. On disconnect: attempt reconnection up to `maxReconnectAttempts`
2. On reconnect success: resume from last checkpoint
3. On reconnect failure: transition to `terminated`, release resources
4. Stale sessions (no heartbeat for > timeout): force-terminate
5. All recovery attempts are logged with session ID correlation

## Usage

The bridge is used when:

- Running agent work on remote infrastructure
- Coordinating distributed pipeline stages
- Managing cloud-hosted execution environments
- Handling long-running background sessions

---

**Index:** [Agent operating model](README.md)
