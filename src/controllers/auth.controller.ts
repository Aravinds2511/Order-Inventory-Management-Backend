import type { Request, Response } from "express";

import { authService } from "../services/auth.service.js";

export async function register(req: Request, res: Response): Promise<void> {
    // If x-admin-secret header is present, prioritize it
    const adminSecret = (req.headers["x-admin-secret"] as string | undefined) ?? req.body.adminSecret;
    const input = {
        ...req.body,
        adminSecret
    };

    const result = await authService.register(input);

    res.status(201).json({
        success: true,
        data: result
    });
}

export async function login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body);

    res.status(200).json({
        success: true,
        data: result
    });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
    const tokens = await authService.refresh(req.body.refreshToken);

    res.status(200).json({
        success: true,
        data: tokens
    });
}

export async function logout(req: Request, res: Response): Promise<void> {
    await authService.logout(req.body.refreshToken);

    res.status(200).json({
        success: true,
        message: "Logged out successfully"
    });
}

export async function getMe(req: Request, res: Response): Promise<void> {
    const user = await authService.getMe(req.user!.id);

    res.status(200).json({
        success: true,
        data: user
    });
}
