import { loadConfig } from "./config/env.js";
import { registerShutdownHandlers } from "./lifecycle/shutdown.js";
import { createHttpServer } from "./server/server.js";

const config = loadConfig();
const server = createHttpServer();

server.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
});

registerShutdownHandlers(async (signal) => {
    console.log(`Received ${signal}. Gracefully shutting down HTTP server...`);

    await new Promise<void>((resolve, reject) => {
        server.close((err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });

    console.log("HTTP server closed cleanly.");
});
