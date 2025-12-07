import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "..", "..", ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

export const env = {
  PORT: process.env.MANTLE_BRIDGE_PORT || "3002",
  L1_RPC: process.env.L1_RPC || "",
  L2_RPC: process.env.L2_RPC || "",
  L1_CHAIN_ID: process.env.L1_CHAIN_ID || "1",
  L2_CHAIN_ID: process.env.L2_CHAIN_ID || "5001",
};

