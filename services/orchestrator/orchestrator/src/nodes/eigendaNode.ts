import { HyperAgentState, withUpdates } from "../core/spec/state";
import { NodeDefinition, NodeImplementation } from "../core/spec/nodes";
import { MEMORY_INTEGRATION_POINTS } from "../core/spec/memory";
import { createPinataClient } from "../adapters/memory/pinataClient";
import { NODE_TIMEOUTS, NODE_RETRIES } from "../core/constants";

/**
 * NODE SPECIFICATION: EigenDANode
 * NEVER deviate from this spec.
 * 
 * Implements MEMORY_INTEGRATION_POINTS.eigenda:
 * - pin_to_ipfs: Store contract + audit results to IPFS
 * - Returns IPFS CID for immutable proof storage
 */
export const eigendaNode: NodeImplementation = {
  definition: {
    input: "HyperAgentState",
    output: "HyperAgentState",
    maxRetries: NODE_RETRIES.EIGENDA,
    timeoutMs: NODE_TIMEOUTS.EIGENDA,
    nextNode: "monitor",
  },
  async execute(state: HyperAgentState): Promise<HyperAgentState> {
    const logs = [...state.logs];
    const integrationPoint = MEMORY_INTEGRATION_POINTS.eigenda;

    logs.push(`[EIGENDA] Operation: ${integrationPoint.operation}`);

    // Prepare data to pin: contract + audit results
    const dataToPin = {
      contract: state.contract,
      auditResults: state.auditResults,
      deploymentAddress: state.deploymentAddress,
      txHash: state.txHash,
      intent: state.intent,
      timestamp: new Date().toISOString(),
      workflowId: state.meta.workflowId,
    };

    try {
      const pinataClient = createPinataClient();

      if (!pinataClient.isConfigured()) {
        logs.push("[EIGENDA] Pinata not configured. Skipping IPFS storage.");
        logs.push("[EIGENDA] Set PINATA_API_KEY and PINATA_API_SECRET to enable IPFS storage.");
        return withUpdates(state, {
          status: "processing",
          logs,
        });
      }

      logs.push("[EIGENDA] Pinning contract and audit results to IPFS...");
      const cid = await pinataClient.pinJSONToIPFS(dataToPin, {
        pinataMetadata: {
          name: `hyperagent-contract-${state.meta.workflowId}`,
          keyvalues: {
            workflowId: state.meta.workflowId,
            network: state.meta.chains.selected,
            auditPassed: String(state.auditResults.passed),
          },
        },
      });

      logs.push(`[EIGENDA] ✓ Proof stored to IPFS: ${cid}`);
      logs.push(`[EIGENDA] Gateway URL: https://gateway.pinata.cloud/ipfs/${cid}`);

      // Store CID in meta for future reference
      // Note: ipfsCid is not in the base HyperAgentMeta type, but we store it for reference
      const updatedMeta = {
        ...state.meta,
        ipfsCid: cid,
      } as typeof state.meta & { ipfsCid: string };

      return withUpdates(state, {
        status: "processing",
        meta: updatedMeta as typeof state.meta,
        logs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logs.push(`[EIGENDA] Error pinning to IPFS: ${message}`);
      // Don't fail the workflow if IPFS storage fails
      // Continue to monitor node
      return withUpdates(state, {
        status: "processing",
        logs,
      });
    }
  },
};

