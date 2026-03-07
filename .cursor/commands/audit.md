/audit

You are an expert backend / infra architect and multi-agent systems auditor.  
You are auditing a multi-container system called **HyperAgent**, which is a full-stack AI-powered smart contract development pipeline spanning frontend, orchestration, agents, and core services.

Your goals:

1. Evaluate whether the **entire system** (frontend + backend + infra) is safe, resilient, and production-capable for real workloads.  
2. Identify risks, missing pieces, or misalignments between the current implementation and the intended design (BYOK, Spec Lock, multi-agent pipeline, audits, simulations, deployments).  
3. Prioritize concrete, realistic changes that move the system from “works in dev” to “handles real user runs with acceptable risk.”

When auditing, treat **everything as wired and running**:

- Frontend (Next.js/React/Tailwind, TypeScript) with project/workflow UI, run views, and spec-review UX.  
- API gateway and orchestrator (FastAPI / Python), including LangGraph-based workflows, BYOK, and Spec Lock.  
- Agent runtime services (Node/TypeScript) that consume `X-Agent-Session` and call tools.  
- Core services: compile, audit, simulation, deploy, storage, ROMA adapter, Supabase, Redis, VectorDB, and observability. 
***

### System context

HyperAgent:

- Takes natural-language specs and produces production-ready, audited, simulated, and deployed smart contracts across EVM networks. 
- Uses a composite multi-agent pipeline: **spec → design → codegen → audit (Slither/Mythril) → Tenderly simulation → deploy → UI scaffold → (future) monitor**.
- Uses **BYOK**: users provide LLM keys, stored encrypted at rest (Supabase `wallet_users.encrypted_llm_keys`), and passed at run-time only via short-lived agent session tokens (no long-lived server-side LLM config).
- Uses Supabase (Postgres + RLS) as the system of record for projects, runs, artifacts, deployments, simulations, and security findings. 
- Uses Slither + Mythril + Tenderly as mandatory gates before any deployment step, with ROMA optionally used for complex spec generation behind a human-approval gate.

***

### Audit dimensions

Evaluate and comment on each of the following, assuming the code and containers are wired as described:

1. **Frontend ↔ Backend wiring and UX safety**  
   - Are the **UI flows** (project creation, BYOK onboarding, run start, spec review/approval, viewing audits/simulations/deployments) correctly mapped to backend APIs?  
   - Does the UI clearly surface **risk and status** (e.g., when ROMA was used, when a spec needs human approval, when audits or simulations failed)?  
   - Does the frontend avoid leaking sensitive data (keys, raw logs) in the browser, local storage, or error messages?

2. **Auth, BYOK, and multi-tenant isolation**  
   - Does the API gateway correctly authenticate users (Supabase JWT or equivalent) and pass only minimal identity to backend services?  
   - Is BYOK implemented end-to-end as designed: encrypted at rest, decrypted only in orchestrator, and carried via short-lived agent session tokens into agent-runtime?  
   - Do RLS policies on Supabase tables (`projects`, `runs`, `project_artifacts`, `deployments`, `simulations`, `security_findings`, `storage_records`, `agent_context`, `wallet_users`, `user_profiles`, `user_api_keys`) guarantee that `auth.uid()` can only see and mutate their own data?

3. **Workflow correctness and reproducibility**  
   - For a single run, does the pipeline consistently follow:  
     **prompt + BYOK → spec (ROMA or local) → human review → design → codegen → compile → audit → deploy plan → simulation → UI scaffold**, without skipping mandatory safety stages?
   - Are **spec**, **design**, **artifacts**, **audit findings**, **deploy plans**, and **simulation results** all persisted with `run_id` and `project_id`, enabling full replay and external audit?
   - Does the `approve_spec` flow truly resume from design with the exact stored spec and context, so that human approval is a real gate and not bypassable?

4. **Service contracts and error handling**  
   - Are all internal service APIs (compile, audit, simulation, deploy, storage, roma-service, agent-runtime) using **stable, validated request/response schemas** with clear error envelopes?  
   - Does the orchestrator handle **partial failure** correctly: e.g., one audit tool times out, or simulation fails on a single chain, without corrupting run state or crashing the pipeline?  
   - Does the API gateway and frontend avoid exposing internal stack traces or raw service errors to end users, while still providing enough context to debug?

5. **ROMA integration and safety**  
   - Is ROMA called only when explicitly configured (`ROMA_API_URL` set), with a **dedicated profile** for HyperAgent spec generation (e.g., `hyperagent_spec`) and low `max_depth`?
   - Are ROMA outputs validated against Spec Lock (`SpecModel`) and always treated as **high-risk** (forced human approval, conservative `risk_profile`) until reviewed?  
   - Are there any paths where ROMA or LLM outputs could directly influence deploy/simulate without going through spec review and audit?

6. **Security tools, simulation, and deploy safety**  
   - Are Slither and Mythril actually being run with sane timeouts, and are their findings normalized and stored in `security_findings` with severity levels used as gates?
   - Is Tenderly simulation correctly invoked for every planned deployment, and is failure to simulate blocking or at least clearly surfaced to the user?
   - Does the deploy service only produce **plans** and never hold private keys, aligning with “client signs” and potential Thirdweb/x402 integration later?

7. **Data, memory, RAG, and storage**  
   - Does the system use Supabase + VectorDB (and optionally Qdrant/Acontext) in a way that avoids leaking secrets or contract-level PII in embeddings?
   - Are storage services (Pinata/IPFS, etc.) only used for non-sensitive artifacts (specs, reports, code, ABIs), with links recorded in `storage_records` and surfaced in the UI appropriately?  
   - Are there clear size limits, rate limits, and retries across storage and RAG paths to avoid DOS and cost blow-ups?

8. **Observability, rate limiting, and resilience**  
   - Are request IDs / run IDs propagated from frontend through gateway, orchestrator, and services, and logged in a structured way?
   - Are key endpoints (run start, audit, simulation, deploy, storage) protected by **Redis-backed rate limiting** and basic circuit-breaking so one abusive client or failing dependency doesn’t take down the system?
   - Are health checks and metrics in place for all containers (Supabase, Redis, VectorDB, ROMA, compile/audit/sim/deploy/storage) so the system can detect partial outages?

9. **Alignment with intended architecture and roadmap**  
   - Where does the current implementation **match** the design goals in Spec.md, draft.md, and Project-Details.md (BYOK, Spec Lock, multi-agent, chain registry, Tenderly, ERC8004 readiness)?
   - Where is it intentionally scoped down (e.g., no MythX/Echidna, single chain, no MonitorAgent), and is that acceptable for a Phase 1 closed beta?  
   - Which missing pieces are **critical blockers** for running real user workloads vs. **nice-to-have** improvements aligned with later milestones (monitoring agent, ERC8004 registries, EigenDA anchoring)?

***

### Expected output

Produce:

1. A **short narrative** describing how the system behaves today for a typical run from the point of view of a user and of an infra/security engineer.  
2. A **table** of findings with:  
   - Component (frontend, gateway, orchestrator, agent-runtime, compile, audit, simulation, deploy, storage, ROMA, Supabase, Redis, VectorDB)  
   - Severity (`critical`, `high`, `medium`, `low`, `info`)  
   - Description  
   - Recommended change (concrete and implementable)  
3. A **prioritized list (top 5)** of changes that would most improve safety and production readiness for HyperAgent’s current scope.

Focus on concrete implementation gaps and misconfigurations, not theoretical future features.