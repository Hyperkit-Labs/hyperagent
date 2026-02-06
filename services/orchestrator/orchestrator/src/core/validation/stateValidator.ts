import { HyperAgentState, validateStateShape } from "../spec/state";
import { NodeType, VALID_TRANSITIONS } from "../spec/nodes";

/**
 * Verify state has all required fields and no extra keys
 */
export function validateState(state: unknown): asserts state is HyperAgentState {
  if (!validateStateShape(state)) {
    throw new Error("Invalid state shape: missing required fields or extra keys");
  }
  validateNoExtraFields(state as HyperAgentState);
}

/**
 * Verify a transition is valid according to VALID_TRANSITIONS
 */
export function validateTransition(
  fromNode: NodeType,
  toNode: NodeType | null,
): void {
  if (toNode === null) {
    // Terminal nodes can have null nextNode
    return;
  }

  const allowed = VALID_TRANSITIONS[fromNode];
  if (!allowed.includes(toNode)) {
    throw new Error(
      `Invalid transition: ${fromNode} → ${toNode}. Allowed: ${allowed.join(", ")}`,
    );
  }
}

/**
 * Verify state has no extra fields beyond the 7 required ones
 */
export function validateNoExtraFields(state: HyperAgentState): void {
  const allowedKeys = new Set([
    "intent",
    "contract",
    "auditResults",
    "deploymentAddress",
    "txHash",
    "status",
    "logs",
    "meta",
  ]);

  const stateKeys = Object.keys(state);
  const extraKeys = stateKeys.filter((key) => !allowedKeys.has(key));

  if (extraKeys.length > 0) {
    throw new Error(
      `State contains extra fields not in spec: ${extraKeys.join(", ")}`,
    );
  }
}

