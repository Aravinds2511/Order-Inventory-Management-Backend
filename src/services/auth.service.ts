import crypto from "node:crypto";
import argon2 from "argon2";
import jwt, { type SignOptions } from "jsonwebtoken";

import { prisma } from "../db/prisma.js";
import { appConfig, type AppConfig } from "../config/env.js";
import { HttpError } from "../errors/http-error.js";
import { UserRole } from "../generated/prisma/client.js";
import type { RegisterInput, LoginInput } from "../validation/auth.schema.js";

export interface TokenPayload {
    sub: string;
    email: string;
    role: UserRole;
}

export interface SanitizedUser {
    id: string;
    email: string;
    role: UserRole;
    createdAt: Date;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface AuthResult {
    user: SanitizedUser;
    tokens: AuthTokens;
}

export class AuthService {
    constructor(
        private readonly db = prisma,
        private readonly config: AppConfig = appConfig
    ) { }

    private hashToken(token: string): string {
        return crypto.createHash("sha256").update(token).digest("hex");
    }

    private generateAccessToken(user: { id: string; email: string; role: UserRole }): string {
        const payload: TokenPayload = {
            sub: user.id,
            email: user.email,
            role: user.role
        };

        const options: SignOptions = {
            expiresIn: this.config.jwtExpiresIn as any
        };

        return jwt.sign(payload, this.config.jwtSecret, options);
    }

    private generateRefreshToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
        const rawToken = crypto.randomBytes(40).toString("hex");
        const tokenHash = this.hashToken(rawToken);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.config.refreshTokenExpiresDays);

        return { rawToken, tokenHash, expiresAt };
    }

    async register(input: RegisterInput): Promise<AuthResult> {
        // 1. Check if email is already taken
        const existingUser = await this.db.user.findUnique({
            where: { email: input.email }
        });

        if (existingUser) {
            throw new HttpError("Email is already registered", "EMAIL_ALREADY_EXISTS", 409);
        }

        // 2. Validate role assignment
        const requestedRole = input.role ?? UserRole.CUSTOMER;
        if (requestedRole === UserRole.ADMIN) {
            if (!input.adminSecret || input.adminSecret !== this.config.adminRegistrationSecret) {
                throw new HttpError("Invalid admin registration secret", "INVALID_ADMIN_SECRET", 403);
            }
        }

        // 3. Hash password using Argon2
        const passwordHash = await argon2.hash(input.password);

        // 4. Create user and issue initial tokens
        const user = await this.db.user.create({
            data: {
                email: input.email,
                passwordHash,
                role: requestedRole
            }
        });

        const accessToken = this.generateAccessToken(user);
        const { rawToken, tokenHash, expiresAt } = this.generateRefreshToken();

        await this.db.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt
            }
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt
            },
            tokens: {
                accessToken,
                refreshToken: rawToken
            }
        };
    }

    async login(input: LoginInput): Promise<AuthResult> {
        // 1. Look up user by email
        const user = await this.db.user.findUnique({
            where: { email: input.email }
        });

        if (!user) {
            throw new HttpError("Invalid email or password", "INVALID_CREDENTIALS", 401);
        }

        // 2. Verify password with Argon2
        const isPasswordValid = await argon2.verify(user.passwordHash, input.password);
        if (!isPasswordValid) {
            throw new HttpError("Invalid email or password", "INVALID_CREDENTIALS", 401);
        }

        // 3. Issue new access token and refresh token
        const accessToken = this.generateAccessToken(user);
        const { rawToken, tokenHash, expiresAt } = this.generateRefreshToken();

        await this.db.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt
            }
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt
            },
            tokens: {
                accessToken,
                refreshToken: rawToken
            }
        };
    }

    async refresh(rawRefreshToken: string): Promise<AuthTokens> {
        const tokenHash = this.hashToken(rawRefreshToken);

        const tokenRecord = await this.db.refreshToken.findFirst({
            where: { tokenHash },
            include: { user: true }
        });

        if (!tokenRecord) {
            throw new HttpError("Invalid refresh token", "INVALID_REFRESH_TOKEN", 401);
        }

        // Automatic Reuse Detection:
        // If an already-revoked token is submitted, assume compromise and invalidate all refresh tokens for this user
        if (tokenRecord.revokedAt !== null) {
            await this.db.refreshToken.updateMany({
                where: {
                    userId: tokenRecord.userId,
                    revokedAt: null
                },
                data: {
                    revokedAt: new Date()
                }
            });

            throw new HttpError(
                "Refresh token reuse detected. All active sessions have been revoked. Please log in again.",
                "TOKEN_REUSE_DETECTED",
                401
            );
        }

        // Check token expiration
        if (tokenRecord.expiresAt < new Date()) {
            throw new HttpError("Refresh token has expired", "REFRESH_TOKEN_EXPIRED", 401);
        }

        // Rotate token: generate new token pair and atomically update in a transaction
        const newAccessToken = this.generateAccessToken(tokenRecord.user);
        const { rawToken: newRawToken, tokenHash: newTokenHash, expiresAt: newExpiresAt } = this.generateRefreshToken();

        await this.db.$transaction([
            this.db.refreshToken.update({
                where: { id: tokenRecord.id },
                data: {
                    revokedAt: new Date(),
                    replacedByToken: newTokenHash
                }
            }),
            this.db.refreshToken.create({
                data: {
                    userId: tokenRecord.userId,
                    tokenHash: newTokenHash,
                    expiresAt: newExpiresAt
                }
            })
        ]);

        return {
            accessToken: newAccessToken,
            refreshToken: newRawToken
        };
    }

    async logout(rawRefreshToken: string): Promise<void> {
        const tokenHash = this.hashToken(rawRefreshToken);

        await this.db.refreshToken.updateMany({
            where: {
                tokenHash,
                revokedAt: null
            },
            data: {
                revokedAt: new Date()
            }
        });
    }

    async getMe(userId: string): Promise<SanitizedUser> {
        const user = await this.db.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true
            }
        });

        if (!user) {
            throw new HttpError("User not found", "USER_NOT_FOUND", 404);
        }

        return user;
    }
}

export const authService = new AuthService();
