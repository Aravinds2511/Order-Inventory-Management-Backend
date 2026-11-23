import { z } from "zod";

export const createProductSchema = z.object({
    name: z
        .string({ required_error: "Product name is required" })
        .trim()
        .min(1, "Product name cannot be empty")
        .max(200, "Product name cannot exceed 200 characters"),
    sku: z
        .string({ required_error: "SKU is required" })
        .trim()
        .min(1, "SKU cannot be empty")
        .max(64, "SKU cannot exceed 64 characters"),
    description: z
        .string()
        .trim()
        .optional(),
    priceInPaise: z
        .number({ required_error: "Price is required" })
        .int("Price must be an integer")
        .positive("Price must be greater than 0"),
    initialStock: z
        .number()
        .int("Initial stock must be an integer")
        .nonnegative("Initial stock cannot be negative")
        .default(0)
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
