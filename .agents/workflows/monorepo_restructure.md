---
description: Restructure Hyperkit_agent into a monorepo with apps and packages
---

# Monorepo Restructure Workflow

This workflow guides the restructuring of the **Hyperkit_agent** project into a clean monorepo layout using the **monorepo-management** skill.

## Steps

1. **Create `apps` directory**
   ```bash
   mkdir apps
   ```

2. **Create `packages-new` directory** (optional for future packages)
   ```bash
   mkdir packages-new
   ```

3. **Update root `package.json` workspaces** to include both `apps/*` and `packages/*`:
   ```json
   {
     "workspaces": ["apps/*", "packages/*"]
   }
   ```
   // turbo
   // Run the command to apply the change safely
   ```bash
   npx -y json -I -f package.json -e "this.workspaces=['apps/*','packages/*']"
   ```

4. **Move existing CLI package into `packages/cli` if not already there** (it already exists, so skip if present).

5. **Add a placeholder `README.md` in `apps`** to remind future app creation:
   ```bash
   echo "# Apps Directory\n\nAdd your application packages here (e.g., web, api)." > apps/README.md
   ```

6. **Install dependencies** to ensure workspace linking works:
   // turbo
   ```bash
   npm install
   ```

7. **Commit the restructuring** (optional, if using git):
   ```bash
   git add .
   git commit -m "Restructure project into monorepo layout"
   ```

---

**Note**: Steps marked with `// turbo` can be auto‑executed using the `run_command` tool with `SafeToAutoRun: true`.
