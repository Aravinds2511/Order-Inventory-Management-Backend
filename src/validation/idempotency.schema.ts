import { z } from "zod";

export const idempotencyHeaderSchema = z.object({
    "idempotency-key": z
        .string({
            required_error: "Idempotency-Key header is required for this operation"
        })
        .trim()
        .min(8, "Idempotency-Key must be at least 8 characters long")
        .max(128, "Idempotency-Key cannot exceed 128 characters")
});

export type IdempotencyHeaders = z.infer<typeof idempotencyHeaderSchema>;
