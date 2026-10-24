import { test, expect } from "@playwright/test";
import * as path from "path";
import { loginAs } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";

/** Capturas da fase 2c (só guardam; sem asserções de layout). Saída: .capturas/equipa-permissoes/capturas/2c/ */
const OUT = path.resolve(process.cwd(), ".capturas/equipa-permissoes/capturas/2c");
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

const SHOTS = [
  { user: "arvore-a@e2e.local", route: "/financeiro", file: "2c-financeiro-negocio-dono-390-light.png", ready: "Receita por fonte" },
  { user: "av-dashsv@e2e.local", route: "/dashboard", file: "2c-dashboard-membro-i-390-light.png", ready: "Marcações hoje" },
];

for (const s of SHOTS) {
  test(`captura ${s.file}`, async ({ page, context }) => {
    await page.addInitScript(() => { try { window.localStorage.setItem("bo.theme", "light"); } catch { /* sem localStorage */ } });
    await loginAs(context, s.user);
    await withSessionRetry(page, context, s.user, () => page.goto(s.route), async () => {
      await expect(page.getByText(s.ready, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${s.file}`, fullPage: true });
  });
}
