import { execSync } from "node:child_process";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, "../../../API-FullStack");

/**
 * Semeia a BD e2e dedicada (`api_e2e`) antes de toda a suite. Recria o schema
 * (sync force) e cria os tenants/permissões/dados de teste. Nunca toca em dev.
 */
export default function globalSetup(): void {
  // eslint-disable-next-line no-console
  console.log("[e2e] A semear a BD api_e2e (API-FullStack: pnpm seed:e2e)…");
  execSync("pnpm seed:e2e", { cwd: apiDir, stdio: "inherit" });
}
