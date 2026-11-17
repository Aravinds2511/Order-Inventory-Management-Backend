import "dotenv/config";

import { prisma } from "../src/db/prisma.js";

async function main() {
    await prisma.user.upsert({
        where: {
            email: "test.customer@example.com"
        },
        update: {},
        create: {
            id: "test-user-001",
            email: "test.customer@example.com",
            passwordHash: "dummy-hash-for-local-testing",
            role: "CUSTOMER"
        }
    });

    await prisma.product.upsert({
        where: {
            sku: "LAPTOP-001"
        },
        update: {},
        create: {
            sku: "LAPTOP-001",
            name: "Laptop",
            priceInPaise: 5000000,
            inventory: {
                create: {
                    quantity: 10
                }
            }
        }
    });

    await prisma.product.upsert({
        where: {
            sku: "KEYBOARD-001"
        },
        update: {},
        create: {
            sku: "KEYBOARD-001",
            name: "Mechanical Keyboard",
            priceInPaise: 250000,
            inventory: {
                create: {
                    quantity: 25
                }
            }
        }
    });

    console.log("Seed completed");
}

main()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
