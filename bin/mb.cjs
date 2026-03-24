#!/usr/bin/env node

// Use dynamic import so this launcher works even though the CLI is ESM.
Promise.resolve()
  .then(() => import("../dist/index.js"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
