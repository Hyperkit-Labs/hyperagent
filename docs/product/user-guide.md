# Studio guide

How to use HyperAgent Studio: connect a wallet, configure keys, and run workflows.

---

## What HyperAgent does

HyperAgent turns natural language into smart contracts. Describe the intent in the app; the platform generates Solidity, runs security checks and simulations, and can deploy to supported EVM chains. Wallet keys and approvals stay under local control.

---

## Core flow

1. **Connect** – Connect a wallet in the web app (for example MetaMask or WalletConnect). Used for identity, deployment, and payments.
2. **BYOK (Bring your own keys)** – Add LLM API keys (OpenAI, Anthropic, Google, OpenRouter, and others) in Settings. Keys are stored in an isolated, encrypted environment and used only for workflows tied to that account. The platform does not rely on server-side LLM keys for those runs.
3. **Validation** – After keys are set and validated, workflows become available.
4. **Run** – Start a workflow: describe the contract in chat, then the pipeline runs spec, design, codegen, audit, Tenderly simulation and report, and optional deployment. Simulation and report appear in the same flow.

Key configuration can be removed at any time; keys are wiped without long-lived exposure.

---

## Web app areas (Studio)

- **Dashboard** – Workflows, deployments, and metrics. Onboarding checklist for first-time setup.
- **Workflows** – Create and monitor runs. Status, logs, and results. Workflows persist in Supabase when the backend is configured.
- **Contracts** – Generated Solidity and ABIs.
- **Deployments** – Deployment records and explorer links after deploy.
- **Settings** – Add, view, or remove LLM keys (BYOK). Keys are encrypted and not returned in full to the client.
- **Payments** – Add credits (USDC/USDT) when `CREDITS_ENABLED` is on. Credits are consumed per workflow run.

---

## Security and simulation

- Generated code is audited with static analysis (Slither, Mythril) and simulated (Tenderly) before deployment.
- Review the audit and simulation report before deploying to mainnet.
- Prefer testnets when evaluating new workflows.

---

## Related docs

- **First-time setup:** [Getting started](../introduction/getting-started.md)
- **Repository and local stack:** [Contributor guide](../contributing/developer-guide.md)
- **Troubleshooting:** [Troubleshooting](troubleshooting.md)
