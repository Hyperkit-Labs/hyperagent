import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "informational";

export type DeepAuditFinding = {
  tool: "slither" | "mythril" | "echidna" | "mythx";
  severity?: FindingSeverity;
  summary: string;
};

function runWithTimeout(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs: number },
): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: false, cwd: opts.cwd });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, opts.timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });

    child.on("error", () => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: 1, timedOut });
    });
  });
}

async function dockerAvailable(): Promise<boolean> {
  const { code } = await runWithTimeout("docker", ["version"], { timeoutMs: 5_000 });
  return code === 0;
}

async function withTempContract(
  contractCode: string,
  fn: (dir: string, filePath: string) => Promise<DeepAuditFinding[]>,
): Promise<DeepAuditFinding[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hyperagent-deepaudit-"));
  const filePath = path.join(tmpDir, "Contract.sol");

  try {
    await fs.writeFile(filePath, contractCode, "utf8");
    return await fn(tmpDir, filePath);
  } catch {
    return [];
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

async function runDockerInDir(args: string[], cwd: string, timeoutMs: number) {
  // NOTE: Uses -v <dir>:/work and -w /work so tools can access Contract.sol.
  return runWithTimeout(
    "docker",
    ["run", "--rm", "-v", `${cwd}:/work`, "-w", "/work", ...args],
    { timeoutMs },
  );
}

async function runDockerSh(args: { image: string; script: string; cwd: string; timeoutMs: number }) {
  // Most security-tool images include /bin/sh.
  return runDockerInDir([args.image, "sh", "-lc", args.script], args.cwd, args.timeoutMs);
}

function mapSeverity(input: string | undefined): FindingSeverity {
  const v = (input ?? "").toLowerCase();
  if (v.includes("critical")) return "critical";
  if (v.includes("high")) return "high";
  if (v.includes("medium")) return "medium";
  if (v.includes("low")) return "low";
  return "informational";
}

function toShortText(input: unknown): string {
  if (typeof input === "string") {
    return input.replace(/\s+/g, " ").trim();
  }
  try {
    return JSON.stringify(input).slice(0, 2000);
  } catch {
    return String(input);
  }
}

function parseSlitherJson(jsonText: string): DeepAuditFinding[] {
  try {
    const parsed = JSON.parse(jsonText) as any;
    const dets = parsed?.results?.detectors ?? [];
    if (!Array.isArray(dets)) {
      return [];
    }

    return dets
      .map((d: any) => {
        const title = d.check ?? d.title ?? "slither_finding";
        const impact = d.impact ?? d.severity;
        const severity = mapSeverity(impact);
        const description = d.description ?? d.description?.text ?? d.first_markdown_element ?? d;
        const summary = `${title}: ${toShortText(description)}`.slice(0, 1500);
        return { tool: "slither" as const, severity, summary };
      })
      .slice(0, 50);
  } catch {
    return [];
  }
}

function parseMythrilJson(jsonText: string): DeepAuditFinding[] {
  try {
    const parsed = JSON.parse(jsonText) as any;
    const issues = parsed?.issues ?? parsed?.results ?? [];
    if (!Array.isArray(issues)) {
      return [];
    }

    return issues
      .map((i: any) => {
        const title = i.title ?? i["swc-title"] ?? i["swc-id"] ?? "mythril_issue";
        const severity = mapSeverity(i.severity);
        const desc = i.description ?? i.description_head ?? i;
        const summary = `${title}: ${toShortText(desc)}`.slice(0, 1500);
        return { tool: "mythril" as const, severity, summary };
      })
      .slice(0, 50);
  } catch {
    return [];
  }
}

export async function runDeepAuditTools(contractCode: string): Promise<DeepAuditFinding[]> {
  if (!contractCode || contractCode.trim().length === 0) {
    return [];
  }

  // Opt-in only (deep tools can be slow / noisy).
  if (process.env.AUDIT_DEEP_TOOLS_ENABLED !== "true") {
    return [];
  }

  const hasDocker = await dockerAvailable();
  if (!hasDocker) {
    return [
      {
        tool: "slither",
        summary: "Deep audit tools enabled but Docker is not available; skipping slither/mythril/echidna runners.",
      },
    ];
  }

  return withTempContract(contractCode, async (dir) => {
    const findings: DeepAuditFinding[] = [];

    // Slither (Trail of Bits). Image choice is configurable so users can pin versions.
    // Default: trailofbits/eth-security-toolbox includes slither.
    const slitherImage = process.env.SLITHER_DOCKER_IMAGE || "trailofbits/eth-security-toolbox";
    const slitherJson = await runDockerSh({
      image: slitherImage,
      cwd: dir,
      timeoutMs: 120_000,
      script: "slither Contract.sol --json slither.json >/dev/null 2>&1 || true; cat slither.json 2>/dev/null || true",
    });

    if (slitherJson.timedOut) {
      findings.push({ tool: "slither", severity: "informational", summary: "Slither timed out" });
    } else {
      const out = (slitherJson.stdout || slitherJson.stderr).trim();
      const parsed = out ? parseSlitherJson(out) : [];
      if (parsed.length > 0) {
        findings.push(...parsed);
      } else if (out) {
        findings.push({ tool: "slither", severity: "informational", summary: out.slice(0, 4000) });
      }
    }

    // Mythril. Default image provides `myth` CLI.
    const mythrilImage = process.env.MYTHRIL_DOCKER_IMAGE || "mythril/myth";
    const myth = await runDockerSh({
      image: mythrilImage,
      cwd: dir,
      timeoutMs: 180_000,
      script: "myth analyze Contract.sol -o json 2>/dev/null || true",
    });

    if (myth.timedOut) {
      findings.push({ tool: "mythril", severity: "informational", summary: "Mythril timed out" });
    } else {
      const out = (myth.stdout || myth.stderr).trim();
      const parsed = out ? parseMythrilJson(out) : [];
      if (parsed.length > 0) {
        findings.push(...parsed);
      } else if (out) {
        findings.push({ tool: "mythril", severity: "informational", summary: out.slice(0, 4000) });
      }
    }

    // Echidna (property-based fuzzing) typically needs a project layout + test harness.
    // We keep the runner scaffolded here for later integration.
    if (process.env.ECHIDNA_ENABLED === "true") {
      findings.push({
        tool: "echidna",
        summary:
          "Echidna runner scaffolded but not wired yet (requires harness/config + compilation settings).",
      });
    }

    // MythX is a hosted service; integrating it requires an API key + compatible CLI.
    if (process.env.MYTHX_API_KEY) {
      findings.push({
        tool: "mythx",
        summary: "MythX integration scaffolded but not implemented yet in TS backend.",
      });
    }

    return findings;
  });
}
