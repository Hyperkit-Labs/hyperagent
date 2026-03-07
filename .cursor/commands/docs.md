# /docs

**Strict scope:** When answering documentation questions or loading doc context, read **only** from these two roots. All files and directories under them are the canonical doc set.

---

## 1. `.cursor/llm` (all files and directories)

LLM context and indexed project/docs. Read everything under `.cursor/llm/`.

### Root
- `llm.txt` – Project/LLM context index
- `README.md` – LLM context overview and index of `docs/`
- `app-index.txt` – (If present) Full app index from `/index`

### `.cursor/llm/docs/*` (all files)
- `README.md` – Index of llm.txt resources
- `thirdweb-llm.txt`
- `langgraph-llm.txt`
- `fastapi-llm.txt`
- `nextjs-llm.txt`
- `nextjs-react-llm.txt`
- `wagmi-llm.txt`
- `viem-llm.txt`
- `tenderly-llm.txt`
- `hardhat-llm.txt`
- `foundry-llm.txt`
- `hardhat-foundry-llm.txt`
- `langchain-llm.txt`
- `anthropic-openai-llm.txt`
- `gemini-llm.txt`
- `supabase-llm.txt`
- `redis-llm.txt`
- `pinecone-llm.txt`
- `acontext-llm.txt`
- `docker-llm.txt`
- `dune-analytics-llm.txt`
- `slither-mythril-llm.txt`
- `ipfs-pinata-llm.txt`
- `opentelemetry-llm.txt`
- `openzeppelin-llm.txt`
- `mlflow-llm.txt`
- `erc1066-x402-llm.txt`
- `x402-llm.txt`
- `erc-4337-llm.txt`
- `erc-8004-llm.txt`
- `eigenda-llm.txt`
- `llm.txt`

---

## 2. `external/docs` (all files and directories)

External spec, runbooks, and implementation docs. Read everything under `external/docs/`.

### `external/docs/detailed/*`

### `external/docs/runbooks/*`
---

## Rule

For any request that needs documentation or context: **strictly read from `.cursor/llm` and `external/docs`** (all files and directories listed above). Do not treat other `docs/` or `docs/*` paths as authoritative unless they are linked from or duplicated under these two roots. When in doubt, prefer `.cursor/llm/README.md`, `.cursor/llm/docs/README.md`, and `external/docs/detailed/draft.md` as entry points.
