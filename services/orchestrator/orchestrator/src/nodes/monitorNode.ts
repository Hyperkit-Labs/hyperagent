import { HyperAgentState, withUpdates } from "../core/spec/state";
import { NodeDefinition, NodeImplementation } from "../core/spec/nodes";
import { MEMORY_INTEGRATION_POINTS } from "../core/spec/memory";
import { createChromaClient } from "../adapters/memory/chromaClient";
import { NODE_TIMEOUTS, NODE_RETRIES, VALIDATION_LIMITS } from "../core/constants";

/**
 * NODE SPECIFICATION: MonitorNode
 * NEVER deviate from this spec.
 * Terminal node - always returns null nextNode
 * 
 * Implements MEMORY_INTEGRATION_POINTS.monitor:
 * - store_contract: Save successful deployment to Chroma vector DB
 * - Emit telemetry events (if telemetry enabled)
 */
export const monitorNode: NodeImplementation = {
  definition: {
    input: "HyperAgentState",
    output: "HyperAgentState",
    maxRetries: NODE_RETRIES.MONITOR,
    timeoutMs: NODE_TIMEOUTS.MONITOR,
    nextNode: null, // Terminal
  },
  async execute(state: HyperAgentState): Promise<HyperAgentState> {
    const logs = [...state.logs];
    const integrationPoint = MEMORY_INTEGRATION_POINTS.monitor;

    logs.push(`[MONITOR] Operation: ${integrationPoint.operation}`);

    // Only store if deployment was successful
    if (state.deploymentAddress && state.contract) {
      try {
        logs.push("[MONITOR] Saving contract to persistent memory (Chroma)...");
        const chromaClient = createChromaClient();

        // Prepare metadata for storage
        const metadata = {
          workflowId: state.meta.workflowId,
          network: state.meta.chains.selected,
          deploymentAddress: state.deploymentAddress,
          txHash: state.txHash,
          auditPassed: state.auditResults.passed,
          auditFindingsCount: state.auditResults.findings.length,
          intent: state.intent.substring(0, VALIDATION_LIMITS.MAX_INTENT_LENGTH), // Truncate for metadata
          timestamp: new Date().toISOString(),
          ipfsCid: (state.meta as { ipfsCid?: string })?.ipfsCid || null,
        };

        // Generate contract hash for ID
        const contractHash = state.txHash || state.meta.workflowId;

        const stored = await chromaClient.storeContract(state.contract, metadata);

        if (stored) {
          logs.push("[MONITOR] ✓ Contract saved to Chroma vector DB");
        } else {
          logs.push("[MONITOR] ⚠ Contract storage failed (non-critical)");
        }
      } catch (error) {
        // Don't fail workflow if storage fails
        const message = error instanceof Error ? error.message : String(error);
        logs.push(`[MONITOR] ⚠ Memory storage error (non-critical): ${message}`);
      }
    } else {
      logs.push("[MONITOR] Skipping storage (no deployment address or contract)");
    }

    // Telemetry events are emitted via the event bus in the Python backend
    // This node focuses on memory storage; telemetry is handled at the API layer
    // See: hyperagent/telemetry/__init__.py for telemetry implementation

    logs.push("[MONITOR] Workflow complete");

    return withUpdates(state, {
      status: "success",
      logs,
    });
  },
};

