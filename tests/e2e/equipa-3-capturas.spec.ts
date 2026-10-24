import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import { loginAs } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { EquipaPage } from "./pages/EquipaPage";

/**
 * Fase 3 — capturas responsivas de `/equipa` (1440 / 834 / 390): lista do dono, ficha com Permissões e Actividade, e o modal
 * de convite do delegado. Guardam em `.capturas/equipa-permissoes/capturas/fase3/` e afirmam o que dá para medir:
 * sem scroll horizontal da página e o modal dentro do ecrã. (O resto — texto cortado, sobreposição — vê-se nas imagens.)
 */
const OUT = path.resolve(process.cwd(), ".capturas/equipa-permissoes/capturas/fase3");
const DONO = "equipa3@e2e.local";
const GERIR = "e3-gerir@e2e.local";
const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "834", width: 834, height: 1112 },
  { label: "390", width: 390, height: 844 },
] as const;

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ retries: 0 });

async function noHorizontalScroll(page: Page, what: string) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, `${what}: scroll horizontal da página (${sw} > ${cw})`).toBeLessThanOrEqual(cw + 1);
}

/** O diálogo cabe no ecrã e o seu conteúdo não transborda em largura. */
async function dialogFits(page: Page, what: string) {
  const dlg = page.getByRole("dialog").last();
  const box = (await dlg.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x, `${what}: diálogo cortado à esquerda`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${what}: diálogo cortado à direita`).toBeLessThanOrEqual(vp.width + 1);
  expect(box.y + box.height, `${what}: diálogo cortado em baixo`).toBeLessThanOrEqual(vp.height + 1);
  const overflow = await dlg.evaluate((el) => {
    const scrollers = [el, ...Array.from(el.querySelectorAll("*"))] as HTMLElement[];
    return scrollers.filter((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX === "visible" && n.clientWidth > 0).length;
  });
  expect(overflow, `${what}: elementos a transbordar na horizontal`).toBe(0);
}

for (const vp of VIEWPORTS) {
  test.describe(`Fase 3 capturas · ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("dono: lista, ficha (Permissões e Actividade)", async ({ page, context }) => {
      await page.addInitScript(() => {
        try { window.localStorage.setItem("bo.theme", "light"); } catch { /* sem localStorage */ }
      });
      const ep = new EquipaPage(page, context, DONO);
      await ep.open();
      await expect(ep.row("Carlos Criador")).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(500);
      await noHorizontalScroll(page, "lista");
      await page.screenshot({ path: `${OUT}/equipa-lista-dono-${vp.label}.png`, fullPage: true });

      const ficha = await ep.openMember("Carlos Criador");
      await ep.expand(ficha, "Agenda");
      await page.waitForTimeout(400);
      await dialogFits(page, "ficha / Permissões");
      await noHorizontalScroll(page, "ficha / Permissões");
      await page.screenshot({ path: `${OUT}/equipa-ficha-permissoes-${vp.label}.png` });

      await ficha.getByRole("tab", { name: "Actividade" }).click();
      await expect(
        ficha.getByText("Ainda sem actividade").or(ficha.getByRole("list", { name: "Actividade do membro" })),
      ).toBeVisible({ timeout: 10_000 });
      await dialogFits(page, "ficha / Actividade");
      await page.screenshot({ path: `${OUT}/equipa-ficha-actividade-${vp.label}.png` });
    });

    test("delegado: modal de convite (árvore com o que não tem desactivado)", async ({ page, context }) => {
      await page.addInitScript(() => {
        try { window.localStorage.setItem("bo.theme", "light"); } catch { /* sem localStorage */ }
      });
      await loginAs(context, GERIR);
      await withSessionRetry(page, context, GERIR, () => page.goto("/equipa"), async () => {
        await expect(page.getByRole("button", { name: "Convidar utilizador" })).toBeVisible({ timeout: 10_000 });
      });
      await page.waitForTimeout(500);
      await noHorizontalScroll(page, "lista do delegado");
      await page.screenshot({ path: `${OUT}/equipa-lista-delegado-${vp.label}.png`, fullPage: true });

      await page.getByRole("button", { name: "Convidar utilizador" }).click();
      const invite = page.getByRole("dialog", { name: "Convidar utilizador" });
      await expect(invite.getByRole("list", { name: "Permissões" })).toBeVisible();
      await invite.getByRole("checkbox", { name: "Clientes", exact: true }).check();
      await invite.getByRole("checkbox", { name: "Equipa", exact: true }).check();
      await page.waitForTimeout(400);
      await dialogFits(page, "convite do delegado");
      await noHorizontalScroll(page, "convite do delegado");
      await page.screenshot({ path: `${OUT}/equipa-convite-delegado-${vp.label}.png` });
    });
  });
}
