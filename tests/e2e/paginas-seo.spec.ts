import { test, expect, type Page } from "@playwright/test";
import { PaginasPage, VIEWPORTS, uniq } from "./pages/PaginasPage";

/**
 * Construtor de páginas — Definições e SEO (F15) nas três larguras: a pontuação («SEO NN») recalcula-se
 * enquanto se edita — sobe com 1 H1, desce com um 2.º H1 — e a lista de verificações diz porquê. Mais a
 * janela «SEO do site» (todas as páginas, com o 1.º problema de cada uma).
 */

test.use({ storageState: { cookies: [], origins: [] } });

/** O selo «SEO NN» do caminho do editor (o «SEO do site» da barra tem outro nome). */
const seal = (page: Page) => page.getByRole("button", { name: /^SEO \d+$/ });
const score = async (page: Page): Promise<number> => Number((await seal(page).textContent())!.match(/\d+/)![0]);

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · SEO — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("a pontuação sobe com um H1 e desce quando se põe um 2.º H1", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const [pg, bl] = [`Seo-${u}`, `BlSeo-${u}`];

      await p.createPage(pg, `seo-${u}`);
      await p.addStarter("Título e texto");
      await p.openItem("Título e texto");
      await p.renameBlock(bl);
      await p.compHead(0).click();
      await page.getByRole("textbox", { name: "Texto (PT)" }).fill(`Primeiro titulo ${u}`);
      await page.getByRole("textbox", { name: "Texto (EN)" }).fill(`First title ${u}`);

      // O título nasce H2: não há H1 nenhum.
      const s0 = await score(page);
      await seal(page).click();
      await expect(page.getByText("Nenhum título H1.")).toBeVisible();
      await expect(page.getByRole("status", { name: /Pontuação de SEO/ })).toHaveAccessibleName(`Pontuação de SEO ${s0} de 100`);

      // Um H1: a pontuação sobe e a verificação passa.
      await p.openTab("Conteúdo");
      await p.openItem(bl);
      await p.compHead(0).click();
      await p.choice("Nível (para o Google)", "H1").click();
      await expect.poll(() => score(page)).toBeGreaterThan(s0);
      const s1 = await score(page);

      // Um 2.º título, também H1: a pontuação desce abaixo da anterior.
      await p.addComponent("Título");
      await page.getByRole("textbox", { name: "Texto (PT)" }).fill(`Segundo titulo ${u}`);
      await page.getByRole("textbox", { name: "Texto (EN)" }).fill(`Second title ${u}`);
      await p.choice("Nível (para o Google)", "H1").click();
      await expect.poll(() => score(page)).toBeLessThan(s1);
      const s2 = await score(page);

      await seal(page).click();
      await expect(page.getByRole("status", { name: /Pontuação de SEO/ })).toHaveAccessibleName(`Pontuação de SEO ${s2} de 100`);
      await expect(page.getByText(`2 títulos H1 (${bl}, ${bl}). Deixa só um.`)).toBeVisible();

      // Voltar a um só H1 (o 2.º passa a H2) devolve a pontuação.
      await p.openTab("Conteúdo");
      await p.openItem(bl);
      await p.compHead(2).click();
      await p.choice("Nível (para o Google)", "H2").click();
      await expect.poll(() => score(page)).toBe(s1);
      await seal(page).click();
      await expect(page.getByText(`Um título H1: «Primeiro titulo ${u}».`)).toBeVisible();
    });

    test("«SEO do site» lista as páginas com a pontuação e leva às Definições da escolhida", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const pg = `SeoSite-${u}`;
      await p.createPage(pg, `seosite-${u}`);

      await p.seoSiteBtn.click();
      const dialog = p.dialog;
      await expect(dialog.getByRole("heading", { name: "SEO do site" })).toBeVisible();
      await expect(dialog.getByText(/^Média do site: \d+\/100/)).toBeVisible();
      await expect(dialog.getByText("Feito automaticamente pelo site")).toBeVisible();
      const row = dialog.getByRole("button", { name: new RegExp(pg) });
      await expect(row).toContainText(`/seosite-${u} · rascunho`);
      await expect(row).toContainText("Nenhum título H1."); // o 1.º problema de uma página vazia
      // Língua da pré-visualização: EN usa o prefixo /en.
      await dialog.getByRole("group", { name: "Língua" }).getByRole("button", { name: "EN" }).click();
      await expect(row).toContainText(`/en/seosite-${u}`);

      await row.click();
      await expect(p.dialog).toHaveCount(0);
      await expect(page.getByRole("tab", { name: "Definições e SEO" })).toHaveAttribute("aria-selected", "true");
      await expect(p.pageHeading).toHaveText(pg);
      await expect(page.getByRole("region", { name: "Google (SEO)" })).toBeVisible();
    });
  });
}
