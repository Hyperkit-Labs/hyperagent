import type { z } from "zod";

/** Parse JSON with a Zod schema; throws ZodError on mismatch. */
export function parseJsonWithSchema<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label = "response",
): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const msg = r.error.flatten();
    throw new Error(`${label} validation failed: ${JSON.stringify(msg)}`);
  }
  return r.data;
}

export function safeParseWithSchema<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const r = schema.safeParse(data);
  if (r.success) return { success: true, data: r.data };
  return { success: false, error: r.error };
}
