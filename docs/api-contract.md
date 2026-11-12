# API Contract & Specification

## 1. Overview & Protocol Conventions

The **Order & Inventory API** is a JSON-first, RESTful service. All communication occurs over HTTP/HTTPS with JSON request and response payloads.

---

## 2. API Versioning Strategy

- **URI Path Versioning:** All business domain routes are versioned using a URI path prefix: `/api/v1/`.
- **Infrastructure / Operational Routes:** Diagnostic endpoints (e.g., `/health`) remain unversioned at the root to simplify configuration across load balancers, container orchestrators (Kubernetes), and uptime monitors.
- **Breaking Change Policy:** Breaking schema changes (removing fields, altering types, changing semantics) increment the major version path (e.g., `/api/v2/`). Additive changes (new optional fields, new endpoints) occur within the current version.

---

## 3. Standard JSON Response Envelopes

All responses return the header `Content-Type: application/json`. Payloads strictly follow predictable envelopes.

### Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... } // Optional: included for paginated collections
}
```

### Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable explanation of the error",
    "details": [] // Optional: field-level validation errors or metadata
  }
}
```

---

## 4. HTTP Status Code Conventions

The API uses standard HTTP response codes to communicate outcome:

| Status Code | Meaning | Usage in API |
| :--- | :--- | :--- |
| `200 OK` | Success | Successful `GET` requests, status checks, and synchronous updates. |
| `201 Created` | Created | Successful resource creation (`POST /api/v1/orders`, `POST /api/v1/products`). |
| `400 Bad Request` | Client Error | Malformed JSON, schema validation failure, or business rule violation. |
| `401 Unauthorized` | Auth Required | Missing, expired, or malformed authentication token. |
| `403 Forbidden` | Access Denied | Authenticated user lacks authorization for the resource (e.g., Customer accessing Admin route). |
| `404 Not Found` | Not Found | Target endpoint does not exist, or specific entity ID not found. |
| `405 Method Not Allowed` | Method Invalid | Known endpoint accessed with an unsupported HTTP method. Accompanied by `Allow` header. |
| `409 Conflict` | State Conflict | Request cannot be processed due to conflict (e.g., in-flight idempotency lock, email already registered). |
| `422 Unprocessable Entity`| Semantic Error | Idempotency key payload mismatch or semantically invalid transaction state. |
| `500 Internal Server Error`| Server Error | Unexpected internal server failure. Internal stack traces are never exposed to the client. |

---

## 5. Endpoints Summary

### System & Routing Endpoints

| Method | Endpoint | Success Status | Error Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | `200 OK` | `500` | Service health check |
| `GET` | `/api/v1/products` | `200 OK` | `500` | List products |
| `GET` | `/api/v1/products/:id` | `200 OK` | `404`, `500` | Get product details by ID |
| *Any* | *Unknown route* | — | `404` | Route does not exist |
| *Any* | *Known route with unsupported method* | — | `405` | Unsupported HTTP method on existing route |

### Domain Endpoints (Upcoming Core Features)

| Method | Endpoint | Success Status | Error Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | `201 Created` | `400`, `409` | Customer/Admin registration |
| `POST` | `/api/v1/auth/login` | `200 OK` | `400`, `401` | JWT authentication |
| `POST` | `/api/v1/products` | `201 Created` | `400`, `403` | Create catalog product (Admin) |
| `POST` | `/api/v1/orders` | `201 Created` | `400`, `409`, `422` | Create order (requires `Idempotency-Key`) |
| `GET` | `/api/v1/orders/:id` | `200 OK` | `401`, `403`, `404` | Get order details |
| `POST` | `/api/v1/orders/:id/cancel` | `200 OK` | `400`, `404` | Cancel order & release reserved stock |

---

## 6. Endpoint Details

### 1. Health & Diagnostics

#### `GET /health`
Returns the operational status of the service.

- **Response:**
  - `200 OK`
    ```json
    {
      "success": true,
      "status": "ok"
    }
    ```
  - `500 Internal Server Error`
    ```json
    {
      "success": false,
      "error": {
        "code": "INTERNAL_SERVER_ERROR",
        "message": "An internal server error occurred"
      }
    }
    ```

---

### 2. Products

#### `GET /api/v1/products`
Retrieves products from the catalog.

- **Query Parameters (Pagination & Filtering):**
  - `page` *(integer, optional, default: `1`)*: Page number.
  - `limit` *(integer, optional, default: `20`, max: `100`)*: Items per page.
  - `isActive` *(boolean, optional)*: Filter by active status.
- **Responses:**
  - `200 OK`
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "P001",
          "name": "Laptop",
          "priceInPaise": 500000,
          "isActive": true
        },
        {
          "id": "P002",
          "name": "Keyboard",
          "priceInPaise": 25000,
          "isActive": true
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "totalItems": 2,
        "totalPages": 1,
        "hasNextPage": false,
        "hasPrevPage": false
      }
    }
    ```
  - `500 Internal Server Error`

#### `GET /api/v1/products/:id`
Retrieves a single product by its unique identifier.

- **URL Parameters:**
  - `id` *(string, required)*: Unique product identifier (e.g. `P001` or UUID).
- **Responses:**
  - `200 OK`
    ```json
    {
      "success": true,
      "data": {
        "id": "P001",
        "name": "Laptop",
        "priceInPaise": 500000,
        "isActive": true
      }
    }
    ```
  - `404 Not Found` *(Current behaviour until database layer is connected)*
    ```json
    {
      "success": false,
      "error": {
        "code": "NOT_FOUND",
        "message": "Product with ID 'P001' not found"
      }
    }
    ```

---

### 3. Routing & Method Errors

#### Unknown Route (`* /any-unknown-path`)
Triggered when requesting any path not registered on the router.

- **Response:**
  - `404 Not Found`
    ```json
    {
      "success": false,
      "error": {
        "code": "NOT_FOUND",
        "message": "Route not found: GET /any-unknown-path"
      }
    }
    ```

#### Known Route with Unsupported Method (e.g., `POST /health`, `POST /api/v1/products`)
Triggered when a route exists but does not support the HTTP verb used.

- **Headers:**
  - `Allow`: Comma-separated list of permitted HTTP methods (e.g., `Allow: GET`).
- **Response:**
  - `405 Method Not Allowed`
    ```json
    {
      "success": false,
      "error": {
        "code": "METHOD_NOT_ALLOWED",
        "message": "Method POST not allowed on /health"
      }
    }
    ```

---

## 7. Pagination Design (Product Catalog)

To ensure high performance under large catalog volumes, collection queries use offset-based pagination with bounded limits.

### Query Parameters
- `page` *(number, default: `1`)*: 1-indexed page pointer. Values `< 1` default to `1`.
- `limit` *(number, default: `20`, maximum: `100`)*: Number of records to return. Prevents denial-of-service via oversized payloads.

### Pagination Metadata Object
Collections return metadata embedded in the standard envelope:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 2,
    "limit": 20,
    "totalItems": 154,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

---

## 8. Idempotency Requirements for Order Creation

Placing an order initiates multi-step operations: inventory row reservations, database persistence, and payment collection. Network drops or user retries must never cause duplicate orders or multiple charges.

### Client Contract: `Idempotency-Key` Header
When calling `POST /api/v1/orders`:
- **Header:** `Idempotency-Key: <UUIDv4>` *(string, required)*.
- The key must be generated by the client prior to dispatching the request.

### Server-Side Lifecycle & Guarantees
1. **Acquiring Lock:**
   Upon arrival, the server queries Redis for `idempotency:<client_id>:<key>`.
   - If a lock exists and is currently `PROCESSING`, the server rejects with `409 Conflict` (or pauses until the transaction settles).
2. **First-Time Processing:**
   If the key is fresh, a distributed lock is acquired with a TTL (e.g., 60 seconds). The transactional order placement executes.
3. **Caching Response:**
   Upon successful commit (or deterministic failure), the full HTTP status code and response payload are stored in Redis under the idempotency key with a 24-hour expiration.
4. **Idempotent Replay:**
   If the client retries with the same `Idempotency-Key` and identical payload, the server returns the cached response with a tracking header:
   - `Idempotent-Replayed: true`
   - Returns the original `201 Created` or `400 Bad Request` without re-running transactions or deducting stock twice.
5. **Payload Mismatch:**
   If an existing `Idempotency-Key` is supplied with a different request body (e.g., different items or quantities), the server rejects immediately:
   - `422 Unprocessable Entity`
   ```json
   {
     "success": false,
     "error": {
       "code": "IDEMPOTENCY_KEY_MISMATCH",
       "message": "Idempotency key has already been used with a different request payload"
     }
   }
   ```
