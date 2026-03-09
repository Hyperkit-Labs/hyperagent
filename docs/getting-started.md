# Getting started

Get HyperAgent running and find help. For detailed usage, see the [user guide](user-guide.md). For development setup, see the [developer guide](developer-guide.md).

---

## What you need

- **Node.js** 18 or higher
- **pnpm** 8 or higher ([install pnpm](https://pnpm.io/installation))
- **Git**
- (Optional) **Python** 3.11+ and **Docker** if you run the backend locally

---

## Run locally

1. **Clone the repo**
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
     - `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` (for wallet connect and x402).
     - `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:4000` when using the gateway; see below).

4. **Start the backend (Docker)**
   ```bash
   make up
   ```
   This starts the API gateway (port 4000), orchestrator, agent-runtime, compile, and audit services. Requires `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `REDIS_URL` in `.env` for full functionality.

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
   - Connect wallet in Studio and add LLM keys in Settings (BYOK).

---

## Get help

- **Bugs and features:** [GitHub Issues](https://github.com/Hyperkit-Labs/hyperagent/issues)
- **Questions:** [GitHub Discussions](https://github.com/Hyperkit-Labs/hyperagent/discussions)
- **Product usage:** [User guide](user-guide.md)
- **Code and setup:** [Developer guide](developer-guide.md)
- **"Failed to fetch" / Settings (BYOK):** [Troubleshooting](troubleshooting.md)
