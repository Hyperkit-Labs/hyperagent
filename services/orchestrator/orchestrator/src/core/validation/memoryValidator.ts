import { NodeType } from "../spec/nodes";
import { MEMORY_INTEGRATION_POINTS, MemoryOperation } from "../spec/memory";

/**
 * Verify memory operation is allowed for a node type
 */
export function validateMemoryOperation(
  nodeType: NodeType,
  operation: MemoryOperation,
): void {
  const integrationPoint = MEMORY_INTEGRATION_POINTS[nodeType];
  if (!integrationPoint) {
    throw new Error(`Node ${nodeType} is not allowed to use memory operations`);
  }

  if (integrationPoint.operation !== operation) {
    throw new Error(
      `Node ${nodeType} can only use operation "${integrationPoint.operation}", not "${operation}"`,
    );
  }
}

/**
 * Get allowed memory operation for a node type
 */
export function getAllowedMemoryOperation(
  nodeType: NodeType,
): MemoryOperation | null {
  const integrationPoint = MEMORY_INTEGRATION_POINTS[nodeType];
  return integrationPoint ? integrationPoint.operation : null;
}

