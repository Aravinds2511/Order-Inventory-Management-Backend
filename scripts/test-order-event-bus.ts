/**
 * scripts/test-order-event-bus.ts
 *
 * Test suite for OrderEventBus covering all required scenarios:
 * 1. Register and emit order.created -> Handler executes
 * 2. Register two listeners -> Both execute in registration order
 * 3. Register once() listener -> Executes only once
 * 4. Remove listener using off() -> Removed listener doesn't execute
 * 5. Incorrect event payload -> TypeScript compilation error
 * 6. Incorrect event name -> TypeScript compilation error
 *
 * Usage:
 *   npx tsx scripts/test-order-event-bus.ts
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { OrderEventBus } from "../src/events/order-event-bus.js";
import type { OrderCreatedEvent, OrderCancelledEvent } from "../domain/order-events.js";

async function runTest(name: string, fn: () => void | Promise<void>): Promise<boolean> {
    process.stdout.write(`Testing: ${name}... `);
    const start = Date.now();
    try {
        await fn();
        const duration = (Date.now() - start).toFixed(0);
        console.log(`\x1b[32mPASSED\x1b[0m (${duration}ms)`);
        return true;
    } catch (err) {
        const duration = (Date.now() - start).toFixed(0);
        console.log(`\x1b[31mFAILED\x1b[0m (${duration}ms)`);
        console.error(`  Error: ${(err as Error).message}`);
        return false;
    }
}

async function main() {
    console.log("=".repeat(70));
    console.log("Running OrderEventBus Test Suite");
    console.log("=".repeat(70));

    const results: boolean[] = [];

    // Scenario 1: Register and emit order.created -> Handler executes
    results.push(
        await runTest("Scenario 1: Register and emit order.created -> Handler executes", () => {
            const bus = new OrderEventBus();
            let receivedPayload: OrderCreatedEvent | null = null;

            bus.on("order.created", (payload) => {
                receivedPayload = payload;
            });

            const testEvent: OrderCreatedEvent = {
                orderId: "ORD_TEST_001",
                userId: "USER_TEST_001",
                totalAmountInPaise: 49900,
                occurredAt: new Date()
            };

            const emitted = bus.emit("order.created", testEvent);

            if (!emitted) {
                throw new Error("Expected emit() to return true when listeners are present");
            }
            if (!receivedPayload) {
                throw new Error("Handler was not executed");
            }
            if ((receivedPayload as OrderCreatedEvent).orderId !== "ORD_TEST_001") {
                throw new Error(`Expected orderId ORD_TEST_001, got: ${(receivedPayload as OrderCreatedEvent).orderId}`);
            }
        })
    );

    // Scenario 2: Register two listeners -> Both execute in registration order
    results.push(
        await runTest("Scenario 2: Register two listeners -> Both execute in registration order", () => {
            const bus = new OrderEventBus();
            const executionOrder: number[] = [];

            bus.on("order.cancelled", () => {
                executionOrder.push(1);
            });

            bus.on("order.cancelled", () => {
                executionOrder.push(2);
            });

            const testEvent: OrderCancelledEvent = {
                orderId: "ORD_TEST_002",
                userId: "USER_TEST_001",
                reason: "Customer requested cancellation",
                occurredAt: new Date()
            };

            bus.emit("order.cancelled", testEvent);

            if (executionOrder.length !== 2) {
                throw new Error(`Expected 2 listeners to execute, executed: ${executionOrder.length}`);
            }
            if (executionOrder[0] !== 1 || executionOrder[1] !== 2) {
                throw new Error(`Expected execution order [1, 2], got: [${executionOrder.join(", ")}]`);
            }
        })
    );

    // Scenario 3: Register once() listener -> Executes only once
    results.push(
        await runTest("Scenario 3: Register once() listener -> Executes only once", () => {
            const bus = new OrderEventBus();
            let executionCount = 0;

            bus.once("order.created", () => {
                executionCount++;
            });

            const testEvent: OrderCreatedEvent = {
                orderId: "ORD_TEST_003",
                userId: "USER_TEST_002",
                totalAmountInPaise: 12000,
                occurredAt: new Date()
            };

            bus.emit("order.created", testEvent);
            bus.emit("order.created", testEvent);
            bus.emit("order.created", testEvent);

            if (executionCount !== 1) {
                throw new Error(`Expected once() listener to execute exactly once, but executed ${executionCount} times`);
            }
        })
    );

    // Scenario 4: Remove listener using off() -> Removed listener doesn't execute
    results.push(
        await runTest("Scenario 4: Remove listener using off() -> Removed listener doesn't execute", () => {
            const bus = new OrderEventBus();
            let listenerAExecuted = false;
            let listenerBExecuted = false;

            const listenerA = () => {
                listenerAExecuted = true;
            };
            const listenerB = () => {
                listenerBExecuted = true;
            };

            bus.on("order.cancelled", listenerA);
            bus.on("order.cancelled", listenerB);

            // Remove listenerA
            bus.off("order.cancelled", listenerA);

            bus.emit("order.cancelled", {
                orderId: "ORD_TEST_004",
                userId: "USER_TEST_003",
                reason: "Inventory exhausted",
                occurredAt: new Date()
            });

            if (listenerAExecuted) {
                throw new Error("Listener A was removed via off(), but still executed");
            }
            if (!listenerBExecuted) {
                throw new Error("Listener B was not removed, but failed to execute");
            }
        })
    );

    // Scenario 5: Incorrect event payload -> TypeScript compilation error
    results.push(
        await runTest("Scenario 5: Incorrect event payload -> TypeScript compilation error", () => {
            const tempFilePath = path.resolve("src/events/temp-type-test-payload.ts");
            const invalidPayloadCode = `
import { orderEventBus } from './order-event-bus.js';
// Missing required fields: userId, totalAmountInPaise, occurredAt
orderEventBus.emit('order.created', { orderId: 'ORD_INVALID' } as any as { orderId: string });
`;
            fs.writeFileSync(tempFilePath, invalidPayloadCode);
            try {
                let compileFailed = false;
                let errorMessage = "";
                try {
                    execSync("npx tsc --noEmit", { encoding: "utf8", stdio: "pipe" });
                } catch (err: unknown) {
                    compileFailed = true;
                    errorMessage = ((err as { stdout?: string }).stdout || "").toString();
                }

                if (!compileFailed) {
                    throw new Error("TypeScript should have failed to compile invalid payload, but succeeded");
                }
                if (!errorMessage.includes("TS2739") && !errorMessage.includes("missing the following properties")) {
                    throw new Error(`Expected TS2739 missing properties error, but received:\n${errorMessage}`);
                }
            } finally {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
        })
    );

    // Scenario 6: Incorrect event name -> TypeScript compilation error
    results.push(
        await runTest("Scenario 6: Incorrect event name -> TypeScript compilation error", () => {
            const tempFilePath = path.resolve("src/events/temp-type-test-event-name.ts");
            const invalidEventNameCode = `
import { orderEventBus } from './order-event-bus.js';
// 'order.invalid_event' is not a valid key in OrderEventMap
orderEventBus.emit('order.invalid_event', {} as any);
`;
            fs.writeFileSync(tempFilePath, invalidEventNameCode);
            try {
                let compileFailed = false;
                let errorMessage = "";
                try {
                    execSync("npx tsc --noEmit", { encoding: "utf8", stdio: "pipe" });
                } catch (err: unknown) {
                    compileFailed = true;
                    errorMessage = ((err as { stdout?: string }).stdout || "").toString();
                }

                if (!compileFailed) {
                    throw new Error("TypeScript should have failed to compile invalid event name, but succeeded");
                }
                if (!errorMessage.includes("TS2345") && !errorMessage.includes("not assignable to parameter of type")) {
                    throw new Error(`Expected TS2345 invalid event name error, but received:\n${errorMessage}`);
                }
            } finally {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
        })
    );

    console.log("=".repeat(70));
    const passedCount = results.filter(Boolean).length;
    console.log(`Summary: ${passedCount}/${results.length} scenarios passed.`);
    console.log("=".repeat(70));

    if (passedCount !== results.length) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
});

