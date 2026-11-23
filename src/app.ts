import express from "express";

import authRouter from "./routes/auth.routes.js";
import productRouter from "./routes/product.routes.js";
import orderRouter from "./routes/order.routes.js";

import { createRequestLogger } from "./middleware/request-logger.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";

const app = express();

// 1. Request logging
app.use(createRequestLogger());

// 2. Body parsing
app.use(express.json({ limit: "1mb" }));

// 3. Health check
app.get("/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "API is healthy"
    });
});

// 4. Auth routes
app.use("/api/v1/auth", authRouter);

// 5. Product routes
app.use("/api/v1/products", productRouter);

// 6. Order routes
app.use("/api/v1/orders", orderRouter);

// 7. Handle unknown routes
app.use(notFoundHandler);

// 8. Centralized error handler
app.use(errorHandler);

export default app;