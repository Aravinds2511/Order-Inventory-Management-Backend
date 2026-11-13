import type { Product } from "../domain/order.js";

const products: Product[] = [
    {
        id: "P001",
        name: "Laptop",
        priceInPaise: 500000,
        isActive: true
    },
    {
        id: "P002",
        name: "Keyboard",
        priceInPaise: 25000,
        isActive: true
    }
];

export class ProductRepository {
    findAll(): Product[] {
        return products;
    }

    findById(id: string): Product | undefined {
        return products.find(product => product.id === id);
    }
}