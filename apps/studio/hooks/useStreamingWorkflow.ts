"use client";

import { useState, useCallback } from "react";
import {
  createWorkflow,
  DEFAULT_NETWORK,
  requireLLMKeys,
  LLM_KEYS_REQUIRED_MESSAGE,
} from "@/lib/api";

interface UseStreamingWorkflowOptions {
  onComplete?: (workflowId: string) => void;
  onError?: (error: Error) => void;
}

interface StreamingState {
  isStreaming: boolean;
  text: string;
  error: Error | null;
}

/**
 * Creates a workflow via lib/api createWorkflow (backend contract: nlp_input, network)
 * and calls onComplete with the workflow_id. For streaming on the workflow detail
 * page use useWorkflowStreaming instead.
 */
export function useStreamingWorkflow(
  options: UseStreamingWorkflowOptions = {},
) {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    text: "",
    error: null,
  });

  const streamWorkflow = useCallback(
    async (prompt: string, network?: string, templateId?: string) => {
      setState({ isStreaming: true, text: "", error: null });

      try {
        const { ok } = await requireLLMKeys();
        if (!ok) {
          const err = new Error(LLM_KEYS_REQUIRED_MESSAGE);
          setState({ isStreaming: false, text: "", error: err });
          if (options.onError) options.onError(err);
          throw err;
        }
        const body: Parameters<typeof createWorkflow>[0] = {
          nlp_input: prompt,
          network: network || DEFAULT_NETWORK,
        };
        if (templateId) body.template_id = templateId;
        const result = await createWorkflow(body);

        setState({ isStreaming: false, text: "", error: null });

        if (options.onComplete && result.workflow_id) {
          options.onComplete(result.workflow_id);
        }

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        setState({ isStreaming: false, text: "", error: err });

        if (options.onError) {
          options.onError(err);
        }

        throw err;
      }
    },
    [options.onComplete, options.onError],
  );

  return {
    streamWorkflow,
    isStreaming: state.isStreaming,
    text: state.text,
    error: state.error,
  };
}
