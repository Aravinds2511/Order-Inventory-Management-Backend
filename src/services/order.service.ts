import { prisma } from "../db/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../errors/http-error.js";
import { orderEventBus } from "../events/order-event-bus.js";
import { withRetry, type RetryOptions } from "../utils/retry.js";

export interface CreateOrderInput {
    userId: string;

    items: {
        productId: string;
        quantity: number;
    }[];
}

/**
 * Identifies Prisma transaction conflict errors (P2034).
 * Prisma emits P2034 when a transaction fails due to a write conflict or serialization failure.
 */
export function isPrismaWriteConflictError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return error.code === "P2034";
    }

    if (typeof error === "object" && error !== null && "code" in error) {
        return (error as { code: unknown }).code === "P2034";
    }

    return false;
}

export class OrderService {
    constructor(private readonly db = prisma) { }

    async createOrder(input: CreateOrderInput, retryOptions?: RetryOptions) {
        // Validation 1: userId must be valid
        if (!input.userId || typeof input.userId !== "string" || input.userId.trim() === "") {
            throw new HttpError("Invalid userId: must be a non-empty string", "INVALID_USER_ID", 400);
        }

        // Validation 2: At least one product must be supplied
        if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
            throw new HttpError("At least one product must be supplied", "EMPTY_ORDER_ITEMS", 400);
        }

        // Validation 3 & 4: Validate product IDs and positive integer quantities
        // Validation 5: Normalize items by combining quantities for duplicate product IDs
        const quantityByProductId = new Map<string, number>();

        for (const item of input.items) {
            if (!item.productId || typeof item.productId !== "string" || item.productId.trim() === "") {
                throw new HttpError("Each product ID must be a non-empty string", "INVALID_PRODUCT_ID", 400);
            }

            if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                throw new HttpError(
                    `Quantity for product '${item.productId}' must be a positive integer`,
                    "INVALID_QUANTITY",
                    400
                );
            }

            const currentQuantity = quantityByProductId.get(item.productId) ?? 0;
            quantityByProductId.set(item.productId, currentQuantity + item.quantity);
        }

        // Sort requested product IDs in a deterministic order (Product 1 → Product 2 → Product 3)
        // to prevent lock-order conflicts and unnecessary deadlocks across concurrent transactions.
        const normalizedItems = Array.from(quantityByProductId.entries())
            .map(([productId, quantity]) => ({ productId, quantity }))
            .sort((a, b) => a.productId.localeCompare(b.productId));

        // Execute transaction with retry on write conflicts/deadlocks (P2034)
        const order = await withRetry(
            async () => {
                return this.db.$transaction(
                    async (tx) => {
                        // Ensure the user exists
                        const user = await tx.user.findUnique({
                            where: { id: input.userId }
                        });

                        if (!user) {
                            throw new HttpError(`User not found with ID '${input.userId}'`, "USER_NOT_FOUND", 404);
                        }

                        // Operation 1 — Retrieve products using transaction client tx
                        const productIds = normalizedItems.map(item => item.productId);
                        const products = await tx.product.findMany({
                            where: {
                                id: { in: productIds }
                            },
                            select: {
                                id: true,
                                priceInPaise: true,
                                isActive: true
                            }
                        });

                        const productMap = new Map(products.map(p => [p.id, p]));

                        for (const item of normalizedItems) {
                            const product = productMap.get(item.productId);
                            if (!product) {
                                throw new HttpError(
                                    `Product not found with ID '${item.productId}'`,
                                    "PRODUCT_NOT_FOUND",
                                    404
                                );
                            }

                            if (!product.isActive) {
                                throw new HttpError(
                                    `Product with ID '${item.productId}' is not active`,
                                    "PRODUCT_NOT_ACTIVE",
                                    400
                                );
                            }
                        }

                        // Operation 2 — Reserve inventory with atomic conditional update in sorted locking order
                        for (const item of normalizedItems) {
                            const result = await tx.inventory.updateMany({
                                where: {
                                    productId: item.productId,
                                    quantity: {
                                        gte: item.quantity
                                    }
                                },
                                data: {
                                    quantity: {
                                        decrement: item.quantity
                                    }
                                }
                            });

                            if (result.count !== 1) {
                                throw new HttpError(
                                    "Insufficient inventory",
                                    "INSUFFICIENT_INVENTORY",
                                    409
                                );
                            }
                        }

                        // Operation 3 — Calculate the order total using database product prices
                        let orderTotal = 0;
                        const orderItemsData = normalizedItems.map(item => {
                            const product = productMap.get(item.productId)!;
                            const unitPrice = product.priceInPaise;
                            const itemTotal = item.quantity * unitPrice;
                            orderTotal += itemTotal;

                            return {
                                productId: item.productId,
                                quantity: item.quantity,
                                unitPriceInPaise: unitPrice
                            };
                        });

                        // Operation 4 — Create the order with nested item creation
                        const createdOrder = await tx.order.create({
                            data: {
                                userId: input.userId,
                                status: "PENDING",
                                totalAmountInPaise: orderTotal,
                                items: {
                                    create: orderItemsData
                                }
                            },
                            include: {
                                items: true
                            }
                        });

                        // Operation 5 — Return created order
                        return createdOrder;
                    },
                    {
                        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                        maxWait: 5000,
                        timeout: 10000
                    }
                );
            },
            {
                maxAttempts: retryOptions?.maxAttempts ?? 3,
                baseDelayMs: retryOptions?.baseDelayMs ?? 50,
                maxDelayMs: retryOptions?.maxDelayMs ?? 500,
                shouldRetry: (err) => isPrismaWriteConflictError(err)
            }
        );

        // Emit order.created domain event after successful commit
        orderEventBus.emit("order.created", {
            orderId: order.id,
            userId: order.userId,
            totalAmountInPaise: order.totalAmountInPaise,
            occurredAt: order.createdAt
        });

        return order;
    }
}

export const orderService = new OrderService();
