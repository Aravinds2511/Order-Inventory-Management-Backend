import type { ErrorRequestHandler } from "express";

import { HttpError } from "../errors/http-error.js";

export const errorHandler: ErrorRequestHandler = (
    err,
    _req,
    res,
    next
) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof HttpError) {
        return res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message
            }
        });
    }

    // Handle common JSON body-parser errors.
    const error = err as { type?: string };

    if (error.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            error: {
                code: "INVALID_JSON",
                message: "Invalid JSON request body"
            }
        });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            error: {
                code: "PAYLOAD_TOO_LARGE",
                message: "Request body is too large"
            }
        });
    }

    console.error(err);

    return res.status(500).json({
        success: false,
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Something went wrong"
        }
    });
};