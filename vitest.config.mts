import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    // Integration tests hit live Solana RPCs and only run when RUN_INTEGRATION=1.
    include: process.env.RUN_INTEGRATION ? ["tests/integration/**/*.test.ts"] : ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
  },
});
