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

    return {
        port,
        nodeEnv,
        logLevel,
    };
}
