# Contributing to HyperAgent

Thanks for helping improve HyperAgent. This guide covers workflow, documentation, and where to get review.

## Security

Do **not** open public issues for security vulnerabilities. Follow [SECURITY.md](https://github.com/Hyperkit-Labs/hyperagent/blob/main/SECURITY.md) and use GitHub private reporting or the contact path described there.

## Development workflow

1. **Fork** the repository and clone your fork.
2. **Branch** from the integration branch your team uses (often `development` or `main`; follow existing PR targets).
3. **Install** tooling: Node 18+, pnpm, and Python 3.11+ when working on backend services. See [Getting started](../introduction/getting-started.md) and [Developer guide](developer-guide.md).
4. **Make changes** in focused commits. Match existing style and run linters/tests for touched areas.
5. **Open a Pull Request** using the template. PR titles must match CI format (`scope: description`). See `.github/pull_request_template.md`.

## Documentation and ADRs

- User-facing and technical docs live under **`docs/`**. Preview the site with MkDocs: [Documentation site](../introduction/documentation-site.md).
- Significant decisions belong in **`docs/adrs/`** using the [ADR template](../adrs/0000-template.md). Update the [ADR index](../adrs/README.md).

## Tests

Target high coverage for business logic (see project standards in `CLAUDE.md` and `.cursor/rules/`). Run orchestrator tests from `services/orchestrator`; frontend tests from `apps/studio` as applicable.

## Community

- **Questions:** [GitHub Discussions](https://github.com/Hyperkit-Labs/hyperagent/discussions) when enabled.
- **Bugs and features:** use the issue templates when opening an issue on GitHub (bug report, feature request).

The short link file at the repo root [`CONTRIBUTING.md`](https://github.com/Hyperkit-Labs/hyperagent/blob/main/CONTRIBUTING.md) points here for GitHub’s community health UI.
