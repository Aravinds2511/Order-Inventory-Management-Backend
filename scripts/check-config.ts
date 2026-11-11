import assert from "node:assert/strict";

import { loadConfig } from "../src/config/env.js";

assert.deepEqual(loadConfig({}), {
    port: 3000,
    nodeEnv: "development",
    logLevel: "info"
});

assert.equal(
    loadConfig({ PORT: "4000" }).port,
    4000
);

assert.throws(
    () => loadConfig({ PORT: "invalid" })
);

assert.throws(
    () => loadConfig({ NODE_ENV: "staging" })
);

assert.throws(
    () => loadConfig({ LOG_LEVEL: "verbose" })
);

console.log("Configuration tests passed.");

