import { HyperAgentState } from "../spec/state";
import { NodeType, VALID_TRANSITIONS, NodeImplementation } from "../spec/nodes";
import { validateState, validateTransition } from "../validation/stateValidator";
import { withUpdates } from "../spec/state";
import { RETRY_POLICY } from "../spec/errors";

/**
 * Node registry - maps node types to implementations
 */
export interface NodeRegistry {
  [key: string]: NodeImplementation;
}

export type TransitionObserver = (args: {
  node: NodeType;
  state: HyperAgentState;
}) => Promise<void> | void;

/**
 * Simple state machine orchestrator
 * Executes nodes in sequence according to VALID_TRANSITIONS
 */
export async function runGraph(
  startNode: NodeType,
  initial: HyperAgentState,
  nodeRegistry: NodeRegistry,
  onTransition?: TransitionObserver,
): Promise<HyperAgentState> {
  let currentNode: NodeType = startNode;
  let state = initial;

  // Validate initial state
  validateState(state);

  while (true) {
    // Step guard to prevent infinite loops (e.g. validate -> generate)
    const currentStep = state.meta.execution.step;
    if (currentStep >= state.meta.execution.maxSteps) {
      throw new Error(
        `Max steps exceeded (${state.meta.execution.maxSteps}). Last node: ${currentNode}`,
      );
    }
    state = withUpdates(state, {
      meta: {
        execution: {
          step: currentStep + 1,
          maxSteps: state.meta.execution.maxSteps,
        },
      } as any,
    });

    const nodeImpl = nodeRegistry[currentNode];
    if (!nodeImpl) {
      throw new Error(`No implementation found for node: ${currentNode}`);
    }

    // Validate state before node execution
    validateState(state);

    // Execute node
    const startedAt = Date.now();
    const nextState = await executeWithTimeout(
      () => nodeImpl.execute(state),
      nodeImpl.definition.timeoutMs,
      `Node timeout: ${currentNode}`,
    );
    const durationMs = Date.now() - startedAt;

    // Validate output state
    validateState(nextState);

    if (onTransition) {
      await onTransition({ node: currentNode, state: nextState });
    }

    // Determine next node
    // Some nodes (like validate) have conditional routing based on state
    let nextNode: NodeType | null = nodeImpl.definition.nextNode;

    // Handle conditional routing for validate node
    if (currentNode === "validate") {
      // If validation passed, go to deploy; otherwise loop back to generate
      const isValid = nextState.contract.length > 0 && nextState.auditResults.passed;
      nextNode = isValid ? "deploy" : "generate";
    }

    // Validate transition
    if (nextNode !== null) {
      validateTransition(currentNode, nextNode);
    }

    // Update state
    state = withUpdates(nextState, {
      logs: [...nextState.logs, `[ENGINE] ${currentNode} durationMs=${durationMs}`],
    });

    // Check if terminal
    if (nextNode === null || currentNode === "monitor") {
      return state;
    }

    currentNode = nextNode;
  }
}

/**
 * Run graph with retry logic
 */
export async function runGraphWithRetry(
  startNode: NodeType,
  initial: HyperAgentState,
  nodeRegistry: NodeRegistry,
  maxRetries = RETRY_POLICY.maxRetries,
): Promise<HyperAgentState> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await runGraph(startNode, initial, nodeRegistry);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        // Wait before retry (spec-locked backoff)
        const delay =
          attempt < RETRY_POLICY.sequence.length
            ? RETRY_POLICY.sequence[attempt]
            : RETRY_POLICY.maxDelayMs;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Graph execution failed after retries");
}

async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

