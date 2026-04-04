import { z } from "zod";

/** Common FastAPI / HTTP error JSON shapes for client-side parsing. */
export const fastApiDetailItemSchema = z.object({
  loc: z.array(z.union([z.string(), z.number()])).optional(),
  msg: z.string(),
  type: z.string().optional(),
});

export const httpErrorBodySchema = z
  .object({
    detail: z.union([z.string(), z.array(fastApiDetailItemSchema)]).optional(),
    message: z.string().optional(),
    error: z.string().optional(),
    code: z.string().optional(),
  })
  .passthrough();

export type HttpErrorBody = z.infer<typeof httpErrorBodySchema>;
