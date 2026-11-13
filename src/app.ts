import express from "express";

import productRouter from "./routes/product.routes.js";

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

// 4. Product routes
app.use("/api/v1/products", productRouter);

// 5. Handle unknown routes
app.use(notFoundHandler);

// 6. Centralized error handler
app.use(errorHandler);

export default app;