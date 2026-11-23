import type { Request, Response, NextFunction } from "express";
import { type ZodSchema, ZodError } from "zod";

export interface ValidationTargets {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}

export function validate(schemas: ValidationTargets) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }

            if (schemas.query) {
                req.query = await schemas.query.parseAsync(req.query) as any;
            }

            if (schemas.params) {
                req.params = await schemas.params.parseAsync(req.params) as any;
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const details = error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message
                }));

                res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: details[0]?.message ?? "Validation failed",
                        details
                    }
                });
                return;
            }

            next(error);
        }
    };
}
