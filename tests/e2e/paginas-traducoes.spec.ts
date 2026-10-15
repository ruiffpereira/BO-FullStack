import { test, expect } from "@playwright/test";
import { PaginasPage, VIEWPORTS, uniq } from "./pages/PaginasPage";

/**
 * Construtor de páginas — traduções em falta (F15) nas três larguras. O tenant `pages@e2e` tem PT (base)
 * e EN. Um texto escrito só na base deixa a língua EN "por traduzir": o contador da barra aparece, o
 * Guardar bloqueia, "Ver onde" leva de campo em campo (abrindo página/bloco/componente e focando a
 * caixa) e, preenchido o último, o Guardar desbloqueia. A API é a autoridade (MISSING_TRANSLATION);
 * isto prova a UX que a antecede.
 */

test.use({ storageState: { cookies: [], origins: [] } });

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · traduções — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("texto só em PT bloqueia o Guardar; «Ver onde» preenche até desbloquear; grava e recarrega", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const [pg, bl] = [`Trad-${u}`, `BlTrad-${u}`];

      await p.createPage(pg, `trad-${u}`);
      await p.addStarter("Título e texto");
      await p.openItem("Título e texto");
      await p.renameBlock(bl);
      // Sem texto ainda, nada falta (campos vazios na base não pedem tradução).
      await expect(p.missingBtn).toHaveCount(0);
      await expect(p.saveBtn).toBeEnabled();

      await p.compHead(0).click();
      await page.getByRole("textbox", { name: "Texto (PT)" }).fill(`Titulo ${u}`);
      await p.compHead(1).click();
      await page.getByRole("textbox", { name: "Texto (PT)" }).fill(`Corpo ${u}`);

      // Duas línguas em falta (um campo cada): contador, selos e Guardar bloqueado.
      await expect(p.missingBtn).toHaveText(/^2 por traduzir · Ver onde$/);
      await expect(p.saveBtn).toBeDisabled();
      await expect(p.saveBtn).toHaveAttribute("title", "Completa as traduções em falta antes de guardar.");
      await expect(p.compHead(0)).toContainText("Falta EN");
      await expect(p.compHead(1)).toContainText("Falta EN");
      await expect(page.getByRole("textbox", { name: "Texto (EN)" })).toHaveAttribute("placeholder", "Por traduzir");
      // A lista também avisa (ponto amarelo no bloco).
      await p.showList();
      await expect(p.blockRow(bl).getByRole("img", { name: "Falta traduzir" })).toBeVisible();
      await p.openBlockFromLibrary(bl);

      // «Ver onde», campo a campo, até não faltar nenhum.
      const visited = await p.translateAll(`Traduzido ${u}`);
      expect(visited).toHaveLength(2);
      expect(visited.every((v) => v.locale === "en")).toBe(true);
      expect(visited.map((v) => v.path.replace(/comps\.[^.]+\./, "comps.<id>."))).toEqual(["comps.<id>.v.text", "comps.<id>.v.body"]);
      await expect(p.missingBtn).toHaveCount(0);
      await expect(p.saveBtn).toBeEnabled();
      await expect(p.compHead(1)).not.toContainText("Falta EN");

      await p.save();
      await p.reload();
      await p.openBlockFromLibrary(bl);
      await p.compHead(0).click();
      await expect(page.getByRole("textbox", { name: "Texto (EN)" })).toHaveValue(`Traduzido ${u} 1`);
      await expect(page.getByRole("textbox", { name: "Texto (PT)" })).toHaveValue(`Titulo ${u}`);
      await expect(p.missingBtn).toHaveCount(0);
    });

    test("«Ver onde» atravessa a página (SEO) e o bloco; desfazer faz a falta voltar", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const [pg, bl] = [`Trad2-${u}`, `BlTrad2-${u}`];

      await p.createPage(pg, `trad2-${u}`);
      await p.addStarter("Título e texto");
      await p.openItem("Título e texto");
      await p.renameBlock(bl);
      await p.compHead(0).click();
      await page.getByRole("textbox", { name: "Texto (PT)" }).fill(`Titulo ${u}`);
      await p.backToPage();

      // Título do Google só em PT (nas Definições e SEO da página).
      await p.openTab("Definições e SEO");
      await page.getByRole("textbox", { name: "Título no Google (PT)" }).fill(`SEO ${u}`);
      await expect(p.missingBtn).toHaveText(/^2 por traduzir · Ver onde$/);
      await expect(page.getByRole("textbox", { name: "Título no Google (EN)" })).toHaveAttribute("placeholder", "Por traduzir");

      // A página vem primeiro (entidades pela ordem: páginas, partes, blocos); depois o bloco, noutro editor.
      await p.missingBtn.click();
      await expect(page.getByRole("tab", { name: "Definições e SEO" })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("textbox", { name: "Título no Google (EN)" })).toBeFocused();
      await page.getByRole("textbox", { name: "Título no Google (EN)" }).fill(`SEO en ${u}`);
      await expect(p.missingBtn).toHaveText(/^1 por traduzir · Ver onde$/);
      await p.missingBtn.click();
      await expect(page.getByRole("heading", { level: 2, name: bl })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Texto (EN)" })).toBeFocused();
      await page.getByRole("textbox", { name: "Texto (EN)" }).fill(`Title en ${u}`);
      await expect(p.missingBtn).toHaveCount(0);

      // Desfazer a última tradução devolve a falta (o Guardar volta a bloquear).
      await page.locator("body").click({ position: { x: 1, y: 1 } }); // sai da caixa: Ctrl+Z não age dentro de campos de texto
      await p.undo();
      await expect(p.missingBtn).toHaveText(/^1 por traduzir · Ver onde$/);
      await expect(p.saveBtn).toBeDisabled();
      await p.redo();
      await expect(p.missingBtn).toHaveCount(0);
      await expect(p.saveBtn).toBeEnabled();
    });
  });
}
