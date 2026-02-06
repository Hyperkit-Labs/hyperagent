import { NodeRegistry } from "../core/graph/engine";
import { policyNode } from "./policyNode";
import { generateNode } from "./generateNode";
import { auditNode } from "./auditNode";
import { validateNode } from "./validateNode";
import { deployNode } from "./deployNode";
import { eigendaNode } from "./eigendaNode";
import { monitorNode } from "./monitorNode";

/**
 * Node registry - all 7 nodes from blueprint
 */
export const nodeRegistry: NodeRegistry = {
  policy: policyNode,
  generate: generateNode,
  audit: auditNode,
  validate: validateNode,
  deploy: deployNode,
  eigenda: eigendaNode,
  monitor: monitorNode,
};

