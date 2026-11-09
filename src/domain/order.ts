export type UserRole = "customer" | "admin";

export type OrderStatus =
    | "pending"
    | "confirmed"
    | "paid"
    | "cancelled"
    | "failed";

export interface User {
    id: string;
    email: string;
    role: UserRole;
}

export interface Product {
    id: string;
    name: string;
    priceInPaise: number;
    isActive: boolean;
}

export interface OrderItem {
    productId: string;
    quantity: number;
    unitPriceInPaise: number;
}

export interface Order {
    id: string;
    userId: string;
    items: OrderItem[];
    status: OrderStatus;
    totalAmountInPaise: number;
    createdAt: Date;
}