import { ProductRepository } from "../repositories/product.repository.js";
import { HttpError } from "../errors/http-error.js";

export class ProductService {
    constructor(
        private readonly repository = new ProductRepository()
    ) { }

    getAllProducts() {
        return this.repository.findAll();
    }

    getProductById(id: string) {
        const product = this.repository.findById(id);

        if (!product) {
            throw new HttpError(
                "Product not found",
                "PRODUCT_NOT_FOUND",
                404
            );
        }

        return product;
    }
}

export const productService = new ProductService();