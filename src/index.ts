import app from "./app.js";
import { loadConfig } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { registerShutdownHandlers } from "./lifecycle/shutdown.js";

const config = loadConfig();

// Ensure startup database connection is established before starting the HTTP server
await prisma.$connect();
console.log("Database connection established.");

const server = app.listen(config.port, () => {
    console.log(
        `Server listening on port ${config.port}`
    );
});

registerShutdownHandlers(async () => {
    // 1. Close HTTP server and allow existing in-flight requests to complete
    await new Promise<void>((resolve, reject) => {
        server.close(error => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

    // 2. Disconnect Prisma after the HTTP server has finished closing
    await prisma.$disconnect();
    console.log("Database connection closed.");
});
