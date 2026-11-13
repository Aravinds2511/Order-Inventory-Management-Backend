import app from "./app.js";

import { loadConfig } from "./config/env.js";

import { registerShutdownHandlers } from "./lifecycle/shutdown.js";

const config = loadConfig();

const server = app.listen(config.port, () => {
    console.log(
        `Server listening on port ${config.port}`
    );
});

registerShutdownHandlers(async () => {
    await new Promise<void>((resolve, reject) => {
        server.close(error => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
});