import type { Request, Response } from "express";

import { productService } from "../services/product.service.js";

export const getProducts = async (_req: Request, res: Response): Promise<void> => {
    const products = await productService.getAllProducts();

    res.status(200).json({
        success: true,
        data: products
    });
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
    const product = await productService.getProductById(req.params.id as string);

    res.status(200).json({
        success: true,
        data: product
    });
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
    const product = await productService.createProduct(req.body);

    res.status(201).json({
        success: true,
        data: product
    });
};
