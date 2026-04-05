# Documentation site (MkDocs)

The product and technical docs in `docs/` can be browsed as a static site using **[MkDocs](https://www.mkdocs.org/)** with the **[Material for MkDocs](https://squidfunk.github.io/mkdocs-material/)** theme. Search, navigation tabs, and Mermaid diagrams are enabled.

## Why MkDocs (and not Docusaurus or Mintlify)

| Option | Fit for this repo |
|--------|-------------------|
| **MkDocs Material** | Markdown-first, fast local builds, no extra Node toolchain for docs, works well next to Python services and CI. **Chosen default.** |
| **Docusaurus** | Strong if you want React-based doc pages, versioning, and i18n in the same ecosystem as Next.js. Add a `website/` app if the team prefers it. |
| **Mintlify** | Great hosted navigation and API reference UX; often paired with their platform. Use if you standardize on Mintlify for API docs and are fine with their workflow. |

Nothing prevents adding a second docs surface later. Keep canonical prose in `docs/*.md` so content stays portable.

## Local preview

```bash
pip install -r requirements-docs.txt
mkdocs serve
```

Open the URL printed in the terminal (usually `http://127.0.0.1:8000`).

## Build static HTML

```bash
mkdocs build --strict
```

Output is written to `site/` (gitignored). Use any static host or [GitHub Pages](https://docs.github.com/en/pages).

## Configuration

| File | Purpose |
|------|---------|
| `mkdocs.yml` | Site name, theme, nav, plugins |
| `requirements-docs.txt` | Python deps for MkDocs |

Diagrams use **Mermaid** via the `mkdocs-mermaid2-plugin` (see [Architecture](../architecture/system-context.md)). The docs site is configured to work in offline or restricted-network environments by using a local Mermaid-compatible fallback module, so `mkdocs build --strict` does not depend on CDN reachability.
