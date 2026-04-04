# System context diagram

High-level view of major components and trust boundaries. This is **documentation**, not a deployment diagram for a specific environment.

```mermaid
flowchart TB
  subgraph clients["Client layer"]
    Studio["Studio (Next.js)"]
    CLI["CLI / future shells"]
  end

  subgraph edge["Edge"]
    GW["API gateway\nauth, rate limits, proxy"]
  end

  subgraph orch["Orchestration"]
    OG["Orchestrator\nLangGraph, workflows"]
    W["Workers / queues\n(Redis)"]
  end

  subgraph services["Execution plane"]
    SVC["Compile, audit, sim, deploy,\nagent-runtime, storage…"]
  end

  subgraph data["Data & artifacts"]
    SB["Supabase (Postgres, RLS)"]
    R["Redis"]
    IPFS["IPFS / Pinata\n(artifacts)"]
  end

  Studio --> GW
  CLI --> GW
  GW --> OG
  OG --> W
  OG --> SVC
  OG --> SB
  W --> R
  SVC --> SB
  SVC --> IPFS
```

For vocabulary and file-level mapping, see [architecture map](../agent-operating-model/architecture-map.md).
