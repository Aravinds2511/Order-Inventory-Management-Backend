/**
 * scripts/test-with-timeout.js
 *
 * Test script for src/utils/withTimeout.js covering all required scenarios:
 * 1. Operation resolves in 1 second, timeout is 5 seconds -> Return result
 * 2. Operation takes 7 seconds, timeout is 5 seconds -> Timeout error
 * 3. Operation immediately rejects -> Propagate original error
 * 4. Operation throws synchronously -> Return rejected Promise
 * 5. Invalid timeout value -> Reject invalid input
 * 6. Operation supports AbortSignal and times out -> Abort signal is triggered
 *
 * Usage:
 *   node scripts/test-with-timeout.js           # Full timing (1s, 5s, 7s)
 *   node scripts/test-with-timeout.js --fast    # Fast mode (scaled to 100ms, 500ms, 700ms)
 */

const withTimeout = require('../src/utils/withTimeout');
const { TimeoutError } = withTimeout;

const isFast = process.argv.includes('--fast') || process.env.FAST === '1';
const scale = isFast ? 0.1 : 1;
const delay = (ms) => Math.round(ms * scale);

// Helper for promise-based delays
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runScenario(name, fn) {
  process.stdout.write(`Testing: ${name}... `);
  const start = Date.now();
  try {
    await fn();
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\x1b[32mPASSED\x1b[0m (${duration}s)`);
    return true;
  } catch (error) {
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\x1b[31mFAILED\x1b[0m (${duration}s)`);
    console.error(`  Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack.split('\n').slice(1, 3).join('\n'));
    }
    return false;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log(`Running withTimeout Test Suite ${isFast ? '(Fast Mode)' : '(Standard Timing)'}`);
  console.log('='.repeat(70));

  const results = [];

  // Scenario 1: Operation resolves in 1 second, timeout is 5 seconds
  results.push(
    await runScenario(
      `Scenario 1: Operation resolves in ${delay(1000)}ms, timeout is ${delay(5000)}ms -> Return result`,
      async () => {
        const result = await withTimeout(async () => {
          await sleep(delay(1000));
          return { status: 'SUCCESS', data: 'Operation completed' };
        }, delay(5000));

        if (!result || result.status !== 'SUCCESS') {
          throw new Error(`Expected result with status 'SUCCESS', got: ${JSON.stringify(result)}`);
        }
      }
    )
  );

  // Scenario 2: Operation takes 7 seconds, timeout is 5 seconds
  results.push(
    await runScenario(
      `Scenario 2: Operation takes ${delay(7000)}ms, timeout is ${delay(5000)}ms -> Timeout error`,
      async () => {
        let timedOut = false;
        try {
          await withTimeout(async () => {
            await sleep(delay(7000));
            return 'Should not reach here';
          }, delay(5000));
        } catch (error) {
          if (error instanceof TimeoutError || error.name === 'TimeoutError') {
            timedOut = true;
          } else {
            throw new Error(`Expected TimeoutError, got ${error.name}: ${error.message}`);
          }
        }

        if (!timedOut) {
          throw new Error('Expected operation to reject with a TimeoutError');
        }
      }
    )
  );

  // Scenario 3: Operation immediately rejects
  results.push(
    await runScenario(
      'Scenario 3: Operation immediately rejects -> Propagate original error',
      async () => {
        const expectedError = new Error('Database connection failed');
        let caughtError = null;

        try {
          await withTimeout(async () => {
            return Promise.reject(expectedError);
          }, delay(5000));
        } catch (error) {
          caughtError = error;
        }

        if (caughtError !== expectedError) {
          throw new Error(
            `Expected original error instance "${expectedError.message}", but caught: "${caughtError?.message}"`
          );
        }
      }
    )
  );

  // Scenario 4: Operation throws synchronously
  results.push(
    await runScenario(
      'Scenario 4: Operation throws synchronously -> Return rejected Promise',
      async () => {
        const expectedError = new Error('Immediate validation failure');
        let caughtError = null;

        try {
          await withTimeout(() => {
            throw expectedError;
          }, delay(5000));
        } catch (error) {
          caughtError = error;
        }

        if (caughtError !== expectedError) {
          throw new Error(
            `Expected synchronously thrown error "${expectedError.message}", but caught: "${caughtError?.message}"`
          );
        }
      }
    )
  );

  // Scenario 5: Invalid timeout value
  results.push(
    await runScenario(
      'Scenario 5: Invalid timeout value -> Reject invalid input',
      async () => {
        const invalidValues = [-100, NaN, '5000', -1, Infinity];

        for (const val of invalidValues) {
          let caught = false;
          try {
            await withTimeout(async () => 'ok', val);
          } catch (error) {
            if (error instanceof TypeError || error instanceof RangeError) {
              caught = true;
            } else {
              throw new Error(
                `Expected TypeError or RangeError for timeout value "${val}", but received: ${error.name}`
              );
            }
          }
          if (!caught) {
            throw new Error(`Expected rejection for invalid timeout value: ${val}`);
          }
        }
      }
    )
  );

  // Scenario 6: Operation supports AbortSignal and times out
  results.push(
    await runScenario(
      'Scenario 6: Operation supports AbortSignal and times out -> Abort signal is triggered',
      async () => {
        let abortTriggered = false;
        let signalReceived = null;
        let timerCleared = false;

        const timeoutLimit = delay(500); // 500ms or 50ms in fast mode
        const operationDuration = delay(1500);

        try {
          await withTimeout(async (signal) => {
            signalReceived = signal;

            return new Promise((resolve, reject) => {
              const timer = setTimeout(() => {
                resolve('Completed without cancellation');
              }, operationDuration);

              signal.addEventListener('abort', () => {
                clearTimeout(timer);
                timerCleared = true;
                abortTriggered = true;
                reject(signal.reason);
              });
            });
          }, timeoutLimit);
        } catch (error) {
          if (!(error instanceof TimeoutError)) {
            throw new Error(`Expected TimeoutError, but got: ${error.name} - ${error.message}`);
          }
        }

        if (!signalReceived) {
          throw new Error('AbortSignal was not provided to operation');
        }
        if (!abortTriggered) {
          throw new Error('AbortSignal listener was not triggered when timeout occurred');
        }
        if (!signalReceived.aborted) {
          throw new Error('signal.aborted should be true');
        }
        if (!timerCleared) {
          throw new Error('Underlying operation timer was not cancelled via abort signal');
        }
      }
    )
  );

  console.log('='.repeat(70));
  const passedCount = results.filter(Boolean).length;
  console.log(`Summary: ${passedCount}/${results.length} scenarios passed.`);
  console.log('='.repeat(70));

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

