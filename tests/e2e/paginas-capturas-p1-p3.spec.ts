import { test, expect, type Locator, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loginAs } from "./fixtures/login";
import { ADMIN, grantSupportAccess, openSupportTab } from "./fixtures/support";
import { patchSiteBuilder } from "./fixtures/siteBuilderRoute";
import { solidPng } from "./fixtures/png";
import { buildZip } from "../../../API-FullStack/tests/helpers/zip";
import { PaginasPage, VIEWPORTS, uniq } from "./pages/PaginasPage";

/**
 * Capturas do B38 P1–P3 para revisão a olho (arnês manual): Migrar site, Publicação (Coolify), barra de publicação,
 * imagem de partilha do site e «Ao partilhar» de uma página — a 1440, 834 e 390, em claro e escuro.
 *
 * Só corre com `CAPTURAS=1` (não escreve PNG na árvore em cada CI):
 *   CAPTURAS=1 pnpm exec playwright test paginas-capturas-p1-p3 --project=chromium
 * Grava em `Backoffice/.design/page-builder/capturas/p1-p3/<ecrã>-<largura>-<tema>.png`.
 * Além de capturar, falha se a página ou o modal tiver scroll horizontal (o que se vê a 390 não pode cortar).
 */

test.use({ storageState: { cookies: [], origins: [] } });

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.design/page-builder/capturas/p1-p3");
const MEDIA = "https://e2e-media.test";
const OWNER = "pages@e2e";
const SUPPORT_TENANT = "pagesB@e2e";
const THEMES = ["light", "dark"] as const;

/** Arnês manual: sem `CAPTURAS=1` os testes nem são registados (não há «skipped» a esconder nada). */
const CAPTURAR = !!process.env.CAPTURAS;

const okZip = (name: string) => ({
  name,
  mimeType: "application/zip",
  buffer: buildZip([{ name: "manifest.json", data: Buffer.from("{}") }, { name: "content.json", data: Buffer.from("{}") }]),
});
const dry = (existing = { pages: 0, blocks: 0 }) => ({
  dryRun: true,
  summary: {
    pages: 9,
    blocks: 45,
    folders: 0,
    languages: ["pt", "en", "fr"],
    files: [
      { name: "logo-winterplateau-horizontal-fundo-claro-2024.png", kind: "image", bytes: 12_700 },
      { name: "ficha-tecnica-isolamento-termico.pdf", kind: "pdf", bytes: 3_400_000 },
      { name: "hero.jpg", kind: "image", bytes: 880_000 },
    ],
  },
  existing,
  warnings: existing.pages ? ["Vai substituir o conteúdo existente: 2 páginas, 5 blocos e 0 pastas."] : ["media/nao-usado.pdf não é usado no conteúdo e não foi carregado."],
});

async function noHScroll(page: Page, dialog?: Locator): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "scroll horizontal na página").toBeLessThanOrEqual(1);
  if (dialog) expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth), "scroll horizontal no modal").toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string, w: number, theme: string, target?: Locator): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  if (target) await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}-${w}-${theme}.png`) });
}

async function themed(page: Page, theme: string): Promise<void> {
  await expect(page.locator("html")).toHaveClass(theme === "dark" ? /(^|\s)dark(\s|$)/ : /^(?!.*\bdark\b).*$/);
}

for (const vp of CAPTURAR ? VIEWPORTS : []) {
  for (const theme of THEMES) {
    test.describe(`Capturas P1–P3 — ${vp.label} · ${theme}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, colorScheme: theme });

      test("migrar site e publicação (sessão de suporte)", async ({ context, request }) => {
        test.setTimeout(120_000);
        await context.addInitScript((t) => window.localStorage.setItem("bo.theme", t), theme);
        const { userId } = await grantSupportAccess(request, SUPPORT_TENANT);
        await loginAs(context, ADMIN);
        const support = await openSupportTab(context, userId);
        await support.addInitScript(() => {
          const style = document.createElement("style");
          style.textContent = "[data-sonner-toaster], [data-sonner-toast] { pointer-events: none !important; }";
          document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
        });
        const sp = new PaginasPage(support, context, ADMIN);
        let existing = { pages: 0, blocks: 0 };
        // O zip inválido (sem content.json) vai à API real (422); os outros recebem o dry-run simulado.
        await support.route("**/cms/site-builder/support/import", (route) =>
          route.request().postDataBuffer()?.includes("content.json")
            ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dry(existing)) })
            : route.continue(),
        );
        try {
          await sp.gotoInSession();
          await themed(support, theme);
          const dialog = await sp.openSettings();
          const imp = dialog.getByTestId("import-section");
          await expect(imp).toBeVisible({ timeout: 10_000 });

          // P1 · inicial
          await shot(support, "p1-migrar-inicial", vp.width, theme, imp);
          await noHScroll(support, dialog);
          // zip inválido (API real)
          await dialog.getByTestId("import-file").setInputFiles({ name: "partido-sem-content.zip", mimeType: "application/zip", buffer: buildZip([{ name: "manifest.json", data: Buffer.from("{}") }]) });
          await expect(dialog.getByTestId("import-issues")).toBeVisible({ timeout: 10_000 });
          await shot(support, "p1-migrar-invalido", vp.width, theme, imp);
          await noHScroll(support, dialog);
          // resumo (sem conteúdo)
          await dialog.getByTestId("import-file").setInputFiles(okZip("winterplateau-site-completo-2024.zip"));
          await expect(dialog.getByTestId("import-summary")).toBeVisible({ timeout: 10_000 });
          await shot(support, "p1-migrar-resumo", vp.width, theme, imp);
          await noHScroll(support, dialog);
          // com conteúdo existente
          existing = { pages: 2, blocks: 5 };
          await dialog.getByTestId("import-file").setInputFiles(okZip("winterplateau-site-completo-2024.zip"));
          await expect(dialog.getByTestId("import-existing-warning")).toBeVisible({ timeout: 10_000 });
          await shot(support, "p1-migrar-conteudo-existente", vp.width, theme, dialog.getByTestId("import-existing-warning"));
          await dialog.getByTestId("import-confirm-replace").check();
          await shot(support, "p1-migrar-confirmado", vp.width, theme, dialog.getByTestId("import-submit"));
          await noHScroll(support, dialog);

          // P2 · Publicação (Coolify)
          const pub = dialog.getByTestId("publish-section");
          const off = dialog.getByTestId("publish-off");
          if (await off.count()) {
            await off.click();
            await expect(off).toHaveCount(0);
          }
          await shot(support, "p2-publicacao-por-configurar", vp.width, theme, pub);
          await dialog.getByTestId("publish-webhook").fill("https://example.com/nao-e-webhook");
          await dialog.getByTestId("publish-save").click();
          await expect(dialog.getByRole("alert").filter({ hasText: "webhook de deploy" })).toBeVisible();
          await shot(support, "p2-publicacao-webhook-invalido", vp.width, theme, pub);
          await dialog.getByTestId("publish-webhook").fill("https://coolify.exemplo.pt/api/v1/deploy?uuid=abcd1234&force=true");
          await dialog.getByTestId("publish-save").click();
          await expect(dialog.getByTestId("publish-current")).toBeVisible();
          await dialog.getByTestId("publish-test").click();
          await expect(dialog.getByTestId("publish-test-result")).toBeVisible();
          await shot(support, "p2-publicacao-configurada-teste", vp.width, theme, dialog.getByTestId("publish-test-result"));
          await noHScroll(support, dialog);
          await dialog.getByTestId("publish-off").click();
          await expect(dialog.getByTestId("publish-off")).toHaveCount(0);
        } finally {
          await support.close();
        }
      });

      test("barra de publicação e imagem de partilha (cliente)", async ({ page, context }) => {
        test.setTimeout(120_000);
        await context.addInitScript((t) => window.localStorage.setItem("bo.theme", t), theme);
        await page.route(/\/uploads$/, async (route) => {
          const name = /filename="([^"]+)"/.exec(route.request().postDataBuffer()?.toString("latin1") ?? "")?.[1] ?? "imagem.png";
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ fileUrl: `${MEDIA}/tenant/${name}` }) });
        });
        await page.route(`${MEDIA}/**`, (route) => {
          const small = route.request().url().endsWith("pequena.png");
          return route.fulfill({ status: 200, contentType: "image/png", body: solidPng(small ? 300 : 1200, small ? 200 : 630, [40, 90, 160]) });
        });
        const p = new PaginasPage(page, context, OWNER);
        await p.open();
        await themed(page, theme);
        const forced = await patchSiteBuilder(page);
        const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
        const pub = (o: Record<string, unknown>) => ({ publish: { mode: "coolify", status: "idle", phase: null, startedAt: null, estimatedMs: null, liveRevision: null, requestedAt: null, liveAt: null, error: null, ...o } });

        // P2 · barra
        forced.patch = pub({ status: "running", phase: "building", startedAt: ago(30_000), estimatedMs: 60_000 });
        await p.reload();
        await expect(page.getByTestId("publish-bar")).toBeVisible();
        await shot(page, "p2-barra-a-construir", vp.width, theme);
        await noHScroll(page);
        forced.patch = pub({ status: "pending" });
        await p.reload();
        await shot(page, "p2-barra-em-fila", vp.width, theme);
        forced.patch = pub({ status: "failed", error: "O build falhou: npm ERR! code ELIFECYCLE — exit code 1 (veja os registos da aplicação no Coolify para o detalhe completo)" });
        await p.reload();
        await expect(page.getByTestId("publish-bar")).toHaveAttribute("data-kind", "failed");
        await shot(page, "p2-barra-falhou", vp.width, theme);
        await noHScroll(page);
        forced.patch = pub({ status: "running", phase: "confirming", startedAt: ago(10 * 60_000), estimatedMs: 60_000 });
        await p.reload();
        forced.patch = pub({ status: "live", liveAt: new Date().toISOString() });
        await expect(page.getByTestId("publish-bar")).toHaveAttribute("data-kind", "live", { timeout: 20_000 });
        await shot(page, "p2-barra-no-ar", vp.width, theme);
        forced.patch = null;

        // P3 · imagem de partilha do site
        await p.reload();
        const dialog = await p.openSettings();
        const section = dialog.getByTestId("share-image-section");
        await shot(page, "p3-imagem-site-vazia", vp.width, theme, section);
        await section.getByTestId("share-image-file").setInputFiles({ name: "ideal.png", mimeType: "image/png", buffer: solidPng(1200, 630, [40, 90, 160]) });
        await expect(section.getByTestId("share-card-facebook").locator("img")).toBeVisible();
        await section.getByRole("textbox", { name: /· PT$/ }).fill("Fachada do edifício ao pôr do sol");
        await shot(page, "p3-imagem-site-facebook", vp.width, theme, section.getByTestId("share-image-save"));
        await section.getByTestId("share-preview").getByRole("button", { name: "X", exact: true }).click();
        await shot(page, "p3-imagem-site-x", vp.width, theme, section.getByTestId("share-image-save"));
        await section.getByTestId("share-image-file").setInputFiles({ name: "pequena.png", mimeType: "image/png", buffer: solidPng(300, 200) });
        await expect(section.getByTestId("share-size-warning")).toBeVisible();
        await shot(page, "p3-imagem-site-aviso", vp.width, theme, section.getByTestId("share-image-save"));
        await noHScroll(page, dialog);
        await p.closeSettings();

        // P3 · página: «Ao partilhar»
        forced.patch = { shareImage: `${MEDIA}/tenant/ideal.png`, shareImageAlt: { pt: "Alt do site", en: "Site alt" } };
        await p.reload();
        await p.createPage(`Social-${uniq()}`);
        await p.openTab("Definições e SEO");
        const preview = page.getByTestId("share-preview");
        await expect(preview.getByTestId("share-card-facebook").locator("img")).toBeVisible();
        await shot(page, "p3-pagina-imagem-do-site", vp.width, theme, preview);
        await page.getByRole("group", { name: "Imagem ao partilhar" }).getByLabel("Ficheiro de Imagem ao partilhar").setInputFiles({ name: "pequena.png", mimeType: "image/png", buffer: solidPng(300, 200) });
        await expect(preview.getByTestId("share-size-warning")).toBeVisible();
        await shot(page, "p3-pagina-imagem-propria-aviso", vp.width, theme, preview);
        await page.getByRole("button", { name: "Remover imagem" }).click();
        forced.patch = { shareImage: null, shareImageAlt: null };
        await noHScroll(page);
      });
    });
  }
}
