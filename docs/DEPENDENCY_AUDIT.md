# Dependency Audit

## Commands

```bash
pnpm audit              # List vulnerabilities
pnpm audit --fix         # Apply fixes where possible
pnpm run audit           # Same (via script)
pnpm run audit:fix       # Same
```

## CI

- **pnpm audit** runs in CI (`ci.yml`) with `--audit-level=high`; non-blocking (`continue-on-error: true`)
- **Dependabot** opens PRs for security updates weekly; grouped under `security-patches`
- **Trivy** scans filesystem and images

## Overrides (package.json)

Security overrides pin minimal safe versions:

- `follow-redirects` ≥1.15.6 (CVE-2024-28849)
- `semver` ≥7.6.3
- `axios` ≥1.13.5
- `tar` ≥7.5.10
- `minimatch` ≥10.2.3
- `ws` ≥8.18.0
- `undici` ≥6.23.0
- etc.

## pnpm Version

`packageManager: "pnpm@10.26.0"` fixes CVE-2025-69264 (git dependency script execution bypass).

Run `corepack enable` and `corepack prepare pnpm@10.26.0 --activate` if your system pnpm is older.

## Unfixable CVEs

For CVEs with no patch, add to `package.json`:

```json
{
  "pnpm": {
    "auditConfig": {
      "ignoreCves": ["CVE-XXXX-XXXX"]
    }
  }
}
```

Or run `pnpm audit --ignore-unfixable` when the unfixable count is acceptable.
