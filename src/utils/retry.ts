export interface RetryOptions {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes an asynchronous operation with exponential backoff and jitter.
 *
 * @param operation - The asynchronous function to execute.
 * @param options - Configuration options for retry limits, backoff timing, and error predicate.
 * @returns The resolved value of the operation.
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const maxAttempts = options.maxAttempts ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 50;
    const maxDelayMs = options.maxDelayMs ?? 500;
    const shouldRetry = options.shouldRetry ?? (() => true);

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            // Immediately propagate if max attempts reached or error is not retryable
            if (attempt >= maxAttempts || !shouldRetry(error)) {
                throw error;
            }

            // Exponential backoff with full jitter
            const exponentialDelay = Math.min(
                maxDelayMs,
                baseDelayMs * Math.pow(2, attempt - 1)
            );
            const jitteredDelay = Math.random() * exponentialDelay;

            await sleep(jitteredDelay);
        }
    }

    throw lastError;
}
