import { z } from "zod";

/** Parsed `data: {...}` payloads from workflow SSE streams (contract source / discussion). */
export const workflowSseDataSchema = z
  .object({
    text: z.string().optional(),
    done: z.boolean().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export type WorkflowSseData = z.infer<typeof workflowSseDataSchema>;
