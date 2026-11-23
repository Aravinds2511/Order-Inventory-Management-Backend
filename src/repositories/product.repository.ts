import { prisma } from "../db/prisma.js";
import type { CreateProductInput } from "../validation/product.schema.js";

export class ProductRepository {
    async findAll() {
        return prisma.product.findMany({
            where: {
                isActive: true
            },
            include: {
                inventory: true
            },
            orderBy: {
                createdAt: "desc"
            }
        });
    }

    async findById(id: string) {
        return prisma.product.findUnique({
            where: {
                id
            },
            include: {
                inventory: true
            }
        });
    }

    async findBySku(sku: string) {
        return prisma.product.findUnique({
            where: {
                sku
            }
        });
    }

    async create(input: CreateProductInput) {
        return prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    name: input.name,
                    sku: input.sku,
                    description: input.description ?? null,
                    priceInPaise: input.priceInPaise,
                    inventory: {
                        create: {
                            quantity: input.initialStock ?? 0
                        }
                    }
                },
                include: {
                    inventory: true
                }
            });

            return product;
        });
    }
}
