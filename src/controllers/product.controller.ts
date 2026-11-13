import type { RequestHandler } from "express";

import { productService } from "../services/product.service.js";

export const getProducts: RequestHandler = (_req, res) => {
    const products = productService.getAllProducts();

    res.status(200).json({
        success: true,
        data: products
    });
};

export const getProductById: RequestHandler = (req, res) => {
    const product = productService.getProductById(
        req.params.id
    );

    res.status(200).json({
        success: true,
        data: product
    });
};