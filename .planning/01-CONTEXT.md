# Phase 1 Context & Locked Decisions

**Phase:** Phase 1: Core Backend, Authentication & Order Context  
**Project:** Order & Inventory Management API  
**Status:** Discussion Concluded / Ready for Planning  
**Date:** 2026-11-23  

---

## 1. Overview & Objectives

Phase 1 establishes the foundational security, authentication, and core domain integration for the Order & Inventory API. It replaces mock user assumptions (such as `TEMPORARY_TEST_USER_ID = "test-user-001"`) with a production-grade authentication and authorization system, enables catalog management by administrators, and enforces customer order isolation.

---

## 2. Locked Technical Decisions

The following choices were discussed and finalized during `/gsd-discuss-phase 1`:

| Domain Area | Locked Decision | Details & Implementation Rationale |
| :--- | :--- | :--- |
| **Input Validation** | **Zod** (`zod`) | Type-safe schema validation with compile-time TypeScript type inference. Reusable validation middleware validating `req.body`, `req.query`, and `req.params`. |
| **Password Hashing** | **Argon2** (`argon2`) | Winner of the Password Hashing Competition (PHC). Memory-hard, resistant to GPU/ASIC cracking, modern security standard. |
| **Token Strategy** | **Access Token + Refresh Token Rotation** | • Short-lived stateless JWT access token (e.g., 15 minutes) passed in `Authorization: Bearer <token>`.<br>• Long-lived persistent refresh token (e.g., 7 days) stored with hashed representation in PostgreSQL for revocation and automatic reuse detection/rotation. |
| **Admin Provisioning** | **Admin Registration Secret Key** | Registration defaults to role `CUSTOMER`. If a user attempts to register with role `ADMIN`, `ADMIN_REGISTRATION_SECRET` (via header `x-admin-secret` or payload field) must match the environment configuration. |
| **Order Ownership** | **Strict Isolation** | Non-admin customers can only access their own orders. Admins can view and manage orders across all users. |

---

## 3. Database Schema Updates (Prisma)

To support **Refresh Token Rotation**, a new model will be added to `prisma/schema.prisma`:

```prisma
model RefreshToken {
  id              String    @id @default(cuid())
  userId          String    @map("user_id")
  tokenHash       String    @map("token_hash")
  expiresAt       DateTime  @map("expires_at") @db.Timestamptz(3)
  revokedAt       DateTime? @map("revoked_at") @db.Timestamptz(3)
  replacedByToken String?   @map("replaced_by_token")
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@map("refresh_tokens")
}
```

---

## 4. Endpoints & Route Specifications

### Authentication Routes (`/api/v1/auth`)

1. **`POST /api/v1/auth/register`**
   - **Body:** `{ email, password, role? }`
   - **Headers:** Optional `x-admin-secret` if `role: "ADMIN"` requested.
   - **Validation:** Zod schema (valid email, strong password length >= 8).
   - **Response:** `201 Created` with User object (excluding `passwordHash`), Access Token, and Refresh Token.

2. **`POST /api/v1/auth/login`**
   - **Body:** `{ email, password }`
   - **Verification:** Argon2 verification against stored `passwordHash`.
   - **Response:** `200 OK` with User object, Access Token, and Refresh Token.

3. **`POST /api/v1/auth/refresh`**
   - **Body:** `{ refreshToken }` (or cookie)
   - **Behavior:** Validates token hash, checks revocation/expiry, revokes old token, issues new Access Token + new rotated Refresh Token.
   - **Reuse Detection:** If a revoked refresh token is presented, invalidate all refresh tokens for that user family.

4. **`POST /api/v1/auth/logout`**
   - **Body:** `{ refreshToken }`
   - **Behavior:** Marks the refresh token as revoked (`revokedAt = now()`).
   - **Response:** `200 OK`.

5. **`GET /api/v1/auth/me`**
   - **Auth:** Requires valid Bearer Access Token.
   - **Response:** `200 OK` with currently authenticated user profile.

---

### Protected Domain Routes & Role Guards

1. **`POST /api/v1/orders`**
   - **Auth Required:** `authenticate` middleware.
   - **Integration:** Replaces `TEMPORARY_TEST_USER_ID` with `req.user.id`.
   - **Validation:** Zod validation for line items (`productId`, `quantity >= 1`).

2. **`GET /api/v1/orders` & `GET /api/v1/orders/:id`**
   - **Auth Required:** `authenticate` middleware.
   - **Filtering:** Regular customers only receive orders matching `userId === req.user.id`. Admins can inspect any order.

3. **`POST /api/v1/products`**
   - **Auth Required:** `authenticate` + `requireRole([UserRole.ADMIN])`.
   - **Validation:** Zod schema (`name`, `sku`, `priceInPaise > 0`, `initialStock >= 0`).
   - **Behavior:** Atomically creates product and inventory records.

---

## 5. Security & Error Handling Standards

- **Error Format:** Strictly conforms to [`docs/api-contract.md`](file:///home/aravind/Nodejs_Projects_Adv/order-inventory-api/docs/api-contract.md):
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | CONFLICT | NOT_FOUND",
      "message": "...",
      "details": []
    }
  }
  ```
- **Password Safety:** `passwordHash` is never selected or serialized in JSON responses.
- **Token Invalidation:** Explicit logout or password changes invalidate active refresh tokens.

---

## 6. Success & Verification Criteria

1. All new auth endpoints covered by functional/integration tests.
2. User registration and login successfully issue JWT access tokens and rotatable refresh tokens.
3. Protected routes correctly reject unauthenticated requests (`401`) and unauthorized role attempts (`403`).
4. `order.controller.ts` creates orders attributed directly to the authenticated caller's `req.user.id`.
5. TypeScript compilation (`npm run typecheck`) and database migrations pass without errors.
