import type { RequestHandler } from "express";

import { HttpError } from "../errors/http-error.js";

export const notFoundHandler: RequestHandler = (
    req,
    _res,
    next
) => {
    next(
        new HttpError(
            `Route ${req.originalUrl} not found`,
            "ROUTE_NOT_FOUND",
            404
        )
    );
};