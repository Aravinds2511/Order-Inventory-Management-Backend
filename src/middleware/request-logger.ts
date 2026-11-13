import type { RequestHandler } from "express";

export function createRequestLogger(
    log: (message: string) => void = console.log
): RequestHandler {
    return (req, res, next) => {
        const start = process.hrtime.bigint();

        res.once("finish", () => {
            const end = process.hrtime.bigint();

            const duration =
                Number(end - start) / 1_000_000;

            log(
                `${req.method} ${req.originalUrl} ` +
                `${res.statusCode} ${duration.toFixed(2)}ms`
            );
        });

        next();
    };
}