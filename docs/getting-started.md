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
   - Copy `.env.example` to `.env` in the repo root (if present).
   - Set at least:
     - `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` (for wallet connect and x402).
     - `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:8000` if you run the backend locally).

4. **Start the frontend (Studio)**
   ```bash
   pnpm --filter hyperagent-studio dev
   ```
   Or from the app directory:
   ```bash
   cd apps/studio && pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

5. **Backend (optional)**  
   If you have a backend (e.g. API service) and Docker:
   - Use the project’s backend run instructions (e.g. `make up` or docker-compose) so the API is available at the URL you set in `NEXT_PUBLIC_API_URL`.  
   - The web app will call that URL for workflows and data.

---

## Get help

- **Bugs and features:** [GitHub Issues](https://github.com/Hyperkit-Labs/hyperagent/issues)  
- **Questions:** [GitHub Discussions](https://github.com/Hyperkit-Labs/hyperagent/discussions)  
- **Product usage:** [User guide](user-guide.md)  
- **Code and setup:** [Developer guide](developer-guide.md)  
- **"Failed to fetch" / Settings (BYOK):** [Troubleshooting](troubleshooting.md)
