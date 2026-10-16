import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { randomUUID } from "node:crypto";
import { withSessionRetry } from "./fixtures/session";
import { AdminPage } from "./pages/AdminPage";
import { PaginasPage, VIEWPORTS, uniq } from "./pages/PaginasPage";

/**
 * Admin → Utilizadores → «Construtor de páginas» (F16, CONTRATO §5.4) nas três larguras: o admin
 * (`admin@e2e`) abre o modal de um tenant (`pagesgate@e2e`, semeado SEM a permissão VIEW_SITE_PAGES), vê o
 * estado derivado («Inactivo», sem botões Activar/Desactivar — o construtor já não tem interruptor), tenta
 * manifests inválidos (JSON partido; manifest que a API recusa → erros legíveis) e carrega o da
 * Winterplateau (ficheiro). O token do GitHub é só de escrita. O tenant é só deste spec e o fluxo é
 * idempotente.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const TENANT = "pagesgate@e2e";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.resolve(HERE, "../../../API-FullStack/tests/fixtures/manifest-winterplateau.json");

/** Autentica o admin e abre Admin → Utilizadores (a tabela já carregada). */
async function openAdmin(page: Page, context: BrowserContext): Promise<void> {
  await loginAs(context, "admin@e2e");
  await withSessionRetry(page, context, "admin@e2e", () => page.goto("/admin"), async () => {
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Eliminar" }).first()).toBeVisible({ timeout: 15_000 });
  });
}

async function openBuilderModal(page: Page, admin: AdminPage, tenant: string = TENANT) {
  const row = await admin.userRowFromStart(tenant);
  await row.getByRole("button", { name: "Construtor de páginas" }).click();
  const dialog = page.getByRole("dialog", { name: "Construtor de páginas" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Estado" })).toBeVisible({ timeout: 10_000 });
  return dialog;
}

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · admin — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("o admin vê o estado derivado da permissão (sem botões) e carrega o manifest (erros legíveis nos inválidos)", async ({ page, context }) => {
      const admin = new AdminPage(page);
      await openAdmin(page, context);

      const dialog = await openBuilderModal(page, admin);
      await expect(dialog).toContainText(TENANT);
      const estado = dialog.getByRole("region", { name: "Estado" });

      // Sem interruptor: o estado é derivado da permissão. `pagesgate@e2e` não tem VIEW_SITE_PAGES → «Inactivo».
      await expect(estado.getByText("Inactivo", { exact: true })).toBeVisible();
      await expect(estado.getByText("Activo", { exact: true })).toHaveCount(0);
      await expect(estado).toContainText("Para activar, dá VIEW_SITE_PAGES à role do tenant em Admin → Permissões");
      await expect(estado.getByRole("button")).toHaveCount(0); // nem Activar nem Desactivar
      await expect(page.getByRole("dialog", { name: "Desactivar o construtor?" })).toHaveCount(0);
      // O lembrete leva ao sítio onde se dá a permissão.
      await expect(estado.getByRole("link", { name: "Admin → Permissões" })).toHaveAttribute("href", "/admin/permissoes");

      // Manifest: texto que nem é JSON → erro de parse, sem pedido à API.
      const manifest = dialog.getByRole("region", { name: "Manifest" });
      const area = manifest.getByRole("textbox", { name: "Manifest (JSON)" });
      const carregar = manifest.getByRole("button", { name: "Carregar manifest" });
      await expect(carregar).toBeDisabled();
      await area.fill("{ isto não é json");
      await carregar.click();
      await expect(manifest.getByRole("alert")).toContainText("O texto não é JSON válido");

      // JSON válido mas que a API recusa (falta `backgrounds`): os problemas aparecem em lista.
      await area.fill(JSON.stringify({ version: 1, styles: {} }));
      await carregar.click();
      await expect(manifest.getByRole("alert")).toContainText("O manifest não é válido");
      await expect(manifest.getByRole("alert").getByRole("listitem").first()).toBeVisible();
      await expect(manifest.getByRole("alert")).toContainText("backgrounds");
      // Mexer no texto limpa o aviso.
      await area.fill("{}");
      await expect(manifest.getByRole("alert")).toHaveCount(0);

      // O da Winterplateau, por ficheiro.
      await manifest.getByLabel("Ficheiro do manifest").setInputFiles(MANIFEST);
      await expect(area).toHaveValue(/"edificio3d"/);
      await carregar.click();
      // (a ordem dos especiais é a que o MySQL devolve nas chaves do JSON)
      await expect(manifest).toContainText(/Carregado: versão 1, 5 tipos com estilos, 3 fundos, 2 ícones, 2 especiais \((edificio3d, faixa|faixa, edificio3d)\)\./);
      await expect(area).toHaveValue("");

      // Fechar e abrir de novo: o resumo veio da API, não do estado local.
      await page.keyboard.press("Escape"); // (o Modal fecha com Esc)
      await expect(dialog).toHaveCount(0);
      const again = await openBuilderModal(page, admin);
      // (continua inactivo: carregar o manifest não liga o construtor, só a permissão o faz)
      await expect(again.getByRole("region", { name: "Estado" }).getByText("Inactivo", { exact: true })).toBeVisible();
      await expect(again.getByRole("region", { name: "Manifest" })).toContainText(/2 especiais \((edificio3d, faixa|faixa, edificio3d)\)/);
    });

    test("estado «Activo» quando o tenant tem VIEW_SITE_PAGES (pages@e2e): texto derivado e sem botões", async ({ page, context }) => {
      const admin = new AdminPage(page);
      await openAdmin(page, context);
      const dialog = await openBuilderModal(page, admin, "pages@e2e");
      const estado = dialog.getByRole("region", { name: "Estado" });
      await expect(estado.getByText("Activo", { exact: true })).toBeVisible();
      await expect(estado.getByText("Inactivo", { exact: true })).toHaveCount(0);
      await expect(estado).toContainText("Activo porque a role do tenant tem VIEW_SITE_PAGES");
      await expect(estado.getByRole("button")).toHaveCount(0);
      await expect(estado.getByRole("link", { name: "Admin → Permissões" })).toHaveAttribute("href", "/admin/permissoes");
    });

    test("publicação: modo GitHub pede repo, workflow e ref; o token é só de escrita; volta a «runtime»", async ({ page, context }) => {
      const admin = new AdminPage(page);
      await openAdmin(page, context);
      const dialog = await openBuilderModal(page, admin);
      const pub = dialog.getByRole("region", { name: "Publicação" });
      const guardar = pub.getByRole("button", { name: "Guardar publicação" });
      const testar = pub.getByRole("button", { name: "Testar" });

      // Em runtime não há mais nada para preencher.
      await expect(pub.getByRole("combobox", { name: "Modo" })).toHaveValue("runtime");
      await expect(pub.getByRole("textbox", { name: "Repositório", exact: true })).toHaveCount(0);
      await expect(guardar).toBeDisabled();
      await expect(testar).toBeDisabled();

      await pub.getByRole("combobox", { name: "Modo" }).selectOption("github");
      await pub.getByRole("textbox", { name: "Repositório", exact: true }).fill("dono/repo-e2e");
      await pub.getByRole("textbox", { name: "Workflow", exact: true }).fill("deploy.yml");
      await pub.getByRole("textbox", { name: "Ref (branch)", exact: true }).fill("main");
      const token = pub.getByRole("textbox", { name: /^Token do GitHub/ });
      await expect(token).toHaveAttribute("type", "password");
      await expect(token).toHaveValue("");
      await token.fill("github_pat_e2e_0123456789");
      await guardar.click();
      await expect(page.getByText("Publicação guardada")).toBeVisible();

      // Depois de guardado o token nunca volta: o campo fica vazio e só diz «definido».
      await expect(pub.getByRole("textbox", { name: /Token do GitHub — definido/ })).toHaveValue("");
      await expect(pub.getByRole("textbox", { name: "Repositório", exact: true })).toHaveValue("dono/repo-e2e");
      await expect(guardar).toBeDisabled(); // sem alterações
      await expect(testar).toBeEnabled(); // (não se carrega: falaria com o GitHub)

      // Volta a «runtime» (deixa o tenant como estava para os outros testes).
      await pub.getByRole("combobox", { name: "Modo" }).selectOption("runtime");
      await guardar.click();
      await expect(pub.getByRole("textbox", { name: "Repositório", exact: true })).toHaveCount(0);
      await expect(guardar).toBeDisabled();
    });

    test("nome do site: o admin define-o, persiste ao reabrir, aparece no «· nome» do Google do tenant e apagar volta a vazio", async ({ page, context, browser }) => {
      const SITE = "pages@e2e";
      const NAME = `Marca E2E ${Date.now().toString(36).slice(-4)}`;
      const admin = new AdminPage(page);
      await openAdmin(page, context);

      /** O campo «Nome» e o botão da secção «Nome do site» do modal. */
      const nameSection = (dialog: ReturnType<Page["locator"]>) => dialog.getByRole("region", { name: "Nome do site" });
      const reopen = async () => {
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog", { name: "Construtor de páginas" })).toHaveCount(0);
        return openBuilderModal(page, admin, SITE);
      };

      let dialog = await openBuilderModal(page, admin, SITE);
      let section = nameSection(dialog);
      const input = (s: typeof section) => s.getByRole("textbox", { name: "Nome", exact: true });
      const guardar = (s: typeof section) => s.getByRole("button", { name: "Guardar nome" });

      // Estado inicial limpo (uma corrida anterior pode ter deixado um nome): apaga-o se existir.
      if ((await input(section).inputValue()) !== "") {
        await input(section).fill("");
        await guardar(section).click();
        await expect(page.getByText("Nome do site guardado")).toBeVisible();
        await expect(guardar(section)).toBeDisabled();
      }
      await expect(input(section)).toHaveValue("");
      await expect(guardar(section)).toBeDisabled(); // sem alterações

      let pagesCtx: Awaited<ReturnType<typeof browser.newContext>> | undefined;
      try {
        // Define (com espaços à volta: a API recebe-o aparado).
        await input(section).fill(`  ${NAME}  `);
        await expect(guardar(section)).toBeEnabled();
        await guardar(section).click();
        await expect(page.getByText("Nome do site guardado")).toBeVisible();
        await expect(input(section)).toHaveValue(NAME);
        await expect(guardar(section)).toBeDisabled();

        // Persiste: fechar e abrir de novo traz o valor da API.
        dialog = await reopen();
        section = nameSection(dialog);
        await expect(input(section)).toHaveValue(NAME);
        await expect(guardar(section)).toBeDisabled();

        // O tenant (outra sessão, o próprio browser) vê-o no fim do título da pré-visualização do Google.
        pagesCtx = await browser.newContext({ baseURL: "http://localhost:5273", viewport: { width: vp.width, height: vp.height }, storageState: { cookies: [], origins: [] } });
        const tp = await pagesCtx.newPage();
        const p = new PaginasPage(tp, pagesCtx);
        await p.open();
        const pg = `Nome-${uniq()}`;
        await p.createPage(pg);
        await p.openTab("Definições e SEO");
        const serp = tp.getByRole("region", { name: "Google (SEO)" }).getByTestId("serp");
        await expect(serp).toBeVisible();
        await expect(serp.getByText(new RegExp(` · ${NAME}$`))).toBeVisible();
        await expect(serp.locator("b")).toHaveText(NAME); // o nome por cima do endereço
        // Guarda: o estado passa a «No ar · hh:mm» (vem de `publish.liveAt`).
        await p.save();
        await expect(p.status).toHaveText(/No ar · \d{2}:\d{2}/);

        // (O selo «No ar · data» da Publicação só existe com publishStatus=live, i.e. modo GitHub — não testável sem o GitHub.)
        dialog = await reopen();

        // Apagar volta a vazio (e persiste vazio).
        section = nameSection(dialog);
        await input(section).fill("");
        await guardar(section).click();
        await expect(page.getByText("Nome do site guardado")).toBeVisible();
        await expect(input(section)).toHaveValue("");
        await expect(guardar(section)).toBeDisabled();
        dialog = await reopen();
        await expect(input(nameSection(dialog))).toHaveValue("");
      } finally {
        await pagesCtx?.close();
        // Repõe o estado (nome a null) mesmo se o teste falhou a meio.
        try {
          const d = page.getByRole("dialog", { name: "Construtor de páginas" });
          if ((await d.count()) === 0) await openBuilderModal(page, admin, SITE);
          const s = nameSection(page.getByRole("dialog", { name: "Construtor de páginas" }));
          if ((await input(s).inputValue()) !== "") {
            await input(s).fill("");
            await guardar(s).click();
            await expect(guardar(s)).toBeDisabled();
          }
        } catch {
          /* melhor esforço: o erro que interessa é o do teste */
        }
      }
    });

    test("manifest que tira um fundo em uso:409 com a lista do que está em uso e nada é gravado", async ({ page, context, request }) => {
      // O tenant `pages@e2e` passa a ter um bloco com o fundo «marca» (pela API, com o token dele).
      const login = await request.post(`${API}/users/login`, {
        data: { username: "pages@e2e", password: E2E_PASSWORD },
        headers: { "CF-Connecting-IP": nextClientIp() },
      });
      const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };
      const state = await (await request.get(`${API}/cms/site-builder`, { headers })).json();
      const saved = await request.post(`${API}/cms/site-builder/save`, {
        headers,
        data: {
          baseRevision: state.revision,
          blocks: { upsert: [{ id: randomUUID(), name: "Em uso (admin e2e)", folderId: null, layout: 1, bg: "marca", anchor: null, comps: [] }] },
        },
      });
      expect(saved.status(), await saved.text()).toBe(200);

      const admin = new AdminPage(page);
      await openAdmin(page, context);
      const dialog = await openBuilderModal(page, admin, "pages@e2e");
      const manifest = dialog.getByRole("region", { name: "Manifest" });
      await expect(manifest).toContainText("3 fundos");
      // Um manifest válido… que já não tem o fundo «marca».
      await manifest.getByRole("textbox", { name: "Manifest (JSON)" }).fill(JSON.stringify({ version: 1, backgrounds: [{ id: "claro", label: "Claro" }] }));
      await manifest.getByRole("button", { name: "Carregar manifest" }).click();
      const aviso = manifest.getByRole("alert");
      await expect(aviso).toContainText("Não foi gravado: o manifest novo tira coisas que o cliente está a usar.");
      // (uma linha por bloco que o usa: nas corridas por largura há mais de um)
      await expect(aviso.getByRole("listitem").filter({ hasText: /Fundo "marca" — num bloco/ }).first()).toBeVisible();
      // Nada foi gravado: o resumo continua o de antes.
      await expect(manifest).toContainText("3 fundos");
    });
  });
}
