# State Boundaries

State in the agent operating system is split into explicit domains with clear ownership and mutation rules.

## Principle

Do not keep all state in one object. Each state domain has a single owner service. Cross-domain reads use accessor functions. Cross-domain writes are prohibited.

## State domains

Defined in `packages/agent-os/src/stateDomains.ts`:

| Domain | Owner | Description |
|---|---|---|
| session | SessionManager | Current user session, auth tokens, workspace context |
| task | TaskLifecycle | Active and historical task records, status, progress |
| permission | PermissionPolicy | Tool approval state, mode (allow/ask/deny), overrides |
| plugin | PluginManager | Loaded plugins, activation state, capability exposure |
| memory | MemoryService | Durable project memory, session history, compaction state |
| bridge | BridgeController | Remote session state, heartbeat status, connection info |
| telemetry | TelemetryCollector | Spans, metrics, cost tracking, duration records |

## Ownership rules

1. Only the owning service may mutate its domain state
2. Other services may read domain state through typed accessor functions
3. No service may hold a mutable reference to another domain's state
4. State domain types are branded to prevent accidental cross-domain assignment

## Mutation boundaries

- Session state changes only through SessionManager methods
- Task state changes only through TaskLifecycle transitions (pending, running, completed, failed, killed)
- Permission state changes only through explicit policy updates
- Plugin state changes only during activation/deactivation lifecycle
- Memory state changes only through append/compact/reset operations
- Bridge state changes only through session lifecycle events
- Telemetry state is append-only

## Reset semantics

Each domain defines its own reset behavior:

| Domain | Reset trigger | Behavior |
|---|---|---|
| session | Logout / session expiry | Clear all session fields, invalidate tokens |
| task | Task completion or cancellation | Archive to history, release resources |
| permission | Mode change or policy reload | Re-evaluate all pending approvals |
| plugin | Plugin deactivation or reload | Remove registered commands/skills, free resources |
| memory | Explicit clear or compaction | Archive or compact, never silently drop |
| bridge | Session termination | Release remote resources, clear heartbeat state |
| telemetry | Export or rotation | Flush to external collector, reset counters |

## Derived vs persistent state

- **Persistent state**: stored in database or durable storage (user_credits, workflow records, BYOK keys)
- **Derived state**: computed from persistent state on read (balance from transactions, task progress from steps)
- **Transient state**: exists only in memory during a session (nonce cache, rate limit counters, in-flight heartbeats)

Never treat derived state as a source of truth. Always re-derive from the authoritative persistent source.

## Validation

Use `getOwner(domain)` to check which service owns a domain.
Use `isDomainOwnedBy(domain, service)` to verify write authorization.

## Anti-patterns

- Storing all state in a single global object
- Allowing any service to mutate any state field
- Treating UI component state as authoritative backend truth
- Caching derived values without invalidation rules
- Mixing session state with task state in the same data structure

---

**Index:** [Agent operating model](README.md)
