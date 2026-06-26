import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, ".env.test") });

const authFile = path.join(__dirname, "tests/e2e/.auth/user.json");
const apiDir = path.resolve(__dirname, "../API-FullStack");

// Portas dedicadas do e2e — NUNCA colidem com o dev (Vite 5173 / API 3001 / BD dev).
//   API de teste :3002 (BD api_e2e no mysql-test:3307) · Vite de teste :5273
const E2E_WEB = "http://localhost:5273";
const E2E_API = "http://localhost:3002";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // 1 retry local (CI: 2): a suite corre em paralelo contra um backend partilhado
  // e o mesmo utilizador admin autentica em vários workers — uma rara corrida de
  // rotação de refresh token pode derrubar uma sessão; o retry reexecuta limpo.
  retries: process.env.CI ? 2 : 1,
  // Serial: a API e2e é um único processo ts-node e os tenants partilhados fazem
  // login por teste — concorrência causa sobrecarga + corridas de rotação de token.
  // Em série a suite é mais lenta (~5min) mas 100% fiável.
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  // Semeia a BD api_e2e (tenants/permissões/dados) antes de toda a suite.
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: E2E_WEB,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
      dependencies: ["setup"],
    },
  ],

  webServer: [
    {
      // API de teste (ENVIRONMENT=TEST, .env.e2e → api_e2e:3307, porta 3002).
      command: "pnpm serve:e2e",
      cwd: apiDir,
      url: `${E2E_API}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // Vite em modo test → lê .env.test (VITE_API_BASE_URL=:3002), porta 5273.
      command: "pnpm exec vite --mode test --port 5273 --strictPort",
      url: E2E_WEB,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
