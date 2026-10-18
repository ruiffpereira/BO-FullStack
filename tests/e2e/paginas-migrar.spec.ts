import { test, expect, type Locator, type Route } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { API, loginAs } from "./fixtures/login";
import { ADMIN, apiLogin, grantSupportAccess, openSupportTab } from "./fixtures/support";
import { PaginasPage, VIEWPORTS, uniq } from "./pages/PaginasPage";
import { buildZip } from "../../../API-FullStack/tests/helpers/zip";

/**
 * B38 · P1 — «Migrar site» (zip) em Páginas → Definições do site, só numa sessão de suporte («Entrar como»).
 *
 * Duas camadas, ditas com honestidade:
 *  - REAIS (API de teste): a secção não existe fora de suporte e a API recusa a rota (403 SUPPORT_SESSION_REQUIRED);
 *    um zip inválido (falta o `content.json`) mostra a lista de problemas que a API devolve (422).
 *  - SIMULADAS (`page.route` no `POST …/support/import`): o caminho feliz. A API de e2e não tem armazenamento de
 *    ficheiros (`SEAWEEDFS_*` vazio → 503 mesmo no dry-run), por isso a resposta do dry-run/apply é forjada com o
 *    contrato real (`ImportSiteZip200`); o que se prova é a UI — "A verificar…", resumo, confirmação de substituição,
 *    os campos que seguem no multipart (`mode`, `replace`), o toast e o recarregamento do editor. No apply simulado
 *    o handler grava uma página nova pela API REAL (`/cms/site-builder/save`), para o "o editor recarrega com as
 *    páginas" ser verificado contra dados verdadeiros. A importação a sério está nos testes da API.
 *
 * `pagesB@e2e` serve a sessão de suporte (mesmo tenant das definições); cada teste usa nomes únicos.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const TENANT = "pages@e2e";
const SUPPORT_TENANT = "pagesB@e2e";
const IMPORT_URL = "**/cms/site-builder/support/import";

const importSection = (dialog: Locator) => dialog.getByTestId("import-section");
const fileInput = (dialog: Locator) => dialog.getByTestId("import-file");
const submit = (dialog: Locator) => dialog.getByTestId("import-submit");

/** Valores do multipart (`mode`, `replace`) do pedido interceptado. */
function formFields(route: Route): Record<string, string> {
  const body = route.request().postDataBuffer()?.toString("latin1") ?? "";
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/name="([a-z]+)"\r\n\r\n([^\r\n]*)\r\n/g)) out[m[1]] = m[2];
  return out;
}

const okZip = (name = "site.zip") => ({
  name,
  mimeType: "application/zip",
  buffer: buildZip([{ name: "manifest.json", data: Buffer.from("{}") }, { name: "content.json", data: Buffer.from("{}") }]),
});

const result = (over: Partial<{ dryRun: boolean; existing: { pages: number; blocks: number }; warnings: string[] }> = {}) => ({
  dryRun: over.dryRun ?? true,
  summary: {
    pages: 9,
    blocks: 45,
    folders: 0,
    languages: ["pt", "en", "fr"],
    files: [
      { name: "logo-winterplateau.png", kind: "image", bytes: 12_700 },
      { name: "ficha-tecnica.pdf", kind: "pdf", bytes: 3_400_000 },
    ],
  },
  existing: over.existing ?? { pages: 0, blocks: 0 },
  warnings: over.warnings ?? [],
});

/** Sessão de suporte aberta no tenant `pagesB` com o editor pronto. */
async function supportEditor(context: Parameters<typeof openSupportTab>[0], request: Parameters<typeof grantSupportAccess>[0]) {
  const { userId } = await grantSupportAccess(request, SUPPORT_TENANT);
  await loginAs(context, ADMIN);
  const support = await openSupportTab(context, userId);
  await support.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "[data-sonner-toaster], [data-sonner-toast] { pointer-events: none !important; }";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
  });
  const sp = new PaginasPage(support, context, ADMIN);
  await sp.gotoInSession();
  return { support, sp };
}

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · migrar site — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("fora de uma sessão de suporte a secção não existe e a API recusa a rota", async ({ page, context, request }) => {
      const p = new PaginasPage(page, context, TENANT);
      await p.open();
      const dialog = await p.openSettings();
      await expect(importSection(dialog)).toHaveCount(0);
      await expect(dialog.getByRole("region", { name: "Migrar site" })).toHaveCount(0);
      await expect(fileInput(dialog)).toHaveCount(0);
      await p.closeSettings();

      const { headers } = await apiLogin(request, TENANT);
      const res = await request.post(`${API}/cms/site-builder/support/import`, {
        headers,
        multipart: { mode: "dry-run", file: okZip() },
      });
      expect(res.status()).toBe(403);
      expect(JSON.stringify(await res.json())).toContain("SUPPORT_SESSION_REQUIRED");
    });

    test("ficheiro que não é .zip e zip inválido (API real): «A verificar…» e a lista de problemas; nada a importar", async ({ context, request }) => {
      const { support, sp } = await supportEditor(context, request);
      try {
        const dialog = await sp.openSettings();
        await expect(importSection(dialog)).toBeVisible({ timeout: 10_000 });
        await expect(submit(dialog)).toBeDisabled();

        // Extensão errada: recusado no cliente, sem pedido.
        let asked = 0;
        await support.route(IMPORT_URL, async (route) => {
          asked++;
          await new Promise((r) => setTimeout(r, 700)); // dá tempo de ver «A verificar…»
          await route.continue();
        });
        await fileInput(dialog).setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("olá") });
        await expect(dialog.getByTestId("import-error")).toContainText("O ficheiro tem de ser um .zip.");
        expect(asked).toBe(0);
        await expect(submit(dialog)).toBeDisabled();

        // Zip sem `content.json`: a API real devolve 422 com a lista de problemas.
        await fileInput(dialog).setInputFiles({
          name: "partido.zip",
          mimeType: "application/zip",
          buffer: buildZip([{ name: "manifest.json", data: Buffer.from("{}") }]),
        });
        await expect(dialog.getByTestId("import-checking")).toHaveText("A verificar…");
        const issues = dialog.getByTestId("import-issues");
        await expect(issues).toBeVisible({ timeout: 10_000 });
        await expect(issues).toContainText("O zip não é válido");
        await expect(issues).toContainText(/content\.json/);
        await expect(issues.getByRole("listitem").first()).toBeVisible();
        await expect(dialog.getByTestId("import-checking")).toHaveCount(0);
        await expect(dialog.getByTestId("import-result")).toHaveCount(0);
        await expect(submit(dialog)).toBeDisabled();
        expect(asked).toBe(1);
        // Sem scroll horizontal no modal (a lista parte linhas compridas).
        const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);

        // «Limpar» volta ao início.
        await dialog.getByRole("button", { name: "Limpar" }).click();
        await expect(issues).toHaveCount(0);
        await expect(submit(dialog)).toBeDisabled();
      } finally {
        await support.close();
      }
    });

    test("site sem conteúdo (simulado): resumo, Importar activo sem confirmação, toast e o editor recarrega com a página", async ({ context, request }) => {
      const { support, sp } = await supportEditor(context, request);
      const title = `Migrada ${uniq()}`;
      const fields: Record<string, string>[] = [];
      try {
        await support.route(IMPORT_URL, async (route) => {
          const f = formFields(route);
          fields.push(f);
          if (f.mode === "dry-run") {
            await new Promise((r) => setTimeout(r, 500));
            return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result({ warnings: ["media/nao-usado.pdf não é usado no conteúdo e não foi carregado."] })) });
          }
          // «Apply» simulado: grava uma página a sério (mesmo token da sessão de suporte) para o recarregamento ter dados.
          const headers = { Authorization: route.request().headers()["authorization"] };
          const state = await (await request.get(`${API}/cms/site-builder`, { headers })).json();
          const hasHome = ((state.pages ?? []) as { isHome?: boolean }[]).some((x) => x.isHome); // a 1.ª página é sempre a home
          const saved = await request.post(`${API}/cms/site-builder/save`, {
            headers,
            data: { baseRevision: state.revision, pages: { upsert: [{ id: randomUUID(), ...(hasHome ? { slug: `migrada-${uniq()}` } : { slug: "", isHome: true }), title: { pt: title, en: title } }] } },
          });
          expect(saved.status(), await saved.text()).toBe(200);
          const r = result({ dryRun: false });
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r) });
        });

        const dialog = await sp.openSettings();
        const longName = `winterplateau-${"muito-comprido-".repeat(6)}site.zip`; // um nome gigante não pode alargar o modal
        await fileInput(dialog).setInputFiles(okZip(longName));
        await expect(dialog.getByTestId("import-checking")).toBeVisible();

        const summary = dialog.getByTestId("import-summary");
        await expect(summary).toBeVisible({ timeout: 10_000 });
        await expect(summary).toContainText("9 páginas · 45 blocos · 0 pastas");
        await expect(summary).toContainText("Línguas: PT · EN · FR");
        await expect(summary).toContainText("2 ficheiros");
        const files = dialog.getByTestId("import-files");
        await expect(files).toContainText("logo-winterplateau.png");
        await expect(files).toContainText("Imagem · 12,4 KB");
        await expect(files).toContainText("PDF · 3,2 MB");
        await expect(dialog.getByTestId("import-warnings")).toContainText("nao-usado.pdf");
        await expect(dialog.getByTestId("import-existing-warning")).toHaveCount(0);
        await expect(dialog).toContainText(`${longName} · `);
        // Nenhum scroll horizontal no modal.
        expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);

        // Site sem nada: não pede confirmação.
        await expect(submit(dialog)).toBeEnabled();
        await submit(dialog).click();

        await expect(support.getByText("Site importado: 9 páginas, 45 blocos, 2 ficheiros")).toBeVisible({ timeout: 15_000 });
        expect(fields.map((f) => f.mode)).toEqual(["dry-run", "apply"]);
        expect(fields[1]).not.toHaveProperty("replace"); // sem conteúdo, nada a substituir
        // A secção volta ao início e o editor recarregou com a página gravada.
        await expect(dialog.getByTestId("import-result")).toHaveCount(0);
        await expect(submit(dialog)).toBeDisabled();
        await sp.closeSettings();
        await sp.showList();
        await expect(sp.pageRow(title)).toBeVisible({ timeout: 15_000 });
      } finally {
        await support.close();
      }
    });

    test("site com conteúdo (simulado): pede confirmação, Importar só activa com ela e segue replace=true", async ({ context, request }) => {
      const { support, sp } = await supportEditor(context, request);
      const fields: Record<string, string>[] = [];
      try {
        await support.route(IMPORT_URL, async (route) => {
          const f = formFields(route);
          fields.push(f);
          const apply = f.mode === "apply";
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(result({ dryRun: !apply, existing: { pages: 2, blocks: 5 }, warnings: ["Vai substituir o conteúdo existente: 2 páginas, 5 blocos e 0 pastas."] })),
          });
        });
        const dialog = await sp.openSettings();
        await fileInput(dialog).setInputFiles(okZip());

        const warn = dialog.getByTestId("import-existing-warning");
        await expect(warn).toBeVisible({ timeout: 10_000 });
        await expect(warn).toContainText("Este site já tem conteúdo (2 páginas, 5 blocos). Importar substitui tudo.");
        const confirm = dialog.getByTestId("import-confirm-replace");
        await expect(confirm).not.toBeChecked();
        await expect(submit(dialog)).toBeDisabled();

        await confirm.check();
        await expect(submit(dialog)).toBeEnabled();
        await confirm.uncheck();
        await expect(submit(dialog)).toBeDisabled();
        await confirm.check();
        await submit(dialog).click();

        await expect(support.getByText(/^Site importado: 9 páginas, 45 blocos, 2 ficheiros$/)).toBeVisible({ timeout: 15_000 });
        expect(fields.map((f) => f.mode)).toEqual(["dry-run", "apply"]);
        expect(fields[1].replace).toBe("true");
        // Escolher outro ficheiro volta a desmarcar a confirmação.
        await fileInput(dialog).setInputFiles(okZip("outro.zip"));
        await expect(warn).toBeVisible({ timeout: 10_000 });
        await expect(dialog.getByTestId("import-confirm-replace")).not.toBeChecked();
        await expect(submit(dialog)).toBeDisabled();
      } finally {
        await support.close();
      }
    });

    test("a importação falha (simulado 422): mostra a lista de problemas e não há toast de sucesso", async ({ context, request }) => {
      const { support, sp } = await supportEditor(context, request);
      try {
        await support.route(IMPORT_URL, async (route) => {
          if (formFields(route).mode === "dry-run") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result()) });
          return route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({ code: "VALIDATION", issues: [{ code: "BAD_MEDIA_FILE", path: "media/logo.png", message: "imagem corrompida" }, { code: "X", message: "segundo problema" }] }),
          });
        });
        const dialog = await sp.openSettings();
        await fileInput(dialog).setInputFiles(okZip());
        await expect(submit(dialog)).toBeEnabled({ timeout: 10_000 });
        await submit(dialog).click();
        const issues = dialog.getByTestId("import-issues");
        await expect(issues).toContainText("Não foi possível importar (2 problemas):");
        await expect(issues).toContainText("media/logo.png: imagem corrompida");
        await expect(issues).toContainText("segundo problema");
        await expect(support.getByText(/Site importado/)).toHaveCount(0);
        // O resumo fica (dá para tentar de novo) e o botão volta a estar disponível.
        await expect(dialog.getByTestId("import-summary")).toBeVisible();
        await expect(submit(dialog)).toBeEnabled();
      } finally {
        await support.close();
      }
    });

    test("com alterações por guardar nas páginas o Importar fica desligado, com a explicação", async ({ context, request }) => {
      const { support, sp } = await supportEditor(context, request);
      try {
        await support.route(IMPORT_URL, (route) =>
          route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result()) }),
        );
        await sp.createPage(`Pendente ${uniq()}`); // página nova por guardar
        await expect(sp.saveBtn).toBeEnabled();
        const dialog = await sp.openSettings();
        await fileInput(dialog).setInputFiles(okZip());
        await expect(dialog.getByTestId("import-summary")).toBeVisible({ timeout: 10_000 });
        await expect(dialog).toContainText("Guarda primeiro as alterações às páginas.");
        await expect(submit(dialog)).toBeDisabled();
      } finally {
        // Descarta o rascunho para o fecho do separador não ser travado por `beforeunload`.
        await support.close({ runBeforeUnload: false });
      }
    });
  });
}
