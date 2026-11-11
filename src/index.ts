import { loadConfig } from "./config/env.js";

import { registerShutdownHandlers } from "./lifecycle/shutdown.js";

const config = loadConfig();

console.log("Application configuration loaded:", {
    nodeEnv: config.nodeEnv,
    port: config.port,
    logLevel: config.logLevel
});

registerShutdownHandlers(async (signal) => {
    console.log(`Received ${signal}. Starting shutdown...`);

    // Database, Redis and server cleanup will be added later.

    console.log("Cleanup completed.");
});

console.log("Application bootstrap completed.");