import crypto from "node:crypto";

/**
 * Deterministically stringifies an object by recursively sorting its keys.
 * Ensures consistent serialization regardless of property declaration order.
 */
export function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value) ?? "";
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }

    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const pairs = sortedKeys.map(
        (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`
    );

    return `{${pairs.join(",")}}`;
}

/**
 * Generates a SHA-256 hash from the endpoint and normalized request body.
 */
export function generateRequestHash(endpoint: string, body: unknown): string {
    const serialized = stableStringify(body ?? {});
    return crypto
        .createHash("sha256")
        .update(`${endpoint}:${serialized}`)
        .digest("hex");
}
