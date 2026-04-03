# Getting started

Run HyperAgent locally and locate support references. For Studio usage, see the [Studio guide](user-guide.md). For repository work, see the [Contributor guide](developer-guide.md).

---

## Requirements

- **Node.js** 18 or higher
- **pnpm** 8 or higher ([install pnpm](https://pnpm.io/installation))
- **Git**
- (Optional) **Python** 3.11+ and **Docker** for a local backend stack

---

## Run locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/Hyperkit-Labs/hyperagent.git
   cd hyperagent
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment**
   - Copy `.env.example` to `.env` in the repo root.
   - Set at least:
     - `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` (wallet connect and x402).
     - `NEXT_PUBLIC_API_URL` (for example `http://localhost:4000` when using the gateway; see below).

4. **Start the backend (Docker)**
   ```bash
   make up
   ```
   Starts the API gateway (port 4000), orchestrator, agent-runtime, compile, and audit services. Requires `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, Upstash REST credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) for production gateway rate limiting, and `REDIS_URL` (TCP) for orchestrator queue and checkpointer when those features are enabled.

5. **Start the frontend (Studio)**
   ```bash
   pnpm --filter hyperagent-studio dev
   ```
   Or from the app directory:
   ```bash
   cd apps/studio && pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

6. **Verify**
   - `curl -s http://localhost:4000/health` returns `{"status":"ok","gateway":true}`.
   - In Studio, connect a wallet and add LLM keys under Settings (BYOK).

---

## Support

- **Bugs and features:** [GitHub Issues](https://github.com/Hyperkit-Labs/hyperagent/issues)
- **Questions:** [GitHub Discussions](https://github.com/Hyperkit-Labs/hyperagent/discussions)
- **Studio usage:** [Studio guide](user-guide.md)
- **Repository and setup:** [Contributor guide](developer-guide.md)
- **"Failed to fetch" / Settings (BYOK):** [Troubleshooting](troubleshooting.md)
