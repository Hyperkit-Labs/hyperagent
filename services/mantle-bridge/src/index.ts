import express from "express";
import cors from "cors";
import { env } from "./env";
import { CrossChainMessengerService } from "./crossChainMessenger";

const app = express();
app.use(cors());
app.use(express.json());

const crossChainMessenger = new CrossChainMessengerService();

app.post("/deploy-with-cross-chain", async (req, res) => {
  try {
    const { bytecode, abi, constructorArgs, l1PrivateKey, l2PrivateKey } = req.body;
    
    if (!bytecode || !abi || !l1PrivateKey || !l2PrivateKey) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const result = await crossChainMessenger.deployWithCrossChain(
      bytecode,
      abi,
      constructorArgs || [],
      l1PrivateKey,
      l2PrivateKey
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("Error in deploy-with-cross-chain:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/deposit-erc20", async (req, res) => {
  try {
    const { l1TokenAddress, l2TokenAddress, amount, privateKey } = req.body;
    
    if (!l1TokenAddress || !l2TokenAddress || !amount || !privateKey) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const result = await crossChainMessenger.depositERC20(
      l1TokenAddress,
      l2TokenAddress,
      amount,
      privateKey
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("Error in deposit-erc20:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/withdraw-erc20", async (req, res) => {
  try {
    const { l1TokenAddress, l2TokenAddress, amount, privateKey } = req.body;
    
    if (!l1TokenAddress || !l2TokenAddress || !amount || !privateKey) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const result = await crossChainMessenger.withdrawERC20(
      l1TokenAddress,
      l2TokenAddress,
      amount,
      privateKey
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("Error in withdraw-erc20:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/wait-for-message-status", async (req, res) => {
  try {
    const { txHash, targetStatus } = req.body;
    
    if (!txHash || !targetStatus) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const result = await crossChainMessenger.waitForMessageStatus(txHash, targetStatus);
    res.json(result);
  } catch (error: any) {
    console.error("Error in wait-for-message-status:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/estimate-gas", async (req, res) => {
  try {
    const { from, to, data } = req.body;
    
    if (!from || !to || !data) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const result = await crossChainMessenger.estimateGas(from, to, data);
    res.json(result);
  } catch (error: any) {
    console.error("Error in estimate-gas:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "mantle-bridge" });
});

const PORT = parseInt(env.PORT);
app.listen(PORT, () => {
  console.log(`Mantle Bridge service running on port ${PORT}`);
});

