import {
  nodeRegistry as baseNodeRegistry,
  NodeRegistry,
  HyperAgentState,
  withUpdates,
} from "@hyperagent/orchestrator";
import { runSolhint } from "../audit/solhint";
import { runDeepAuditTools } from "../audit/deepTools";
import { compileSolidity } from "../evm/compileSolidity";
import { deployContract } from "../evm/deploy";
import { loadEnv } from "../config/env";

const env = loadEnv();

function dedupe(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const i of items) {
    const key = i.trim();
    if (!key) {
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(i);
  }
  return out;
}

async function augmentAuditWithSolhint(state: HyperAgentState): Promise<HyperAgentState> {
  const audited = await baseNodeRegistry.audit.execute(state);

  // If there's no contract yet, external tooling adds nothing.
  if (!audited.contract || audited.contract.trim().length === 0) {
    return audited;
  }

  const solhintEnabled = process.env.AUDIT_SOLHINT_ENABLED !== "false";
  const strict = process.env.AUDIT_SOLHINT_STRICT === "true";

  const solhintFindings = solhintEnabled ? await runSolhint(audited.contract) : [];
  const deepFindings = await runDeepAuditTools(audited.contract);

  if (solhintFindings.length === 0 && deepFindings.length === 0) {
    return audited;
  }

  const deepLines = deepFindings.map((f) =>
    f.severity ? `[${f.tool}][${f.severity}] ${f.summary}` : `[${f.tool}] ${f.summary}`,
  );
  const findings = dedupe([...(audited.auditResults?.findings ?? []), ...solhintFindings, ...deepLines]);

  // By default, treat solhint/deep-tool output as informational so we don't force validate->generate loops.
  // Opt-in strict mode can be enabled to treat any external-tool finding as a hard failure.
  const passed = strict
    ? Boolean(audited.auditResults?.passed) && solhintFindings.length === 0 && deepFindings.length === 0
    : Boolean(audited.auditResults?.passed);

  const logs = [...audited.logs];
  if (solhintEnabled) {
    logs.push(`[AUDIT] solhint findings=${solhintFindings.length}`);
  }
  if (deepFindings.length > 0) {
    logs.push(`[AUDIT] deep-tool findings=${deepFindings.length}`);
  }

  return withUpdates(audited, {
    auditResults: { passed, findings },
    logs,
  });
}

async function executeRealDeployment(state: HyperAgentState): Promise<HyperAgentState> {
  const logs = [...state.logs];
  logs.push("[DEPLOY] Starting real deployment...");

  if (!state.contract || state.contract.trim().length === 0) {
    logs.push("[DEPLOY] Error: No contract code found to deploy.");
    return withUpdates(state, { status: "failed", logs });
  }

  try {
    // 1. Compile
    logs.push("[DEPLOY] Compiling Solidity source...");
    const compiled = compileSolidity({
      sourceCode: state.contract,
    });
    logs.push(`[DEPLOY] Compiled successfully. Primary contract: ${compiled.contractName}`);

    // 2. Deploy
    const network = state.meta?.chains?.selected || "mantle_testnet";
    logs.push(`[DEPLOY] Sending transaction to ${network}...`);

    const result = await deployContract({
      env,
      network,
      abi: compiled.abi,
      bytecode: compiled.bytecode,
    });

    logs.push(`[DEPLOY] Success! Contract Address: ${result.contractAddress}`);
    logs.push(`[DEPLOY] Transaction Hash: ${result.txHash}`);

    return withUpdates(state, {
      status: "success",
      deploymentAddress: result.contractAddress,
      txHash: result.txHash,
      logs,
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    logs.push(`[DEPLOY] Critical Error: ${msg}`);
    return withUpdates(state, {
      status: "failed",
      logs,
    });
  }
}

export const apiNodeRegistry: NodeRegistry = {
  ...baseNodeRegistry,
  audit: {
    ...baseNodeRegistry.audit,
    execute: augmentAuditWithSolhint,
  },
  deploy: {
    ...baseNodeRegistry.deploy,
    execute: executeRealDeployment,
  },
};
