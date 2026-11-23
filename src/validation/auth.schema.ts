import { z } from "zod";

export const registerSchema = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .email("Invalid email format")
        .max(255, "Email cannot exceed 255 characters"),
    password: z
        .string({ required_error: "Password is required" })
        .min(8, "Password must be at least 8 characters long")
        .max(128, "Password cannot exceed 128 characters"),
    role: z
        .enum(["CUSTOMER", "ADMIN"], {
            errorMap: () => ({ message: "Role must be either CUSTOMER or ADMIN" })
        })
        .optional()
        .default("CUSTOMER"),
    adminSecret: z.string().optional()
});

export const loginSchema = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .email("Invalid email format"),
    password: z
        .string({ required_error: "Password is required" })
        .min(1, "Password is required")
});

export const refreshTokenSchema = z.object({
    refreshToken: z
        .string({ required_error: "Refresh token is required" })
        .min(1, "Refresh token cannot be empty")
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
