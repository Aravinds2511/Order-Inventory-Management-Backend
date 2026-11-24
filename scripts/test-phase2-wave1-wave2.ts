import assert from "node:assert/strict";
import crypto from "node:crypto";

import { stableStringify, generateRequestHash } from "../src/utils/hash.js";
import { idempotencyHeaderSchema } from "../src/validation/idempotency.schema.js";
import { lockStore } from "../src/db/redis.js";
import { idempotencyService } from "../src/services/idempotency.service.js";
import { prisma } from "../src/db/prisma.js";
import { HttpError } from "../src/errors/http-error.js";
import { UserRole } from "../src/generated/prisma/client.js";

async function runTests() {
    console.log("=== PHASE 2: WAVE 1 & WAVE 2 VERIFICATION SUITE ===\n");

    // -------------------------------------------------------------
    // SECTION 1: Hashing & Serialization Tests
    // -------------------------------------------------------------
    console.log("--- 1. Testing Deterministic Hash Generator ---");

    const payloadA = { sku: "ABC", quantity: 2, meta: { tags: ["tech", "gadget"], priority: 1 } };
    const payloadB = { meta: { priority: 1, tags: ["tech", "gadget"] }, quantity: 2, sku: "ABC" };

    const hashA = generateRequestHash("/api/v1/orders", payloadA);
    const hashB = generateRequestHash("/api/v1/orders", payloadB);

    assert.equal(hashA, hashB, "Different key order must produce identical hash");

    const payloadC = { sku: "ABC", quantity: 3, meta: { tags: ["tech", "gadget"], priority: 1 } };
    const hashC = generateRequestHash("/api/v1/orders", payloadC);
    assert.notEqual(hashA, hashC, "Different payload values must produce different hash");

    console.log("✔ Deterministic request hashing passed.\n");

    // -------------------------------------------------------------
    // SECTION 2: Idempotency Header Validation
    // -------------------------------------------------------------
    console.log("--- 2. Testing Idempotency Header Validation ---");

    assert.doesNotThrow(() => {
        idempotencyHeaderSchema.parse({ "idempotency-key": "idem-key-12345" });
    });

    assert.throws(() => {
        idempotencyHeaderSchema.parse({ "idempotency-key": "short" });
    });

    assert.throws(() => {
        idempotencyHeaderSchema.parse({});
    });

    console.log("✔ Header validation schemas passed.\n");

    // -------------------------------------------------------------
    // SECTION 3: Lock Store (Redis / In-Memory Fallback)
    // -------------------------------------------------------------
    console.log("--- 3. Testing Mutex Lock Store ---");

    const testKey = `test:lock:${crypto.randomUUID()}`;
    const firstAcquire = await lockStore.setNX(testKey, "LOCKED", 5);
    assert.equal(firstAcquire, true, "First acquire must succeed");

    const secondAcquire = await lockStore.setNX(testKey, "LOCKED", 5);
    assert.equal(secondAcquire, false, "Second acquire on active lock must fail");

    await lockStore.del(testKey);
    const thirdAcquire = await lockStore.setNX(testKey, "LOCKED", 5);
    assert.equal(thirdAcquire, true, "Acquire after delete must succeed");
    await lockStore.del(testKey);

    console.log("✔ Mutex lock store operations passed.\n");

    // -------------------------------------------------------------
    // SECTION 4: Idempotency Service & Database Integration
    // -------------------------------------------------------------
    console.log("--- 4. Testing Idempotency Service (Database Integration) ---");

    const randomId = crypto.randomUUID().slice(0, 8);
    const user = await prisma.user.create({
        data: {
            email: `idem_test_${randomId}@example.com`,
            passwordHash: "argon2_mock_hash",
            role: UserRole.CUSTOMER
        }
    });

    const otherUser = await prisma.user.create({
        data: {
            email: `other_${randomId}@example.com`,
            passwordHash: "argon2_mock_hash",
            role: UserRole.CUSTOMER
        }
    });

    const idemKey = `idem-${randomId}-${Date.now()}`;
    const endpoint = "/api/v1/orders";
    const initialPayload = { items: [{ productId: "p-1", quantity: 1 }] };
    const initialHash = generateRequestHash(endpoint, initialPayload);

    // 4.1 Acquire in-flight lock
    await idempotencyService.acquireLock(user.id, idemKey);

    // 4.2 Duplicate in-flight lock throws 409
    await assert.rejects(
        async () => idempotencyService.acquireLock(user.id, idemKey),
        (err: unknown) => err instanceof HttpError && err.code === "IDEMPOTENCY_KEY_IN_FLIGHT" && err.statusCode === 409,
        "Duplicate in-flight lock must throw IDEMPOTENCY_KEY_IN_FLIGHT (409)"
    );

    // 4.3 Release lock
    await idempotencyService.releaseLock(user.id, idemKey);

    // 4.4 Save completed record
    const mockOrderResponse = {
        success: true,
        data: { id: `ord-${randomId}`, totalAmountInPaise: 5000 }
    };

    await idempotencyService.saveRecord({
        key: idemKey,
        userId: user.id,
        endpoint,
        requestHash: initialHash,
        statusCode: 201,
        responseBody: mockOrderResponse
    });

    // 4.5 Fetch cached record with matching hash -> returns cached response
    const cached = await idempotencyService.getExistingRecord(idemKey, user.id, initialHash);
    assert.ok(cached, "Cached record must exist");
    assert.equal(cached.statusCode, 201);
    assert.deepEqual(cached.responseBody, mockOrderResponse);

    // 4.6 Fetch cached record with modified hash -> throws 422
    const alteredPayload = { items: [{ productId: "p-1", quantity: 99 }] };
    const alteredHash = generateRequestHash(endpoint, alteredPayload);

    await assert.rejects(
        async () => idempotencyService.getExistingRecord(idemKey, user.id, alteredHash),
        (err: unknown) => err instanceof HttpError && err.code === "IDEMPOTENCY_PAYLOAD_MISMATCH" && err.statusCode === 422,
        "Altered payload on existing key must throw IDEMPOTENCY_PAYLOAD_MISMATCH (422)"
    );

    // 4.7 Cross-user access attempt on same key -> throws 403
    await assert.rejects(
        async () => idempotencyService.getExistingRecord(idemKey, otherUser.id, initialHash),
        (err: unknown) => err instanceof HttpError && err.code === "IDEMPOTENCY_KEY_OWNERSHIP_MISMATCH" && err.statusCode === 403,
        "Other user accessing key must throw IDEMPOTENCY_KEY_OWNERSHIP_MISMATCH (403)"
    );

    // Cleanup test users and records
    await prisma.user.deleteMany({
        where: { id: { in: [user.id, otherUser.id] } }
    });

    console.log("✔ Full IdempotencyService database tests passed.\n");
    console.log("🎉 WAVE 1 & WAVE 2 VERIFICATION COMPLETE!");
}

runTests()
    .then(async () => {
        await lockStore.quit();
        await prisma.$disconnect();
        process.exit(0);
    })
    .catch(async (err) => {
        console.error("Test failure:", err);
        await lockStore.quit();
        await prisma.$disconnect();
        process.exit(1);
    });
