import assert from "node:assert/strict";

import { loadConfig } from "../src/config/env.js";

assert.deepEqual(loadConfig({}), {
    port: 3000,
    nodeEnv: "development",
    logLevel: "info",
    jwtSecret: "dev-super-secret-jwt-key-32-chars-long-minimum!",
    jwtExpiresIn: "15m",
    refreshTokenExpiresDays: 7,
    adminRegistrationSecret: "dev-admin-secret-change-in-prod",
    redisUrl: "redis://localhost:6379",
    idempotencyLockTtlSeconds: 30
});

assert.equal(
    loadConfig({ PORT: "4000" }).port,
    4000
);

assert.equal(
    loadConfig({ REDIS_URL: "redis://custom-host:6380" }).redisUrl,
    "redis://custom-host:6380"
);

assert.throws(
    () => loadConfig({ PORT: "invalid" })
);

assert.throws(
    () => loadConfig({ NODE_ENV: "staging" })
);

assert.throws(
    () => loadConfig({ LOG_LEVEL: "verbose" })
);

assert.throws(
    () => loadConfig({ REFRESH_TOKEN_EXPIRES_DAYS: "-1" })
);

assert.throws(
    () => loadConfig({ IDEMPOTENCY_LOCK_TTL_SECONDS: "0" })
);

assert.throws(
    () => loadConfig({ NODE_ENV: "production", JWT_SECRET: "too-short" })
);

console.log("Configuration tests passed.");
