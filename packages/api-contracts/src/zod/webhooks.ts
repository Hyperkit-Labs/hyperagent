import { z } from "zod";

/** POST /api/v1/storage/webhooks/pinata — Pinata may send varying JSON; we only require an object. */
export const pinataWebhookPayloadSchema = z.record(z.string(), z.unknown());

/** Successful handler body from `pinata_pin_webhook`. */
export const pinataWebhookResponseSchema = z.discriminatedUnion("processed", [
  z.object({
    ok: z.literal(true),
    processed: z.literal(false),
    reason: z.string(),
  }),
  z.object({
    ok: z.literal(true),
    processed: z.literal(true),
    cid: z.string(),
    rows_updated: z.number(),
  }),
]);

export type PinataWebhookResponse = z.infer<typeof pinataWebhookResponseSchema>;
