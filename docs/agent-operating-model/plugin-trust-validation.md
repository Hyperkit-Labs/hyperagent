# Plugin trust and validation guide

Plugins are **extension packages** that can widen capability and attack surface. This guide defines trust tiers, validation, failure behavior, rollback, and capability boundaries. It aligns MCP and future in-app plugins under one policy frame.

## Trust tiers (explicit)

| Tier | Meaning | Allowed capabilities (typical) |
|------|---------|----------------------------------|
| **Verified** | Signed, reviewed, org-approved | Broad tool access within declared manifest |
| **Local** | Loaded from developer workspace | Read project; limited write to project paths |
| **Session** | Enabled for current session only | Narrow tool list; no persistent grants |
| **Dev** | Debug builds, unoptimized checks | No production data; no prod endpoints |
| **Marketplace** | Third-party distribution | Read-only by default; explicit opt-in per permission |

Each tier must declare **network**, **filesystem**, **shell**, and **secret** scopes in a machine-readable manifest when the platform supports it.

## Install scopes

- **Workspace scope:** Plugin affects only the current repo checkout.
- **User scope:** Plugin affects all projects for that user (higher risk; requires stronger trust tier).
- **System scope:** Machine-wide (highest risk; deny by default in corporate environments).

## Validation rules (before activation)

1. **Manifest schema** validates: name, version, entrypoints, permissions.
2. **Static checks:** no obfuscated blobs without review; lock dependency versions where possible.
3. **Dynamic smoke:** load in isolated process; exercise registration only; no arbitrary network in this phase unless explicitly allowed for the tier.

## Load failure behavior

- **Fail closed:** Invalid plugins do not register commands or tools.
- **Surface reason:** Log structured error code; user-visible message without leaking secrets.
- **Partial load:** If one submodule fails, do not leave half-registered routes; roll back registration transaction.

## Rollback behavior

- Keep **previous manifest** until new version passes validation.
- On rollback, unregister hooks and clear caches tied to the plugin ID.

## Capability boundaries

- Plugins **must not** override auth decisions in the gateway.
- Plugins **must not** read environment variables outside their declared scope.
- Plugins that execute shell must run under **separate OS user** or container when available.

## Relation to MCP

MCP servers configured in the IDE are **external integrations**: treat them as plugins with **session** or **user** scope depending on config; apply the same validation mindset (manifest, tool list, origin).

See [permission-approval-policy.md](permission-approval-policy.md) for approval flow when plugins request more scope.

---

**Index:** [Agent operating model](README.md)
