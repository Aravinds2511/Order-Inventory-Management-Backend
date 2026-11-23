import "dotenv/config";
import { ConfigurationError } from "../errors/app-error.js";

export type NodeEnvironment =
    | "development"
    | "test"
    | "production";

export type LogLevel =
    | "debug"
    | "info"
    | "warn"
    | "error";

export interface AppConfig {
    port: number;
    nodeEnv: NodeEnvironment;
    logLevel: LogLevel;
    jwtSecret: string;
    jwtExpiresIn: string;
    refreshTokenExpiresDays: number;
    adminRegistrationSecret: string;
}

const VALID_NODE_ENVS: readonly NodeEnvironment[] = ["development", "test", "production"];
const VALID_LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

export function loadConfig(
    env: Record<string, string | undefined> = process.env
): AppConfig {
    // 1. Port validation (default: 3000, integer between 1 and 65535)
    const rawPort = env.PORT ?? "3000";
    const port = Number(rawPort);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ConfigurationError(
            `Invalid PORT: "${rawPort}". PORT must be an integer between 1 and 65535.`
        );
    }

    // 2. NODE_ENV validation (default: development)
    const rawNodeEnv = env.NODE_ENV ?? "development";
    if (!VALID_NODE_ENVS.includes(rawNodeEnv as NodeEnvironment)) {
        throw new ConfigurationError(
            `Invalid NODE_ENV: "${rawNodeEnv}". NODE_ENV must be one of: ${VALID_NODE_ENVS.join(", ")}.`
        );
    }
    const nodeEnv = rawNodeEnv as NodeEnvironment;

    // 3. LOG_LEVEL validation (default: info)
    const rawLogLevel = env.LOG_LEVEL ?? "info";
    if (!VALID_LOG_LEVELS.includes(rawLogLevel as LogLevel)) {
        throw new ConfigurationError(
            `Invalid LOG_LEVEL: "${rawLogLevel}". LOG_LEVEL must be one of: ${VALID_LOG_LEVELS.join(", ")}.`
        );
    }
    const logLevel = rawLogLevel as LogLevel;

    // 4. JWT_SECRET validation
    const jwtSecret = env.JWT_SECRET ?? "dev-super-secret-jwt-key-32-chars-long-minimum!";
    if (nodeEnv === "production" && jwtSecret.length < 32) {
        throw new ConfigurationError("JWT_SECRET must be at least 32 characters long in production.");
    }

    // 5. JWT_EXPIRES_IN (default: 15m)
    const jwtExpiresIn = env.JWT_EXPIRES_IN ?? "15m";

    // 6. REFRESH_TOKEN_EXPIRES_DAYS (default: 7)
    const rawRefreshDays = env.REFRESH_TOKEN_EXPIRES_DAYS ?? "7";
    const refreshTokenExpiresDays = Number(rawRefreshDays);
    if (!Number.isInteger(refreshTokenExpiresDays) || refreshTokenExpiresDays < 1) {
        throw new ConfigurationError("REFRESH_TOKEN_EXPIRES_DAYS must be a positive integer.");
    }

    // 7. ADMIN_REGISTRATION_SECRET
    const adminRegistrationSecret = env.ADMIN_REGISTRATION_SECRET ?? "dev-admin-secret-change-in-prod";

    return {
        port,
        nodeEnv,
        logLevel,
        jwtSecret,
        jwtExpiresIn,
        refreshTokenExpiresDays,
        adminRegistrationSecret
    };
}

export const appConfig = loadConfig();
