import type { RequestHandler } from "express";

import { productService } from "../services/product.service.js";

export const getProducts: RequestHandler = async (_req, res) => {
    const products = await productService.getAllProducts();

    res.status(200).json({
        success: true,
        data: products
    });
};

export const getProductById: RequestHandler<{ id: string }> = async (req, res) => {
    const product = await productService.getProductById(
        req.params.id
    );

    res.status(200).json({
        success: true,
        data: product
    });
};
