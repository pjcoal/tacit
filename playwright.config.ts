import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3200);
const MOCK_PORT = 4011;

/**
 * E2E runs the real app against a local OpenAI-compatible fixture
 * (tests/fixtures/mock-provider.mjs) configured as the "custom" provider, an
 * embedded PGlite database, and placeholder treasury / mint addresses so the
 * payment and token UIs render. No real funds or provider keys are involved.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `node tests/fixtures/mock-provider.mjs`,
      env: { MOCK_PROVIDER_PORT: String(MOCK_PORT) },
      port: MOCK_PORT,
      reuseExistingServer: false,
    },
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/api/models`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        PGLITE_DIR: ".data/pglite-e2e",
        OPENAI_COMPATIBLE_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/v1`,
        OPENAI_COMPATIBLE_API_KEY: "e2e",
        CUSTOM_MODELS: JSON.stringify([
          { id: "local-echo", label: "Local Echo (fixture)", family: "Local", provider: "custom", upstream: "echo", tools: true, free: true, tier: "fast", priceIn: 1, priceOut: 2 },
        ]),
        TREASURY_WALLET: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        PROJECT_TOKEN_MINT: "So11111111111111111111111111111111111111112",
        SOLANA_NETWORK: "devnet",
        FREE_DAILY_MESSAGES: "200",
      },
    },
  ],
});
