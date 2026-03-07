# /index

Index the entire application and capture structure, hooks, specs, steering, patterns, and types. Write the result to `.cursor/llm/app-index.txt` so it is available as LLM context. Update the timestamp at the top when you run.

## Output file

- Path: `.cursor/llm/app-index.txt`
- Format: Plain text, markdown-style headings. Keep each section scannable; use lists and short lines.

## What to capture

1. **Structure**
   - Directory tree of `apps/`, `services/`, `packages/`, `infra/`, `contracts/`, `platform/`, `docs/`, `.cursor/` (skip `node_modules`, `__pycache__`, `.git`). Include `.kiro/` only if present.
   - Entry points: main app `apps/studio` (frontend), `apps/api-gateway`, `apps/docs` (stubs); services and packages as per monorepo layout.
   - Module boundaries: frontend (Studio), services (orchestrator, agent-runtime, codegen, audit, simulation, deploy, context, storage), shared packages (sdk-ts, config, ui, core-types, web3-utils, ai-tools).

2. **Hooks**
   - React/custom hooks: files under `**/hooks/**` or files that define `use*`; list path and hook name.
   - Kiro hooks: list each `.kiro/hooks/*.kiro.hook` with name, trigger (when), and short description.
   - CI/webhooks: any GitHub Actions or webhook entry points that affect behavior (name and purpose only).

3. **Specs**
   - Test specs: locations of test files (e.g. `**/*.test.ts`, `**/tests/`, `**/pytest`), and what they cover at a high level.
   - API/OpenAPI specs: path to OpenAPI/Swagger or schema files and main tags/resources.
   - Kiro specs: each `.kiro/specs/**` (e.g. `design.md`, `tasks.md`, `bugfix.md`) with spec name and one-line purpose.
   - Planning/spec docs: `docs/specs/`, `docs/adr/`, `docs/runbooks/`, and `external/docs/detailed/` (draft, Project Details) and their role (blueprint, execution, onboarding).

4. **Steering**
   - `.cursor/rules/`: list rule files and in one line what each steers (e.g. AGENT.mdc, production.mdc, sprint-commitments.mdc).
   - `.kiro/steering/`: list steering docs and their purpose.
   - Root/config steering: `.cursorrules`, `CLAUDE.md`, key config files (e.g. `config/base.yaml`) and what they control.

5. **Patterns**
   - Naming: route/page conventions (e.g. Next.js app router), API route layout, Python package layout.
   - Design patterns in use: e.g. agent pipeline, service layer, repository, dependency injection where obvious.
   - Conventions: branch names, commit style, where types vs implementations live.

6. **Type**
   - TypeScript: main `types/` or `@/types` locations; key shared interfaces (e.g. API response, workflow state).
   - Python: Pydantic models and where they live; key request/response or domain models.
   - API contracts: how frontend and backend types align (e.g. shared schema repo or generated clients).

## How to run

1. Scan the repository for the six dimensions above. Use glob/search for hooks, specs, types, and config.
2. Assemble a single document with clear section headers: Structure, Hooks, Specs, Steering, Patterns, Type.
3. Write to `.cursor/llm/app-index.txt`. Start the file with a line like `Last updated: YYYY-MM-DD` (today).
4. If `llm.txt` or `.cursor/llm/README.md` references an app index, add or update the pointer to `app-index.txt`.

## Optional: index a subset

You may run a partial index by scope:

- **Scope: frontend** – Only `apps/studio/` (structure, hooks, types, patterns for that app).
- **Scope: backend** – Only services (e.g. `services/orchestrator/`, `services/agent-runtime/`) and related API specs, types, patterns.
- **Scope: steering** – Only steering and rules (`.cursor/rules/`, `.kiro/steering/`, root config).

If the user specifies a scope, write to `.cursor/llm/app-index-<scope>.txt` (e.g. `app-index-frontend.txt`) and mention the scope in the first line of the file.
