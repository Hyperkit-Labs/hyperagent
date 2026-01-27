import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { policyNode } from "./nodes/policy";
import { generateNode } from "./nodes/generate";
import { auditNode } from "./nodes/audit";
import { validateNode } from "./nodes/validate";
import { deployNode } from "./nodes/deploy";
import { eigendaNode } from "./nodes/eigenda";
import { monitorNode } from "./nodes/monitor";

// Define the State using Annotation (LangGraph 0.2+)
export const GraphState = Annotation.Root({
    intent: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
    contract: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
    auditResults: Annotation<{ passed: boolean; findings: string[] }>({
        reducer: (x, y) => y ?? x,
        default: () => ({ passed: false, findings: [] })
    }),
    deploymentAddress: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
    txHash: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
    proofHash: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
    status: Annotation<"processing" | "auditing" | "validating" | "deploying" | "success" | "failed">({
        reducer: (x, y) => y ?? x,
        default: () => "processing"
    }),
    logs: Annotation<string[]>({
        reducer: (x, y) => x.concat(y),
        default: () => []
    })
});

// Define conditional routing logic
const routeAfterValidation = (state: any) => {
    if (state.auditResults.passed) {
        return "deploy";
    }
    return "generate"; // Loop back for repair if audit failed
};

// Create the workflow
const workflow = new StateGraph(GraphState)
    .addNode("policy", policyNode)
    .addNode("generate", generateNode)
    .addNode("audit", auditNode)
    .addNode("validate", validateNode)
    .addNode("deploy", deployNode)
    .addNode("eigenda", eigendaNode)
    .addNode("monitor", monitorNode)
    .addEdge(START, "policy")
    .addEdge("policy", "generate")
    .addEdge("generate", "audit")
    .addEdge("audit", "validate")
    .addConditionalEdges("validate", routeAfterValidation, {
        "deploy": "deploy",
        "generate": "generate"
    })
    .addEdge("deploy", "eigenda")
    .addEdge("eigenda", "monitor")
    .addEdge("monitor", END);

// Compile
export const agentGraph = workflow.compile();
