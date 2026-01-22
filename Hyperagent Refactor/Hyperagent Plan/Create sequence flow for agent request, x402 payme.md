<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Create sequence flow for agent request, x402 payment, and ERC-8004 trust verification

Let me create a comprehensive sequence diagram for the agent request → payment → trust verification flow:

### **Sequence Flow: Agent Request → x402 Payment → ERC-8004 Trust Verification**

```mermaid
sequenceDiagram
    participant Developer
    participant HyperKit Studio
    participant HyperAgent
    participant Usage Tracker
    participant x402 Payment Handler
    participant ERC-8004 Registry
    participant Base Blockchain
    
    Note over Developer,Base Blockchain: === Main Flow: Successful Audit Request ===
    
    Developer->>HyperKit Studio: 1. POST /api/audit {contract: "0x123...", chain: "base"}
    HyperKit Studio->>HyperAgent: 2. executeTask({userId: "user-123", task: "audit", params: {...}})
    
    HyperAgent->>Usage Tracker: 3. checkCredits("user-123", "audit")
    Usage Tracker-->>HyperAgent: 4. {credits: 2, cost: 1, allowed: true}
    
    HyperAgent->>x402 Payment Handler: 5. verifyPaymentCapability("user-123", "audit")
    x402 Payment Handler->>ERC-8004 Registry: 6. getAgentTrust("hyperkit-auditor")
    ERC-8004 Registry-->>x402 Payment Handler: 7. {score: 150, identity: "verified", validationProof: "0xabc..."}
    
    alt Agent Trust Score < 100 (Insufficient)
        x402 Payment Handler-->>HyperAgent: 8. {error: "Agent trust insufficient"}
        HyperAgent-->>HyperKit Studio: 9. 403 Forbidden: Agent not trusted
        HyperKit Studio-->>Developer: 10. Show error: "This agent requires higher reputation"
    else Agent Trust Score >= 100 (Sufficient)
        x402 Payment Handler-->>HyperAgent: 11. {trusted: true, score: 150}
        
        HyperAgent->>x402 Payment Handler: 12. createPaymentRequirements({
            amount: "0.10",
            asset: "USDC",
            chain: "base-mainnet"
        })
        x402 Payment Handler-->>HyperAgent: 13. requirements: {
            "maxAmountRequired": "0.10",
            "assetType": "ERC20",
            "assetAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "paymentAddress": "0xHyperKitReceivingWallet...",
            "network": "base-mainnet",
            "expiresAt": 1737532800,
            "nonce": "0x123456...",
            "paymentId": "pay_123456789"
        }
        
        HyperAgent-->>HyperKit Studio: 14. 402 Payment Required + requirements
        HyperKit Studio-->>Developer: 15. Show payment modal: "Pay $0.10 USDC to continue"
        
        Developer->>HyperKit Studio: 16. Sign EIP-712 authorization
        Note right of Developer: EIP-712 Signature Structure:<br/>domain: { name: "x402", version: "1", chainId: 8453 }<br/>types: { PaymentAuthorization: [...] }<br/>message: paymentRequirements
        
        HyperKit Studio->>x402 Payment Handler: 17. submitPayment(signature, requirements)
        x402 Payment Handler->>Base Blockchain: 18. transferWithAuthorization(signature)
        Base Blockchain-->>x402 Payment Handler: 19. txHash: "0x789...", status: "confirmed"
        
        x402 Payment Handler->>Usage Tracker: 20. addCredits("user-123", 10)
        Usage Tracker-->>x402 Payment Handler: 21. {credits: 12}
        
        x402 Payment Handler-->>HyperAgent: 22. {verified: true, paymentId: "pay_123456789"}
        
        HyperAgent->>Usage Tracker: 23. deductCredits("user-123", 1)
        Usage Tracker-->>HyperAgent: 24. {credits: 11}
        
        HyperAgent->>Base Blockchain: 25. eth_call(audit simulation)
        Base Blockchain-->>HyperAgent: 26. {gasUsed: 45000, result: "0x..."}
        
        HyperAgent->>Base Blockchain: 27. eth_getCode(0x123...)
        Base Blockchain-->>HyperAgent: 28. contractBytecode: "0x6080..."
        
        HyperAgent->>HyperAgent: 29. Run Slither + Mythril analysis
        HyperAgent->>HyperAgent: 30. Generate PoC tests
        
        HyperAgent-->>HyperKit Studio: 31. {
            report: {...},
            paymentId: "pay_123456789",
            creditsRemaining: 11,
            ipfsHash: "Qm..."
        }
        
        HyperKit Studio-->>Developer: 32. Display audit results + payment receipt
    end
    
    Note over Developer,Base Blockchain: === Error Flow: Payment Verification Failed ===
    
    Developer->>HyperKit Studio: 33. Retry payment with invalid signature
    HyperKit Studio->>x402 Payment Handler: 34. submitPayment(badSignature, requirements)
    x402 Payment Handler->>Base Blockchain: 35. transferWithAuthorization(badSignature)
    Base Blockchain-->>x402 Payment Handler: 36. ERROR: Signature invalid
    x402 Payment Handler-->>HyperKit Studio: 37. {error: "Payment verification failed"}
    HyperKit Studio-->>Developer: 38. Show error: "Payment failed. Please try again."
    
    Note over Developer,Base Blockchain: === Error Flow: Insufficient Credits (No Payment) ===
    
    Developer->>HyperKit Studio: 39. Request audit with 0 credits
    HyperKit Studio->>HyperAgent: 40. executeTask(...)
    HyperAgent->>Usage Tracker: 41. checkCredits("user-123", "audit")
    Usage Tracker-->>HyperAgent: 42. {credits: 0, allowed: false}
    HyperAgent->>x402 Payment Handler: 43. createPaymentRequirements(...)
    x402 Payment Handler-->>HyperAgent: 44. requirements: {...}
    HyperAgent-->>HyperKit Studio: 45. 402 Payment Required (no credits)
    HyperKit Studio-->>Developer: 46. Show payment modal: "Add credits to continue"
```


***

### **Key Implementation Details**

#### **x402 Payment Requirements** [^1][^2]

```typescript
interface PaymentRequirements {
  maxAmountRequired: string;        // "0.10" (USDC)
  assetType: "ERC20";
  assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
  paymentAddress: "0xHyperKitReceivingWallet...";
  network: "base-mainnet";
  chainId: 8453;
  expiresAt: number;                // Unix timestamp (1 hour)
  nonce: `0x${string}`;             // Unique per request
  paymentId: `pay_${string}`;       // Traceable ID
}
```


#### **ERC-8004 Trust Verification** [^3][^4]

```typescript
interface AgentTrust {
  identity: {
    did: "did:ethr:0xAuditorAgent...";
    verified: true;
    registrationBlock: 12345678;
  };
  reputation: {
    score: number;                  // 0-200 (150 = trusted)
    totalAudits: number;
    avgRating: number;
    disputes: number;
  };
  validation: {
    proof: `0x${string}`;           // Cryptographic proof of execution
    validator: "0xValidatorContract...";
    timestamp: number;
  };
}
```


#### **EIP-712 Signature Structure** [^1]

```typescript
const domain = {
  name: "x402",
  version: "1",
  chainId: 8453,                    // Base mainnet
  verifyingContract: "0x402..."     // x402 facilitator
};

const types = {
  PaymentAuthorization: [
    { name: "paymentId", type: "string" },
    { name: "amount", type: "uint256" },
    { name: "asset", type: "address" },
    { name: "to", type: "address" },
    { name: "nonce", type: "bytes32" },
    { name: "expiresAt", type: "uint256" }
  ]
};

const message = paymentRequirements;
```

This sequence ensures:

1. **Trust**: Only verified agents can charge users
2. **Payment**: Users pay only for successful verification
3. **Accounting**: All usage tracked on-chain and off-chain
4. **UX**: Seamless payment flow integrated into agent request

<div align="center">⁂</div>

[^1]: https://www.x402.org/x402-whitepaper.pdf

[^2]: https://blog.quicknode.com/x402-protocol-explained-inside-the-https-native-payment-layer/

[^3]: https://www.linkedin.com/posts/thisissrv_let-me-explain-x402-and-erc-8004-because-activity-7391455729624465408-xNHa

[^4]: https://payram.com/blog/what-is-erc-8004-protocol

