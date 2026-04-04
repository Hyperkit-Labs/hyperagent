/**
 * Refresh openapi/openapi.json from the FastAPI app and regenerate src/generated/schema.ts.
 * Requires Python 3.11+ with orchestrator deps (run from repo root: pnpm install in packages/api-contracts).
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const repoRoot = join(pkgRoot, "..", "..");
const orchestratorRoot = join(repoRoot, "services", "orchestrator");
const outDir = join(pkgRoot, "openapi");
const outJson = join(outDir, "openapi.json");
const genPath = join(pkgRoot, "src", "generated", "schema.ts");

mkdirSync(outDir, { recursive: true });
mkdirSync(join(pkgRoot, "src", "generated"), { recursive: true });

const py = process.env.PYTHON ?? "python";
execFileSync(
  py,
  [join(orchestratorRoot, "scripts", "export_openapi.py"), "--out", outJson],
  { stdio: "inherit", cwd: orchestratorRoot },
);

execFileSync(
  process.execPath,
  [
    join(pkgRoot, "node_modules", "openapi-typescript", "bin", "cli.js"),
    outJson,
    "--output",
    genPath,
    "--alphabetize",
    "--default-non-nullable",
  ],
  { stdio: "inherit", cwd: pkgRoot },
);

// openapi-typescript already emits a file header; committed output stays in sync with FastAPI.
