/**
 * Custom error class thrown when an operation exceeds its configured timeout duration.
 */
class TimeoutError extends Error {
  /**
   * @param {string} message - Error description.
   * @param {number} [timeoutMs] - Duration of the timeout in milliseconds.
   */
  constructor(message = 'Operation timed out', timeoutMs) {
    super(message);
    this.name = 'TimeoutError';
    this.code = 'ERR_TIMEOUT';
    if (timeoutMs !== undefined) {
      this.timeoutMs = timeoutMs;
    }
    Error.captureStackTrace?.(this, TimeoutError);
  }
}

/**
 * Wraps an asynchronous operation with a timeout and cooperative cancellation support via AbortSignal.
 *
 * Important production consideration:
 * `Promise.race()` alone settles the outer promise but does not cancel or pause the underlying
 * asynchronous task. To prevent zombie workloads, memory leaks, and connection pool exhaustion,
 * this utility passes an `AbortSignal` to the operation. The operation must listen to or periodically
 * check this signal (e.g., passing it to fetch, database drivers, or calling `signal.throwIfAborted()`)
 * to achieve actual cooperative cancellation.
 *
 * @template T
 * @param {(signal: AbortSignal) => Promise<T> | T} operation - Asynchronous function to execute. Receives an AbortSignal.
 * @param {number} timeoutMs - Timeout duration in milliseconds.
 * @param {object} [options] - Optional configuration options.
 * @param {AbortSignal} [options.signal] - Optional parent AbortSignal to chain cancellation from an external caller.
 * @returns {Promise<T>} Resolves with the operation's result if completed within the timeout.
 * @throws {TimeoutError} When the operation exceeds the timeout limit.
 * @throws {TypeError} If `operation` is not a function or `timeoutMs` is not a number.
 * @throws {RangeError} If `timeoutMs` is negative or not finite.
 */
async function withTimeout(operation, timeoutMs, options = {}) {
  // 1. Validate arguments
  if (typeof operation !== 'function') {
    throw new TypeError('The "operation" argument must be a function.');
  }

  if (typeof timeoutMs !== 'number' || Number.isNaN(timeoutMs)) {
    throw new TypeError('The "timeoutMs" argument must be a number.');
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new RangeError('The "timeoutMs" argument must be a non-negative finite number.');
  }

  const parentSignal = options?.signal;
  if (parentSignal && !(parentSignal instanceof AbortSignal)) {
    throw new TypeError('The "options.signal" argument must be an instance of AbortSignal.');
  }

  if (parentSignal?.aborted) {
    throw parentSignal.reason || new Error('Operation was aborted prior to execution.');
  }

  // 2. Setup cancellation controller
  const controller = new AbortController();
  const { signal } = controller;

  let timerId;
  let parentAbortListener;
  const racePromises = [];

  // 3. Create timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const timeoutError = new TimeoutError(
        `Operation timed out after ${timeoutMs}ms`,
        timeoutMs
      );
      try {
        controller.abort(timeoutError);
      } catch {
        // Guard against controller already aborted
      }
      reject(timeoutError);
    }, timeoutMs);
  });
  racePromises.push(timeoutPromise);

  // 4. Handle optional external parent signal chaining
  if (parentSignal) {
    racePromises.push(
      new Promise((_, reject) => {
        parentAbortListener = () => {
          const reason = parentSignal.reason || new Error('Operation was aborted.');
          try {
            controller.abort(reason);
          } catch {
            // Guard against controller already aborted
          }
          reject(reason);
        };
        parentSignal.addEventListener('abort', parentAbortListener, { once: true });
      })
    );
  }

  try {
    // 5. Execute operation with AbortSignal passed as argument
    const operationPromise = Promise.resolve().then(() => operation(signal));

    // Suppress unhandled rejection warning if operation fails after timeout has already triggered
    operationPromise.catch(() => {});

    racePromises.push(operationPromise);

    return await Promise.race(racePromises);
  } finally {
    // 6. Clean up timer and event listeners
    clearTimeout(timerId);
    if (parentSignal && parentAbortListener) {
      parentSignal.removeEventListener('abort', parentAbortListener);
    }
  }
}

module.exports = withTimeout;
module.exports.withTimeout = withTimeout;
module.exports.TimeoutError = TimeoutError;
