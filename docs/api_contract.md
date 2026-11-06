# API Contract

## Endpoints Summary

| Method | Endpoint | Responsibility |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | User registration |
| `POST` | `/auth/login` | User login |
| `GET` | `/products` | List products |
| `GET` | `/products/:id` | Get product details |
| `POST` | `/products` | Create product |
| `POST` | `/orders` | Place an order |
| `GET` | `/orders/:id` | Get order details |
| `POST` | `/orders/:id/cancel` | Cancel order |

---

## Endpoint Details

### 1. Authentication

#### `POST /auth/register`
**Responsibility:** User registration

- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "role": "Customer"
  }
  ```
- **Responses:**
  - `201 Created`: Returns registered user details (excluding password).
  - `400 Bad Request`: Invalid input or validation error.
  - `409 Conflict`: User with email already exists.

#### `POST /auth/login`
**Responsibility:** User login

- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Responses:**
  - `200 OK`: Returns JWT token and basic user details.
  - `401 Unauthorized`: Invalid credentials.

---

### 2. Products

#### `GET /products`
**Responsibility:** List products

- **Responses:**
  - `200 OK`: Returns an array of available products with pricing and stock details.

#### `GET /products/:id`
**Responsibility:** Get product details

- **Responses:**
  - `200 OK`: Returns details for the specified product.
  - `404 Not Found`: Product not found.

#### `POST /products`
**Responsibility:** Create product (Admin)

- **Request Body:**
  ```json
  {
    "title": "Wireless Keyboard",
    "description": "Ergonomic Bluetooth keyboard",
    "price": 49.99,
    "stock": 50
  }
  ```
- **Responses:**
  - `201 Created`: Product created successfully.
  - `400 Bad Request`: Invalid product payload.
  - `403 Forbidden`: Requires admin role.

---

### 3. Orders

#### `POST /orders`
**Responsibility:** Place an order

- **Headers:**
  - `Idempotency-Key` *(string, required)*: Unique client-generated key (e.g. UUID) to prevent duplicate orders.
- **Request Body:**
  ```json
  {
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 2
      }
    ]
  }
  ```
- **Responses:**
  - `201 Created`: Order placed and stock reserved.
  - `400 Bad Request`: Insufficient stock or invalid payload.
  - `409 Conflict`: Duplicate request for the given `Idempotency-Key`.

#### `GET /orders/:id`
**Responsibility:** Get order details

- **Responses:**
  - `200 OK`: Returns order details, items, pricing, and status.
  - `404 Not Found`: Order not found.

#### `POST /orders/:id/cancel`
**Responsibility:** Cancel order

- **Responses:**
  - `200 OK`: Order cancelled successfully and reserved inventory returned to stock.
  - `400 Bad Request`: Order is not eligible for cancellation.
  - `404 Not Found`: Order not found.
