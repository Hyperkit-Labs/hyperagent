import { HyperAgentState } from "../types/agent";
import { ChainAdapter } from "../adapters/chain";

export async function deployNode(state: HyperAgentState): Promise<Partial<HyperAgentState>> {
    console.log("  → [DeployNode] Preparing deployment...");

    // Check previous state
    if (state.status !== "deploying") {
        // If we skipped here incorrectly, fail or handle.
        // But graph edges enforce this.
    }

    // Perform Deployment
    try {
        const { address, txHash } = await ChainAdapter.deployContract(state.contract, "mantle-testnet");

        return {
            status: "success",
            deploymentAddress: address,
            txHash: txHash,
            logs: [...state.logs, `DeployNode: Contract deployed at ${address} (Tx: ${txHash})`]
        };
    } catch (error) {
        console.error("  ❌ [DeployNode] Deployment Failed:", error);
        return {
            status: "failed",
            logs: [...state.logs, `DeployNode: Deployment failed - ${(error as Error).message}`]
        };
    }
}
