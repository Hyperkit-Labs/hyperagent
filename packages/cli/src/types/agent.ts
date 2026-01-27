export type NodeType =
    | "policy"          // ERC compliance checking
    | "generate"        // LLM-based generation
    | "audit"           // Slither audit execution
    | "validate"        // Schema validation
    | "deploy"          // Thirdweb deployment
    | "eigenda"         // EigenDA proof storage
    | "monitor";        // Event monitoring + memory save

export const VALID_TRANSITIONS: Record<NodeType, NodeType[]> = {
    "policy": ["generate"],           // Always → generate
    "generate": ["audit"],              // Always → audit
    "audit": ["validate"],           // Always → validate
    "validate": ["deploy", "generate"], // → deploy if pass, else loop to generate
    "deploy": ["eigenda"],            // Always → eigenda
    "eigenda": ["monitor"],            // Always → monitor
    "monitor": [],                     // Always → success state (TERMINAL)
};

export type AgentStatus = "processing" | "auditing" | "validating" | "deploying" | "success" | "failed";

export type AuditResult = {
    passed: boolean;
    findings: string[];
};

export type HyperAgentState = {
    intent: string;
    contract: string;
    auditResults: AuditResult;
    deploymentAddress: string;
    txHash: string;
    proofHash: string;
    status: AgentStatus;
    logs: string[];
    retryCount: number;
};

export const MAX_RETRIES = 3;


export const INITIAL_STATE: HyperAgentState = {
    intent: "",
    contract: "",
    auditResults: { passed: false, findings: [] },
    deploymentAddress: "",
    txHash: "",
    proofHash: "",
    status: "processing",
    logs: [],
    retryCount: 0
};
