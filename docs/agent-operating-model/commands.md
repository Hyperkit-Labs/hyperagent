# Commands

Commands are the user-facing action surface of the agent operating system.

## Definition

A command is a named entrypoint that a user or external system invokes to trigger behavior. Commands route to skills, agents, plugins, or workflows. They do not contain business logic.

## Responsibilities

- Route user-visible actions (slash commands, CLI, menu entries)
- Lazily load feature modules
- Expose built-in and plugin-provided commands
- Dispatch to skills, agents, plugins, or workflows

## Boundaries

Commands must not:

- Own persistent state
- Contain business logic
- Make tool policy decisions
- Access plugin internals
- Implement task lifecycle

## Registry

All commands register through `CommandRegistry` in `packages/agent-os/src/commandRegistry.ts`.

Each registered command has:

| Field | Type | Required | Description |
|---|---|---|---|
| id | string | yes | Unique command identifier (e.g. `generate`, `review`) |
| label | string | yes | Human-readable display name |
| category | string | yes | Grouping (e.g. `workflow`, `settings`, `debug`) |
| execute | function | yes | Handler receiving CommandContext |
| hidden | boolean | no | Whether to hide from user-facing lists |
| featureGate | string | no | Feature flag that must be enabled |

## Command lifecycle

1. User or system invokes command by id
2. Registry resolves command definition
3. Feature gate (if any) is checked
4. Command handler receives CommandContext with session, permissions, and arguments
5. Handler dispatches to the appropriate skill, agent, or workflow
6. Result is returned to caller

## Validation

Every command must have:

- A unique id
- A non-empty label
- A category from the known set
- An execute function

The `validateCommandDef` function in `commandRegistry.ts` enforces these at registration time.

## Built-in commands

| Command | Category | Description |
|---|---|---|
| generate | workflow | Create contract from natural language |
| review | workflow | Review existing contract |
| deploy | workflow | Deploy contract to chain |
| settings | settings | Open workspace settings |
| keys | settings | Manage BYOK keys |
| status | debug | Show system status |

## Adding a command

1. Define the command object with id, label, category, and execute handler
2. Register it in the CommandRegistry during app initialization
3. The handler should delegate to the appropriate service, not contain logic itself

---

**Index:** [Agent operating model](README.md)
