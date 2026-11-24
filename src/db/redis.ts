import { Redis } from "ioredis";
import { appConfig } from "../config/env.js";

interface InMemoryLockEntry {
    value: string;
    expiresAt: number;
}

/**
 * Resilient Redis Client & Lock Store.
 * Connects to Redis via ioredis if reachable.
 * Automatically falls back to an in-memory store if Redis is unavailable,
 * guaranteeing zero downtime and seamless local testing.
 */
export class ResilientLockStore {
    private redisClient: Redis | null = null;
    private isRedisConnected = false;
    private readonly memoryStore = new Map<string, InMemoryLockEntry>();

    constructor(private readonly redisUrl: string = appConfig.redisUrl) {
        this.initializeRedis();
    }

    private initializeRedis(): void {
        try {
            const client = new Redis(this.redisUrl, {
                lazyConnect: true,
                maxRetriesPerRequest: 1,
                enableOfflineQueue: false,
                retryStrategy: (times) => {
                    // Back off retry intervals up to 2 seconds; stop after 3 attempts
                    if (times > 3) return null;
                    return Math.min(times * 200, 2000);
                }
            });

            client.on("connect", () => {
                this.isRedisConnected = true;
            });

            client.on("error", () => {
                this.isRedisConnected = false;
            });

            client.on("close", () => {
                this.isRedisConnected = false;
            });

            this.redisClient = client;

            // Attempt initial background connection without unhandled rejections
            client.connect().catch(() => {
                this.isRedisConnected = false;
            });
        } catch {
            this.redisClient = null;
            this.isRedisConnected = false;
        }
    }

    /**
     * Atomically sets a key if it does not already exist (mutex lock), with TTL.
     * Returns true if the lock was acquired, false otherwise.
     */
    async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
        if (this.isRedisConnected && this.redisClient) {
            try {
                // SET key value EX ttl NX
                const result = await this.redisClient.set(key, value, "EX", ttlSeconds, "NX");
                return result === "OK";
            } catch {
                // If Redis fails mid-operation, fall through to in-memory store
            }
        }

        // In-memory fallback
        const now = Date.now();
        const existing = this.memoryStore.get(key);

        if (existing && existing.expiresAt > now) {
            return false; // Already locked
        }

        this.memoryStore.set(key, {
            value,
            expiresAt: now + ttlSeconds * 1000
        });

        return true;
    }

    /**
     * Deletes a key (releases mutex lock).
     */
    async del(key: string): Promise<boolean> {
        this.memoryStore.delete(key);

        if (this.isRedisConnected && this.redisClient) {
            try {
                const deletedCount = await this.redisClient.del(key);
                return deletedCount > 0;
            } catch {
                return true;
            }
        }

        return true;
    }

    /**
     * Retrieves key value if present and unexpired.
     */
    async get(key: string): Promise<string | null> {
        if (this.isRedisConnected && this.redisClient) {
            try {
                return await this.redisClient.get(key);
            } catch {
                // Fall through
            }
        }

        const now = Date.now();
        const entry = this.memoryStore.get(key);
        if (!entry) return null;

        if (entry.expiresAt <= now) {
            this.memoryStore.delete(key);
            return null;
        }

        return entry.value;
    }

    isUsingRedis(): boolean {
        return this.isRedisConnected;
    }

    async quit(): Promise<void> {
        if (this.redisClient) {
            try {
                await this.redisClient.quit();
            } catch {
                // Ignore disconnect errors
            }
        }
        this.memoryStore.clear();
    }
}

export const lockStore = new ResilientLockStore();
