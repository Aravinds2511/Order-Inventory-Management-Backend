# Order & Inventory API

An enterprise-ready e-commerce backend service for product catalog management, real-time inventory tracking with concurrency control, and transactional order processing.

---

## 📖 Project Overview

The **Order & Inventory API** provides a backend platform designed to handle high-concurrency order placement, inventory reservations, and payment lifecycles. It emphasizes transactional consistency, race condition prevention (preventing negative inventory), and idempotent order submissions.

Detailed documentation:
- [Requirements & Business Rules](file:///home/aravind/Nodejs_Projects_Adv/order-inventory-api/docs/requirements.md)
- [Architecture & Layer Responsibilities](file:///home/aravind/Nodejs_Projects_Adv/order-inventory-api/docs/architecture.md)

---

## 🛠 Technology Stack

- **Runtime & Framework:** Node.js, Express.js
- **Primary Database:** PostgreSQL (ACID-compliant relational database for persistent domain entities and transactions)
- **Cache & Queue:** Redis (in-memory caching, distributed locks, idempotency key storage, and background jobs)
- **Architecture Pattern:** Modular Monolith (Layered: Routes -> Middleware -> Controllers -> Services -> Repositories)

---

## ✨ Main Features

- **Product & Catalog Management:** Product creation, updates, and server-authoritative pricing.
- **Inventory Tracking & Concurrency Safety:** Real-time stock tracking with locking mechanisms to prevent overselling or negative inventory under concurrent checkouts.
- **Order Processing:** End-to-end order placement with atomic multi-item reservations and state transitions (`PENDING`, `CONFIRMED`, `CANCELLED`, `FAILED`).
- **Idempotent Operations:** Prevents duplicate order creation and multiple charges during retries or network drops.
- **Role-Based Access Control (RBAC):** Distinct permissions and data isolation for `Customer` (own order visibility) and `Admin` (product/inventory management).
- **Atomic Operations:** Guarantees that failed order flows automatically roll back inventory changes without leaving partial state.

---

## 🏛 Project Architecture

The application adopts a **Modular Monolith** architecture with strict layer boundaries:

```
Client
  │
  ▼
Express Routes & Middleware  ──> (Auth, Validation, Idempotency)
  │
  ▼
Controllers                  ──> (HTTP Request/Response handling)
  │
  ▼
Services                     ──> (Business Logic & Transactions)
  │
  ▼
Repositories                 ──> (Data Access Layer)
  │             │
  ▼             ▼
PostgreSQL     Redis
(Persistence)  (Cache & Jobs)
```

For an in-depth breakdown of each layer's responsibilities, see [docs/architecture.md](file:///home/aravind/Nodejs_Projects_Adv/order-inventory-api/docs/architecture.md).

---

## 🚀 Installation & Setup

> **Note:** Setup instructions will be updated as dependencies and implementation progress.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/)
- [Redis](https://redis.io/)

### Getting Started (WIP)
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd order-inventory-api
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Update DATABASE_URL, REDIS_URL, PORT, etc.
   ```

4. **Run database migrations:**
   ```bash
   # Command to be finalized during database setup
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

