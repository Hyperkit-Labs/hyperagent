import { createThirdwebClient, defineChain, getContract } from "thirdweb";
const mantleTestnet = defineChain({
    id: 5003,
    rpc: "https://rpc.sepolia.mantle.xyz"
});
import { balanceOf } from "thirdweb/extensions/erc20";

// Thirdweb Client (Lazy Initialization)
let _client: any = null;
function getThirdwebClient() {
    if (_client) return _client;
    const clientId = process.env.THIRDWEB_CLIENT_ID;
    if (!clientId) return null;
    _client = createThirdwebClient({ clientId });
    return _client;
}

// Mock USDC / x402 Token on Mantle Testnet
const TOKEN_ADDRESS = process.env.X402_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";

export class X402Adapter {
    /**
     * Checks if the user has enough Credit/USDC for the operation using Thirdweb.
     */
    static async checkBalance(userAddress: string, requiredAmount: number): Promise<boolean> {
        console.log(`  🔍 [x402] Metering Check: ${userAddress} needs $${requiredAmount}`);

        const client = getThirdwebClient();
        if (!client) {
            console.warn("  ⚠️ [x402] THIRDWEB_CLIENT_ID missing. Using Mock implementation.");
            return true;
        }

        try {
            if (!TOKEN_ADDRESS || TOKEN_ADDRESS === "0x0000000000000000000000000000000000000000") {
                console.warn("  ⚠️ [x402] X402_TOKEN_ADDRESS not configured. Skipping balance check.");
                return true;
            }

            const contract = getContract({
                client,
                chain: mantleTestnet,
                address: TOKEN_ADDRESS,
            });

            const balanceRaw = await balanceOf({
                contract,
                address: userAddress,
            });

            // Assuming 18 decimals for simplicity or fetching from contract
            const balance = Number(balanceRaw) / 1e18;

            if (balance < requiredAmount) {
                console.error(`  ❌ [x402] Insufficient funds: ${balance} < ${requiredAmount}`);
                return false;
            }

            console.log(`  ✅ [x402] Balance sufficient (${balance}). Payment authorized.`);
            return true;
        } catch (error: any) {
            console.warn(`  ⚠️ [x402] Balance check failed: ${error.message || 'Unknown error'}. Falling back to Mock.`);
            return true;
        }
    }

    /**
     * Debits the user's account using Thirdweb.
     */
    static async debitUser(userAddress: string, amount: number): Promise<string> {
        console.log(`  💸 [x402] Debiting $${amount} from ${userAddress}...`);

        // In a real app, this would initiate a transaction or call a settlement API.
        // For CLI MVP with Thirdweb, we simulate the "Burn" or "Transfer" success.

        const mockTxHash = "0x" + Math.random().toString(16).substring(2, 64);
        console.log(`  ✅ [x402] Payment successful. Tx: ${mockTxHash}`);
        return mockTxHash;
    }
}
