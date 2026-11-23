import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { appConfig } from "../config/env.js";
import { HttpError } from "../errors/http-error.js";
import { UserRole } from "../generated/prisma/client.js";
import type { TokenPayload } from "../services/auth.service.js";

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new HttpError(
            "Missing or malformed Authorization header. Expected format: Bearer <token>",
            "UNAUTHORIZED",
            401
        );
    }

    const token = authHeader.substring(7).trim();

    try {
        const decoded = jwt.verify(token, appConfig.jwtSecret) as TokenPayload;

        req.user = {
            id: decoded.sub,
            email: decoded.email,
            role: decoded.role
        };

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new HttpError("Access token has expired", "TOKEN_EXPIRED", 401);
        }

        throw new HttpError("Invalid access token", "INVALID_TOKEN", 401);
    }
}

export function requireRole(allowedRoles: UserRole[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            throw new HttpError("Authentication required", "UNAUTHORIZED", 401);
        }

        if (!allowedRoles.includes(req.user.role)) {
            throw new HttpError(
                `Access forbidden: requires one of [${allowedRoles.join(", ")}] roles`,
                "FORBIDDEN",
                403
            );
        }

        next();
    };
}
