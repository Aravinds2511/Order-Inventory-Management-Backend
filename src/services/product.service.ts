import { ProductRepository } from "../repositories/product.repository.js";
import { HttpError } from "../errors/http-error.js";
import type { CreateProductInput } from "../validation/product.schema.js";

export class ProductService {
    constructor(
        private readonly repository = new ProductRepository()
    ) { }

    async getAllProducts() {
        return this.repository.findAll();
    }

    async getProductById(id: string) {
        const product = await this.repository.findById(id);

        if (!product) {
            throw new HttpError(
                "Product not found",
                "PRODUCT_NOT_FOUND",
                404
            );
        }

        return product;
    }

    async createProduct(input: CreateProductInput) {
        const existing = await this.repository.findBySku(input.sku);

        if (existing) {
            throw new HttpError(
                `Product with SKU '${input.sku}' already exists`,
                "SKU_ALREADY_EXISTS",
                409
            );
        }

        return this.repository.create(input);
    }
}

export const productService = new ProductService();
