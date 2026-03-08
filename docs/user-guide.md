# User guide

How to use HyperAgent Studio as an end user: connect, configure keys, and run workflows.

---

## What HyperAgent does

HyperAgent turns natural language into smart contracts. You describe what you want; the platform generates Solidity, runs security checks and simulations, and can deploy to supported EVM chains. You stay in control of your keys and approvals.

---

## Core flow

1. **Connect** – Connect your wallet in the web app (e.g. MetaMask, WalletConnect). This identifies you and is used for deployment and payments.
2. **BYOK (Bring your own keys)** – Add your LLM API keys (e.g. OpenAI, Anthropic, Google, OpenRouter) in Settings. Keys are stored in an isolated, encrypted environment and used only for your workflows. The platform does not use server-side LLM keys for your runs.
3. **Approved** – After keys are set and validated, you can run workflows.
4. **Run** – Start a workflow: describe your contract in chat, then the pipeline runs spec, design, codegen, audit, Tenderly simulation and report, and (if you choose) deployment. You see simulation and report in the same flow.

You can remove your key configuration at any time; keys are then wiped with no long-lived exposure.

---

## Using the web app (Studio)

- **Dashboard** – Overview of workflows, deployments, and metrics. Onboarding checklist for first-time setup.
- **Workflows** – Create and monitor runs. View status, logs, and results. Workflows persist in Supabase when the backend is configured.
- **Contracts** – View generated Solidity and ABIs.
- **Deployments** – See deployment records and explorer links when you deploy.
- **Settings** – Add, view, or remove LLM keys (BYOK). Keys are encrypted and never returned to the client.
- **Payments** – Add credits (USDC/USDT) when `CREDITS_ENABLED` is on. Credits are consumed per workflow run.

---

## Security and simulation

- Generated code is audited with static analysis (Slither, Mythril) and simulated (Tenderly) before deployment.
- Always review the audit and simulation report before deploying to mainnet.
- Use testnets first when trying new workflows.

---

## Where to go next

- **First-time setup:** [Getting started](getting-started.md)
- **Running and changing the code:** [Developer guide](developer-guide.md)
- **Troubleshooting:** [Troubleshooting](troubleshooting.md)
