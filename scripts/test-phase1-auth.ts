import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

import { appConfig } from "../src/config/env.js";
import { UserRole } from "../src/generated/prisma/client.js";
import {
    registerSchema,
    loginSchema,
    refreshTokenSchema
} from "../src/validation/auth.schema.js";
import { createProductSchema } from "../src/validation/product.schema.js";
import { createOrderSchema } from "../src/validation/order.schema.js";
import { authenticate, requireRole } from "../src/middleware/auth.js";
import { HttpError } from "../src/errors/http-error.js";
import { prisma } from "../src/db/prisma.js";
import { authService } from "../src/services/auth.service.js";
import { productService } from "../src/services/product.service.js";
import { orderService } from "../src/services/order.service.js";

async function runTests() {
    console.log("=== PHASE 1 AUTOMATED VERIFICATION SUITE ===\n");

    // -------------------------------------------------------------
    // SECTION 1: Zod Schema Validation Tests
    // -------------------------------------------------------------
    console.log("--- 1. Testing Zod Schemas ---");

    // 1.1 Register Schema
    assert.doesNotThrow(() => {
        registerSchema.parse({
            email: "user@example.com",
            password: "password123",
            role: "CUSTOMER"
        });
    }, "Valid register payload should pass");

    assert.throws(() => {
        registerSchema.parse({
            email: "invalid-email",
            password: "password123"
        });
    }, "Malformed email should fail validation");

    assert.throws(() => {
        registerSchema.parse({
            email: "user@example.com",
            password: "short"
        });
    }, "Password shorter than 8 chars should fail validation");

    assert.throws(() => {
        registerSchema.parse({
            email: "user@example.com",
            password: "password123",
            role: "SUPERADMIN"
        });
    }, "Invalid role should fail validation");

    // 1.2 Login Schema
    assert.doesNotThrow(() => {
        loginSchema.parse({
            email: "user@example.com",
            password: "password123"
        });
    }, "Valid login payload should pass");

    assert.throws(() => {
        loginSchema.parse({
            email: "",
            password: "password123"
        });
    }, "Empty email should fail validation");

    // 1.3 Refresh Token Schema
    assert.doesNotThrow(() => {
        refreshTokenSchema.parse({ refreshToken: "token-string-value" });
    }, "Valid refresh token should pass");

    assert.throws(() => {
        refreshTokenSchema.parse({ refreshToken: "" });
    }, "Empty refresh token should fail validation");

    // 1.4 Product Schema
    assert.doesNotThrow(() => {
        createProductSchema.parse({
            name: "Mechanical Keyboard",
            sku: "KB-001",
            priceInPaise: 499900,
            initialStock: 25
        });
    }, "Valid product payload should pass");

    assert.throws(() => {
        createProductSchema.parse({
            name: "",
            sku: "KB-001",
            priceInPaise: 1000
        });
    }, "Empty name should fail validation");

    assert.throws(() => {
        createProductSchema.parse({
            name: "Mechanical Keyboard",
            sku: "KB-001",
            priceInPaise: -500
        });
    }, "Negative price should fail validation");

    // 1.5 Order Schema
    assert.doesNotThrow(() => {
        createOrderSchema.parse({
            items: [{ productId: "p-01", quantity: 2 }]
        });
    }, "Valid order payload should pass");

    assert.throws(() => {
        createOrderSchema.parse({ items: [] });
    }, "Empty order items array should fail validation");

    assert.throws(() => {
        createOrderSchema.parse({
            items: [{ productId: "p-01", quantity: 0 }]
        });
    }, "Zero or negative item quantity should fail validation");

    console.log("✔ All Zod schema validation checks passed.\n");

    // -------------------------------------------------------------
    // SECTION 2: Authentication Middleware Tests
    // -------------------------------------------------------------
    console.log("--- 2. Testing Auth Middleware ---");

    const dummyRes = {} as Response;

    // 2.1 Missing Authorization Header
    assert.throws(
        () => authenticate({ headers: {} } as Request, dummyRes, () => { }),
        (err: unknown) => err instanceof HttpError && err.code === "UNAUTHORIZED",
        "Missing header should throw UNAUTHORIZED"
    );

    // 2.2 Invalid Token
    assert.throws(
        () => authenticate({ headers: { authorization: "Bearer invalid.jwt.token" } } as Request, dummyRes, () => { }),
        (err: unknown) => err instanceof HttpError && err.code === "INVALID_TOKEN",
        "Malformed token should throw INVALID_TOKEN"
    );

    // 2.3 Valid Token
    const validToken = jwt.sign(
        { sub: "usr-123", email: "test@example.com", role: UserRole.CUSTOMER },
        appConfig.jwtSecret,
        { expiresIn: "15m" }
    );

    const mockReq = { headers: { authorization: `Bearer ${validToken}` } } as Request;
    let nextCalled = false;
    authenticate(mockReq, dummyRes, () => { nextCalled = true; });

    assert.equal(nextCalled, true, "Valid token should invoke next()");
    assert.deepEqual(
        mockReq.user,
        { id: "usr-123", email: "test@example.com", role: UserRole.CUSTOMER },
        "req.user should be populated"
    );

    // 2.4 Role Guards
    const adminGuard = requireRole([UserRole.ADMIN]);

    assert.throws(
        () => adminGuard(mockReq, dummyRes, () => { }),
        (err: unknown) => err instanceof HttpError && err.code === "FORBIDDEN",
        "CUSTOMER accessing ADMIN route should throw FORBIDDEN"
    );

    const adminReq = {
        user: { id: "admin-1", email: "admin@example.com", role: UserRole.ADMIN }
    } as Request;

    let adminNextCalled = false;
    adminGuard(adminReq, dummyRes, () => { adminNextCalled = true; });
    assert.equal(adminNextCalled, true, "ADMIN accessing ADMIN route should be permitted");

    console.log("✔ All Auth middleware checks passed.\n");

    // -------------------------------------------------------------
    // SECTION 3: Live Database & Integration Tests
    // -------------------------------------------------------------
    console.log("--- 3. Testing Live Database Integration ---");

    let isDbAvailable = false;
    try {
        await prisma.$queryRaw`SELECT 1`;
        isDbAvailable = true;
    } catch {
        console.log("⚠️  PostgreSQL is not currently running on localhost:5432.");
        console.log("    To run live database integration tests, start PostgreSQL via:");
        console.log("    sudo service postgresql start\n");
    }

    if (isDbAvailable) {
        console.log("Database connection confirmed. Running end-to-end service tests...");
        const randomSuffix = Math.floor(Math.random() * 100000);
        const customerEmail = `customer_${randomSuffix}@example.com`;
        const adminEmail = `admin_${randomSuffix}@example.com`;

        // 3.1 Register Customer
        const customerReg = await authService.register({
            email: customerEmail,
            password: "password123",
            role: "CUSTOMER"
        });

        assert.equal(customerReg.user.email, customerEmail);
        assert.equal(customerReg.user.role, UserRole.CUSTOMER);
        assert.ok(customerReg.tokens.accessToken);
        assert.ok(customerReg.tokens.refreshToken);
        console.log("✔ Customer registration passed.");

        // 3.2 Duplicate Email Conflict
        await assert.rejects(
            async () => authService.register({
                email: customerEmail,
                password: "password123"
            }),
            (err: unknown) => err instanceof HttpError && err.code === "EMAIL_ALREADY_EXISTS"
        );
        console.log("✔ Duplicate registration rejection passed.");

        // 3.3 Admin Registration Guard
        await assert.rejects(
            async () => authService.register({
                email: adminEmail,
                password: "password123",
                role: "ADMIN",
                adminSecret: "wrong-secret"
            }),
            (err: unknown) => err instanceof HttpError && err.code === "INVALID_ADMIN_SECRET"
        );
        console.log("✔ Admin registration secret enforcement passed.");

        // 3.4 Admin Registration Success
        const adminReg = await authService.register({
            email: adminEmail,
            password: "password123",
            role: "ADMIN",
            adminSecret: appConfig.adminRegistrationSecret
        });
        assert.equal(adminReg.user.role, UserRole.ADMIN);
        console.log("✔ Admin registration passed.");

        // 3.5 Customer Login
        const loginRes = await authService.login({
            email: customerEmail,
            password: "password123"
        });
        assert.ok(loginRes.tokens.accessToken);
        assert.ok(loginRes.tokens.refreshToken);
        console.log("✔ Customer login passed.");

        // 3.6 Refresh Token Rotation
        const rotated = await authService.refresh(loginRes.tokens.refreshToken);
        assert.ok(rotated.accessToken);
        assert.ok(rotated.refreshToken);
        assert.notEqual(rotated.refreshToken, loginRes.tokens.refreshToken);
        console.log("✔ Refresh token rotation passed.");

        // 3.7 Reuse Detection
        await assert.rejects(
            async () => authService.refresh(loginRes.tokens.refreshToken),
            (err: unknown) => err instanceof HttpError && err.code === "TOKEN_REUSE_DETECTED"
        );
        console.log("✔ Refresh token reuse detection & revocation passed.");

        // 3.8 Admin Catalog Creation
        const productSku = `SKU-${randomSuffix}`;
        const product = await productService.createProduct({
            name: `Test Product ${randomSuffix}`,
            sku: productSku,
            priceInPaise: 250000,
            initialStock: 10
        });
        assert.equal(product.sku, productSku);
        assert.equal(product.inventory?.quantity, 10);
        console.log("✔ Admin product creation & inventory seeding passed.");

        // 3.9 Order Creation with Authenticated Customer ID
        const order = await orderService.createOrder({
            userId: customerReg.user.id,
            items: [{ productId: product.id, quantity: 2 }]
        });
        assert.equal(order.userId, customerReg.user.id);
        assert.equal(order.items.length, 1);
        assert.equal(order.items[0]?.quantity, 2);
        console.log("✔ Authenticated customer order creation passed.");

        console.log("\n🎉 ALL PHASE 1 INTEGRATION TESTS COMPLETED SUCCESSFULLY!");
    } else {
        console.log("🎉 ALL IN-MEMORY & UNIT PHASE 1 TESTS COMPLETED SUCCESSFULLY!");
    }
}

runTests()
    .then(async () => {
        await prisma.$disconnect();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error("Test failed:", error);
        await prisma.$disconnect();
        process.exit(1);
    });
