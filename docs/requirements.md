# Requirements Document

## 1. Overview
The Order & Inventory API provides an e-commerce backend service for managing products, tracking inventory levels, and handling customer orders securely and reliably.

---

## 2. User Roles

| Role | Responsibilities & Capabilities |
| :--- | :--- |
| **Customer** | Browse products, purchase products, and view their orders. |
| **Admin** | Create products, update prices, and manage inventory. |

---

## 3. Core Entities

| Entity | Responsibility |
| :--- | :--- |
| **User** | Customer and admin information |
| **Product** | Product details and pricing |
| **Inventory** | Stock availability |
| **Order** | Customer purchase information |
| **OrderItem** | Products and quantities in an order |
| **Payment** | Payment status and reference |
| **IdempotencyRecord** | Prevent duplicate requests |

---

## 4. Important Business Rules

1. Customers cannot purchase more inventory than is available.
2. Two simultaneous purchases must never result in negative inventory.
3. Customers can only access their own orders.
4. Retried requests must not create duplicate orders.
5. The server must calculate product prices and order totals.
6. An order must have a consistent status throughout its lifecycle.
7. A failed order operation must not leave partially updated inventory.

> **Note:** These rules will eventually require proper database transactions, concurrency control, and idempotency.
