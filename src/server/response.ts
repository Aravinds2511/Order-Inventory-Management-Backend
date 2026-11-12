import type { ServerResponse } from "node:http";

export function sendJson(
    res: ServerResponse,
    statusCode: number,
    data: unknown
): void {
    if (res.headersSent) {
        return;
    }

    const body = JSON.stringify(data ?? null);

    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    res.end(body);
}