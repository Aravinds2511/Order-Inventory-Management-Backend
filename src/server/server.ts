import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { sendJson } from "./response.js";
import {
    AppError,
    HttpError,
    NotFoundError,
    MethodNotAllowedError
} from "../errors/app-error.js";

export interface Product {
    id: string;
    name: string;
    priceInPaise: number;
    isActive: boolean;
}

export const products: Product[] = [
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

export function handleError(err: unknown, res: ServerResponse): void {
    if (res.headersSent) {
        return;
    }

    if (err instanceof MethodNotAllowedError) {
        res.setHeader("Allow", err.allowedMethods.join(", "));
        sendJson(res, err.statusCode, {
            success: false,
            error: {
                code: err.code,
                message: err.message
            }
        });
        return;
    }

    if (err instanceof HttpError) {
        sendJson(res, err.statusCode, {
            success: false,
            error: {
                code: err.code,
                message: err.message
            }
        });
        return;
    }

    if (err instanceof AppError) {
        sendJson(res, 400, {
            success: false,
            error: {
                code: err.code,
                message: err.message
            }
        });
        return;
    }

    // Unexpected internal error: log server-side, never expose stack trace or internal details to client
    console.error("Unhandled server error processing request:", err);

    sendJson(res, 500, {
        success: false,
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An internal server error occurred"
        }
    });
}

export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
    try {
        const method = req.method?.toUpperCase() ?? "GET";
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        const pathname = url.pathname.length > 1 && url.pathname.endsWith("/")
            ? url.pathname.slice(0, -1)
            : url.pathname;

        // 1. /health -> only GET
        if (pathname === "/health") {
            if (method !== "GET") {
                throw new MethodNotAllowedError(["GET"], `Method ${method} not allowed on /health`);
            }
            sendJson(res, 200, {
                success: true,
                status: "ok"
            });
            return;
        }

        // 2. /api/v1/products -> only GET
        if (pathname === "/api/v1/products") {
            if (method !== "GET") {
                throw new MethodNotAllowedError(["GET"], `Method ${method} not allowed on /api/v1/products`);
            }
            sendJson(res, 200, {
                success: true,
                data: products
            });
            return;
        }

        // 3. /api/v1/products/:id -> only GET (returns 404 for now)
        const productDetailMatch = pathname.match(/^\/api\/v1\/products\/([^/]+)$/);
        if (productDetailMatch) {
            if (method !== "GET") {
                throw new MethodNotAllowedError(["GET"], `Method ${method} not allowed on /api/v1/products/:id`);
            }
            const productId = productDetailMatch[1];
            throw new NotFoundError(`Product with ID '${productId}' not found`);
        }

        // 4. Unknown endpoint -> 404
        throw new NotFoundError(`Cannot ${method} ${pathname}`);
    } catch (err) {
        handleError(err, res);
    }
}

export function createHttpServer(): Server {
    return createServer(handleRequest);
}

export const server = createHttpServer();
