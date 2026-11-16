import { prisma } from "../db/prisma.js";

export class ProductRepository {
    async findAll() {
        return prisma.product.findMany({
            where: {
                isActive: true
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
            }
        });
    }
}
