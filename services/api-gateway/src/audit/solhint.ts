import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

type SolhintIssue = {
  line?: number;
  column?: number;
  severity?: number;
  message?: string;
  ruleId?: string;
};

function run(cmd: string, args: string[], opts: { cwd?: string } = {}): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: false, cwd: opts.cwd });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ stdout, stderr, code }));
    child.on("error", () => resolve({ stdout, stderr, code: 1 }));
  });
}

export async function runSolhint(contractCode: string): Promise<string[]> {
  if (!contractCode || contractCode.trim().length === 0) {
    return [];
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hyperagent-solhint-"));
  const filePath = path.join(tmpDir, "Contract.sol");

  try {
    await fs.writeFile(filePath, contractCode, "utf8");

    // Prefer npx so we don't hard-require a global install.
    // If solhint isn't installed, this will fail fast and we will skip solhint findings.
    const { stdout, code } = await run("npx", ["--yes", "solhint", "-f", "json", filePath]);

    if (code !== 0 && !stdout.trim()) {
      // solhint might return non-zero if findings exist, but still print JSON.
      // Only treat as a tool failure if we got no parseable output.
      return [];
    }

    const parsed = JSON.parse(stdout) as Array<{ filePath: string; messages: SolhintIssue[] }>;
    const issues = parsed.flatMap((r) => r.messages ?? []);

    return issues
      .map((i) => {
        const loc = i.line != null ? `:${i.line}${i.column != null ? ":" + i.column : ""}` : "";
        const rule = i.ruleId ? ` (${i.ruleId})` : "";
        return `[solhint]${loc} ${i.message ?? "Issue"}${rule}`;
      })
      .slice(0, 100);
  } catch {
    return [];
  } finally {
    // Best-effort cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
