# Phase 2 Context & Locked Decisions

**Phase:** Phase 2: Concurrency, Inventory & Idempotency  
**Project:** Order & Inventory Management API  
**Status:** Discussion Concluded / Ready for Planning  
**Date:** 2026-11-23  

---

## 1. Overview & Objectives

Phase 2 focuses on high-concurrency order placement, preventing overselling, ensuring fault-tolerant retried requests, and implementing the full order lifecycle (including order cancellation with atomic inventory restoration).

---

## 2. Locked Technical Decisions

| Domain Area | Locked Decision | Details & Implementation Rationale |
| :--- | :--- | :--- |
| **Idempotency Strategy** | **Hybrid Redis + PostgreSQL** | • **In-Flight Lock (Redis):** Mutex lock with short TTL (e.g., 30s) prevents concurrent requests sharing the same `Idempotency-Key` from running in parallel.<br>• **Durable Record (PostgreSQL):** Stores the final HTTP status code and response payload in `IdempotencyRecord` table within the same ACID transaction as the order creation. Subsequent duplicate requests receive the cached response immediately. |
| **Concurrency & Locking** | **Deterministic Ordering & Conditional Updates** | Requested product IDs are sorted lexicographically (`a.productId.localeCompare(b.productId)`) before locking to eliminate deadlocks. Inventory decrement executes conditionally (`quantity: { gte: requestedQuantity }`) under Serializable isolation with exponential retry. |
| **Order Cancellation** | **Atomic Restock & State Guard** | Orders in `PENDING` status can be cancelled by the owner customer or an admin via `POST /api/v1/orders/:id/cancel`. Stock is restored atomically within a transaction (`increment: quantity`). Once `PAID` or `CANCELLED`, orders cannot be cancelled via this endpoint. |
| **Order Querying** | **Scoped Isolation & Pagination** | `GET /api/v1/orders` returns paginated order summaries for the authenticated caller (`userId = req.user.id`). Admins can query with `userId` query parameter to inspect any user's orders. |

---

## 3. Database Schema Updates (Prisma)

To support durable idempotency, the `IdempotencyRecord` model will be added:

```prisma
model IdempotencyRecord {
  key          String   @id @db.VarChar(128)
  userId       String   @map("user_id")
  endpoint     String   @db.VarChar(255)
  requestHash  String   @map("request_hash") @db.VarChar(64)
  statusCode   Int      @map("status_code")
  responseBody Json     @map("response_body")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("idempotency_records")
}
```

---

## 4. Endpoints & Route Specifications

1. **`POST /api/v1/orders` (Idempotent Checkout)**
   - **Header:** `Idempotency-Key: <unique-uuid>` (Required)
   - **Behavior:**
     1. Validates presence and format of `Idempotency-Key`.
     2. Checks Redis: if in-flight lock exists, returns `409 Conflict` (Operation in progress).
     3. Checks PostgreSQL `IdempotencyRecord`: if key exists, verifies payload hash. If matching, returns cached response immediately. If payload changed, returns `422 Unprocessable Entity`.
     4. Executes transactional checkout with inventory decrement.
     5. Saves `IdempotencyRecord` inside the transaction.
     6. Releases Redis in-flight lock and returns `201 Created`.

2. **`POST /api/v1/orders/:id/cancel`**
   - **Auth Required:** `authenticate`
   - **Behavior:** Verifies caller ownership (or admin role). Checks order status is `PENDING`. Updates status to `CANCELLED` and atomically increments inventory quantities for all order items. Emits `order.cancelled` domain event.
   - **Response:** `200 OK` with updated order.

3. **`GET /api/v1/orders`**
   - **Auth Required:** `authenticate`
   - **Query Params:** `page`, `limit`, `status`
   - **Behavior:** Scoped to `userId = req.user.id` (or query-filtered for admins). Includes item summaries and pagination envelope.

4. **`GET /api/v1/orders/:id`**
   - **Auth Required:** `authenticate`
   - **Behavior:** Returns full order details with line items. Returns `404` if order doesn't exist or doesn't belong to the user (unless admin).

---

## 5. Success & Verification Criteria

1. Checkout with identical `Idempotency-Key` and payload returns the original order response without decrementing inventory twice.
2. Concurrent checkouts for the last available item result in exactly 1 successful order (`201 Created`) and subsequent requests receiving `409 Insufficient Inventory` with no negative stock.
3. Order cancellation safely restores reserved product inventory and transitions status to `CANCELLED`.
4. Customers cannot view or cancel orders belonging to other users.
