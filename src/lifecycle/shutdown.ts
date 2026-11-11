/**
 * Registers process signal handlers to ensure graceful application shutdown.
 *
 * @param cleanup - Asynchronous callback invoked once when SIGINT or SIGTERM is received.
 */
export function registerShutdownHandlers(
    cleanup: (signal: NodeJS.Signals) => Promise<void>
): void {
    if (typeof cleanup !== "function") {
        throw new TypeError("Cleanup handler must be a function.");
    }

    let isShuttingDown = false;

    const handleShutdown = async (signal: NodeJS.Signals): Promise<void> => {
        // Prevent cleanup from executing more than once
        if (isShuttingDown) {
            return;
        }
        isShuttingDown = true;

        try {
            await cleanup(signal);
        } catch (error) {
            console.error(`Error during graceful shutdown on ${signal}:`, error);
            // Indicate failure via exitCode without abruptly killing the process
            process.exitCode = 1;
        }
    };

    process.on("SIGINT", () => {
        void handleShutdown("SIGINT");
    });

    process.on("SIGTERM", () => {
        void handleShutdown("SIGTERM");
    });
}

