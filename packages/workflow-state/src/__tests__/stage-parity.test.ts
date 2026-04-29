/**
 * F-004 / F-019 parity test.
 *
 * The TypeScript canonical list of pipeline stages lives in
 * packages/workflow-state/src/pipeline-states.ts (`PIPELINE_STAGES`).
 * The Python orchestrator stores stage in AgentState `current_stage: str`
 * with no Literal[...] enforcement and no Pydantic model.
 *
 * To prevent typos like `'desigh'` from silently stranding the UI in `idle`,
 * this test scans every Python file under `services/orchestrator/` for direct
 * `current_stage = "..."` writes and asserts each literal is in
 * PIPELINE_STAGES.
 *
 * It does NOT enforce that every PIPELINE_STAGES entry is written somewhere
 * (the TS list intentionally describes UI-bucket states like `idle` that the
 * server never writes). It is a one-way drift detector: server typos that the
 * UI cannot map.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES } from "../pipeline-states.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// packages/workflow-state/src/__tests__ → up 4 levels → repo root
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const ORCH_ROOT = path.join(REPO_ROOT, "services/orchestrator");

function* walkPy(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      entry.name !== "tests" &&
      entry.name !== "__pycache__" &&
      entry.name !== "node_modules"
    ) {
      yield* walkPy(path.join(dir, entry.name));
    } else if (entry.isFile() && entry.name.endsWith(".py")) {
      yield path.join(dir, entry.name);
    }
  }
}

const KNOWN_STAGES: ReadonlySet<string> = new Set(PIPELINE_STAGES);

describe("pipeline stage parity (TS↔Python)", () => {
  it("every direct current_stage literal in services/orchestrator/**/*.py is in PIPELINE_STAGES", () => {
    const violations: { file: string; literal: string; line: number }[] = [];
    for (const py of walkPy(ORCH_ROOT)) {
      const src = fs.readFileSync(py, "utf8");
      const lines = src.split("\n");
      lines.forEach((ln, idx) => {
        // Skip comment-only lines so docstrings/comments referencing
        // `current_stage = "..."` don't trip the parity check.
        if (/^\s*#/.test(ln)) return;
        // Match all three Python write forms:
        //   bare assignment            : current_stage = "..."
        //   subscript assignment       : state["current_stage"] = "..."
        //   dict literal value         : "current_stage": "..."
        // The character class `[\]\s"']*` between the key and the operator
        // tolerates the optional `"]` of subscript and the closing `"` of a
        // dict-literal key.
        const re =
          /["']?current_stage["']?\s*[\]\s"']*[:=]\s*["']([^"']+)["']/g;
        for (const m of ln.matchAll(re)) {
          const literal = m[1];
          if (!KNOWN_STAGES.has(literal)) {
            violations.push({ file: py, literal, line: idx + 1 });
          }
        }
      });
    }
    expect(
      violations,
      `Found Python current_stage writes that are not in PIPELINE_STAGES:\n${violations
        .map((v) => `  ${path.relative(REPO_ROOT, v.file)}:${v.line} → "${v.literal}"`)
        .join("\n")}\n\nUpdate packages/workflow-state/src/pipeline-states.ts or fix the Python typo.`,
    ).toEqual([]);
  });
});
