import { z } from "zod";

export const createOrderItemSchema = z.object({
    productId: z
        .string({ required_error: "Product ID is required" })
        .trim()
        .min(1, "Product ID cannot be empty"),
    quantity: z
        .number({ required_error: "Quantity is required" })
        .int("Quantity must be an integer")
        .positive("Quantity must be a positive integer")
});

export const createOrderSchema = z.object({
    items: z
        .array(createOrderItemSchema)
        .min(1, "At least one product item must be supplied in an order")
});

export type CreateOrderBody = z.infer<typeof createOrderSchema>;
