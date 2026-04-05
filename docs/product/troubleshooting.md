# Troubleshooting

Short pointers for common local setup issues. For the full doc index, see the repository [docs folder on GitHub](https://github.com/Hyperkit-Labs/hyperagent/tree/main/docs) or the MkDocs nav starting at [Home](../index.md).

| Symptom | Things to check |
|---------|------------------|
| Studio cannot reach API | `NEXT_PUBLIC_API_URL`, gateway running, CORS and auth |
| Orchestrator errors on start | Python version, `.env`, Supabase and Redis URLs |
| Wallet or session issues | Thirdweb client ID, SIWE domain, browser extensions |

Add more entries as patterns emerge. Prefer linking to runbooks for production incidents.
