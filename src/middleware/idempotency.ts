import type { Request, Response, NextFunction } from "express";

import { idempotencyService } from "../services/idempotency.service.js";
import { generateRequestHash } from "../utils/hash.js";
import { idempotencyHeaderSchema } from "../validation/idempotency.schema.js";
import { HttpError } from "../errors/http-error.js";

/**
 * Hybrid Idempotency Middleware.
 * Guards POST endpoints against duplicate executions, concurrent races,
 * and payload tampering using Redis in-flight locks and PostgreSQL durability.
 */
export async function idempotencyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const rawKey = req.headers["idempotency-key"];

    if (!rawKey || typeof rawKey !== "string" || rawKey.trim() === "") {
        return next(
            new HttpError(
                "Idempotency-Key header is required for this operation",
                "MISSING_IDEMPOTENCY_KEY",
                400
            )
        );
    }

    const parseResult = idempotencyHeaderSchema.safeParse({
        "idempotency-key": rawKey
    });

    if (!parseResult.success) {
        return next(
            new HttpError(
                parseResult.error.issues[0]?.message ?? "Invalid Idempotency-Key format",
                "INVALID_IDEMPOTENCY_KEY",
                400
            )
        );
    }

    const key = parseResult.data["idempotency-key"];

    if (!req.user) {
        return next(
            new HttpError(
                "Authentication is required before idempotency processing",
                "UNAUTHORIZED",
                401
            )
        );
    }

    const userId = req.user.id;
    const endpoint = req.originalUrl || req.path;
    const requestHash = generateRequestHash(endpoint, req.body);

    let lockAcquired = false;

    try {
        // 1. Check for existing completed record
        const cached = await idempotencyService.getExistingRecord(
            key,
            userId,
            requestHash
        );

        if (cached) {
            res.setHeader("X-Idempotent-Replay", "true");
            res.status(cached.statusCode).json(cached.responseBody);
            return;
        }

        // 2. Acquire distributed in-flight lock
        await idempotencyService.acquireLock(userId, key);
        lockAcquired = true;

        // 3. Response interception to capture final output
        const originalJson = res.json.bind(res);
        const originalSend = res.send.bind(res);

        let capturedBody: unknown = null;

        res.json = (body: unknown): Response => {
            capturedBody = body;
            return originalJson(body);
        };

        res.send = (body: unknown): Response => {
            if (capturedBody === null) {
                try {
                    capturedBody = typeof body === "string" ? JSON.parse(body) : body;
                } catch {
                    capturedBody = body;
                }
            }
            return originalSend(body);
        };

        // 4. Cleanup lock and save record on finish
        res.on("finish", async () => {
            if (!lockAcquired) return;

            try {
                // If operation was successful (2xx status), persist response
                if (res.statusCode >= 200 && res.statusCode < 300 && capturedBody !== null) {
                    await idempotencyService.saveRecord({
                        key,
                        userId,
                        endpoint,
                        requestHash,
                        statusCode: res.statusCode,
                        responseBody: capturedBody
                    });
                }
            } catch (err) {
                console.error("Failed to persist idempotency record:", err);
            } finally {
                await idempotencyService.releaseLock(userId, key);
                lockAcquired = false;
            }
        });

        res.on("close", async () => {
            if (lockAcquired) {
                await idempotencyService.releaseLock(userId, key);
                lockAcquired = false;
            }
        });

        next();
    } catch (error) {
        if (lockAcquired) {
            await idempotencyService.releaseLock(userId, key);
        }
        next(error);
    }
}
