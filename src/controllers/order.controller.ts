import type { RequestHandler } from "express";
import { orderService } from "../services/order.service.js";

// Temporary test user ID from seeded database until authentication context is introduced
const TEMPORARY_TEST_USER_ID = "test-user-001";

export const createOrder: RequestHandler = async (req, res) => {
    // Note: Once authentication is added, userId will come strictly from req.user
    const userId = (req.body?.userId as string) || TEMPORARY_TEST_USER_ID;
    const items = req.body?.items;

    const order = await orderService.createOrder({
        userId,
        items
    });

    res.status(201).json({
        success: true,
        data: order
    });
};
