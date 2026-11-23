import type { Request, Response } from "express";
import { orderService } from "../services/order.service.js";

export const createOrder = async (req: Request, res: Response): Promise<void> => {
    // userId is extracted strictly from the authenticated JWT session
    const userId = req.user!.id;
    const items = req.body.items;

    const order = await orderService.createOrder({
        userId,
        items
    });

    res.status(201).json({
        success: true,
        data: order
    });
};
