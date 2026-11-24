import { prisma } from "../db/prisma.js";
import { lockStore, ResilientLockStore } from "../db/redis.js";
import { appConfig, type AppConfig } from "../config/env.js";
import { HttpError } from "../errors/http-error.js";
import type { Prisma } from "../generated/prisma/client.js";

export interface CachedResponse {
    statusCode: number;
    responseBody: unknown;
}

export interface SaveRecordParams {
    key: string;
    userId: string;
    endpoint: string;
    requestHash: string;
    statusCode: number;
    responseBody: unknown;
}

export class IdempotencyService {
    constructor(
        private readonly db = prisma,
        private readonly store: ResilientLockStore = lockStore,
        private readonly config: AppConfig = appConfig
    ) { }

    private formatLockKey(userId: string, key: string): string {
        return `idempotency:lock:${userId}:${key}`;
    }

    /**
     * Attempts to acquire an in-flight distributed mutex lock.
     * Throws 409 Conflict if another identical request is currently processing.
     */
    async acquireLock(userId: string, key: string): Promise<void> {
        const lockKey = this.formatLockKey(userId, key);
        const acquired = await this.store.setNX(
            lockKey,
            "LOCKED",
            this.config.idempotencyLockTtlSeconds
        );

        if (!acquired) {
            throw new HttpError(
                "A request with this Idempotency-Key is currently being processed",
                "IDEMPOTENCY_KEY_IN_FLIGHT",
                409
            );
        }
    }

    /**
     * Releases the in-flight distributed mutex lock.
     */
    async releaseLock(userId: string, key: string): Promise<void> {
        const lockKey = this.formatLockKey(userId, key);
        await this.store.del(lockKey);
    }

    /**
     * Checks if a persistent idempotency record already exists in PostgreSQL.
     * Validates user ownership and payload integrity (hash matching).
     */
    async getExistingRecord(
        key: string,
        userId: string,
        requestHash: string
    ): Promise<CachedResponse | null> {
        const record = await this.db.idempotencyRecord.findUnique({
            where: { key }
        });

        if (!record) {
            return null;
        }

        // 1. Enforce user ownership isolation
        if (record.userId !== userId) {
            throw new HttpError(
                "Idempotency key does not belong to the authenticated user",
                "IDEMPOTENCY_KEY_OWNERSHIP_MISMATCH",
                403
            );
        }

        // 2. Enforce payload tampering / modification guard
        if (record.requestHash !== requestHash) {
            throw new HttpError(
                "Idempotency-Key was already used with a different request payload",
                "IDEMPOTENCY_PAYLOAD_MISMATCH",
                422
            );
        }

        return {
            statusCode: record.statusCode,
            responseBody: record.responseBody
        };
    }

    /**
     * Persists the final HTTP status and response payload into PostgreSQL.
     */
    async saveRecord(params: SaveRecordParams): Promise<void> {
        await this.db.idempotencyRecord.upsert({
            where: { key: params.key },
            create: {
                key: params.key,
                userId: params.userId,
                endpoint: params.endpoint,
                requestHash: params.requestHash,
                statusCode: params.statusCode,
                responseBody: params.responseBody as Prisma.InputJsonValue
            },
            update: {
                statusCode: params.statusCode,
                responseBody: params.responseBody as Prisma.InputJsonValue
            }
        });
    }
}

export const idempotencyService = new IdempotencyService();
