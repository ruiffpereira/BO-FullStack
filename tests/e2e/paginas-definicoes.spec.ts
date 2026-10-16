import { test, expect, type APIRequestContext, type BrowserContext, type Locator, type Page } from "@playwright/test";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { AdminPage } from "./pages/AdminPage";
import { PaginasPage, VIEWPORTS, uniq } from "./pages/PaginasPage";

/**
 * Páginas → «Definições do site» (B38) nas três larguras.
 *
 * - O cliente (`pages@e2e`) vê só o «Nome do site»: edita-o (aparece no « · Nome» do Google), o botão fica
 *   desligado com alterações por guardar nas páginas, e NÃO vê manifest nem publicação (a API recusa-os com
 *   403 SUPPORT_SESSION_REQUIRED fora de uma sessão de suporte).
 * - Numa sessão de suporte (o admin entra na conta de `pagesB@e2e` com o consentimento dele) aparecem o
 *   «Manifest» (JSON partido, manifest recusado, manifest que tira um fundo em uso, ficheiro válido) e a
 *   «Publicação (GitHub)» (só o repositório; «Testar» nunca se carrega: falaria com o GitHub).
 * - Admin → Utilizadores já não tem o botão «Construtor de páginas».
 *
 * `pagesB@e2e` serve a sessão de suporte porque tem o construtor e o manifest da Winterplateau (recarregá-lo é
 * idempotente); a publicação é reposta a «por configurar» no fim para não deixar o tenant em modo GitHub
 * (onde guardar passaria a «À espera de publicar» e não «No ar»).
 */

test.use({ storageState: { cookies: [], origins: [] } });

const TENANT = "pages@e2e";
const SUPPORT_TENANT = "pagesB@e2e";
const ADMIN = "admin@e2e";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.resolve(HERE, "../../../API-FullStack/tests/fixtures/manifest-winterplateau.json");

/** Login por API (sessão isolada do browser): devolve o token e o id do tenant. */
async function apiLogin(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/users/login`, {
    data: { username: email, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${email} falhou (${res.status()})`).toBeTruthy();
  const body = await res.json();
  return { headers: { Authorization: `Bearer ${body.accessToken as string}` }, userId: body.userId as string };
}

/** O tenant dá consentimento ao suporte (como no Perfil) para o admin poder entrar. */
async function grantSupportAccess(request: APIRequestContext, email: string) {
  const { headers, userId } = await apiLogin(request, email);
  const res = await request.put(`${API}/users/me/support-access`, { headers, data: { days: 7 } });
  expect(res.ok(), `consentimento de ${email}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return { headers, userId };
}

/** Abre o separador de suporte (como o «Entrar como»); reautentica o admin e repete se a sessão cair sob carga. */
async function openSupportTab(context: BrowserContext, userId: string): Promise<Page> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const page = await context.newPage();
    await page.goto(`/suporte/entrar/${userId}`);
    try {
      await expect(page.getByRole("region", { name: "Sessão de suporte" })).toBeVisible({ timeout: 20_000 });
      return page;
    } catch (err) {
      lastErr = err;
      await page.close();
      await loginAs(context, ADMIN);
    }
  }
  throw lastErr;
}

const nameSection = (dialog: Locator) => dialog.getByRole("region", { name: "Nome do site" });
const nameInput = (dialog: Locator) => nameSection(dialog).getByRole("textbox", { name: "Nome", exact: true });
const saveName = (dialog: Locator) => nameSection(dialog).getByRole("button", { name: "Guardar nome" });

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · definições do site — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("o cliente vê o nome do site e NÃO vê manifest nem publicação (a API recusa-os fora de suporte)", async ({ page, context, request }) => {
      const p = new PaginasPage(page, context, TENANT);
      await p.open();
      await expect(p.settingsBtn).toBeVisible();
      const dialog = await p.openSettings();

      await expect(nameInput(dialog)).toBeVisible();
      await expect(saveName(dialog)).toBeVisible();
      await expect(dialog.getByRole("region", { name: "Manifest" })).toHaveCount(0);
      await expect(dialog.getByRole("region", { name: "Publicação" })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Carregar manifest" })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Guardar publicação" })).toHaveCount(0);
      await expect(dialog.getByRole("textbox", { name: "Manifest (JSON)" })).toHaveCount(0);
      await expect(dialog).not.toContainText("Só visível numa sessão de suporte");

      // Fronteira da API: o mesmo cliente, com o token dele, é recusado nas rotas de suporte.
      const { headers } = await apiLogin(request, TENANT);
      for (const call of [
        () => request.get(`${API}/cms/site-builder/support`, { headers }),
        () => request.put(`${API}/cms/site-builder/support/manifest`, { headers, data: { version: 1, backgrounds: [{ id: "claro", label: "Claro" }] } }),
        () => request.put(`${API}/cms/site-builder/support/publish`, { headers, data: { repo: "dono/repo" } }),
      ]) {
        const res = await call();
        expect(res.status()).toBe(403);
        expect(JSON.stringify(await res.json())).toContain("SUPPORT_SESSION_REQUIRED");
      }

      await p.closeSettings();
    });

    test("nome do site: o cliente define-o, persiste ao reabrir, aparece no «· nome» do Google e apagar volta a vazio", async ({ page, context }) => {
      const NAME = `Marca E2E ${Date.now().toString(36).slice(-4)}`;
      const p = new PaginasPage(page, context, TENANT);
      await p.open();

      let dialog = await p.openSettings();
      // Estado inicial limpo (uma corrida anterior pode ter deixado um nome): apaga-o se existir.
      if ((await nameInput(dialog).inputValue()) !== "") {
        await nameInput(dialog).fill("");
        await saveName(dialog).click();
        await expect(page.getByText("Nome do site guardado")).toBeVisible();
        await expect(saveName(dialog)).toBeDisabled();
      }
      await expect(nameInput(dialog)).toHaveValue("");
      await expect(saveName(dialog)).toBeDisabled(); // sem alterações

      try {
        // Define (com espaços à volta: a API recebe-o aparado).
        await nameInput(dialog).fill(`  ${NAME}  `);
        await expect(saveName(dialog)).toBeEnabled();
        await saveName(dialog).click();
        await expect(page.getByText("Nome do site guardado")).toBeVisible();
        await expect(nameInput(dialog)).toHaveValue(NAME);
        await expect(saveName(dialog)).toBeDisabled();

        // Persiste: fechar e abrir de novo traz o valor da API.
        await p.closeSettings();
        dialog = await p.openSettings();
        await expect(nameInput(dialog)).toHaveValue(NAME);
        await expect(saveName(dialog)).toBeDisabled();
        await p.closeSettings();

        // Aparece no fim do título da pré-visualização do Google; uma página nova grava sem conflito de revisão.
        const pg = `Nome-${uniq()}`;
        await p.createPage(pg);
        await p.openTab("Definições e SEO");
        const serp = page.getByRole("region", { name: "Google (SEO)" }).getByTestId("serp");
        await expect(serp).toBeVisible();
        await expect(serp.getByText(new RegExp(` · ${NAME}$`))).toBeVisible();
        await expect(serp.locator("b")).toHaveText(NAME);
        await p.save();
        await expect(p.status).toHaveText(/No ar · \d{2}:\d{2}/);

        // Apagar volta a vazio (e persiste vazio).
        dialog = await p.openSettings();
        await nameInput(dialog).fill("");
        await saveName(dialog).click();
        await expect(page.getByText("Nome do site guardado")).toBeVisible();
        await expect(nameInput(dialog)).toHaveValue("");
        await expect(saveName(dialog)).toBeDisabled();
        await p.closeSettings();
        dialog = await p.openSettings();
        await expect(nameInput(dialog)).toHaveValue("");
        await p.closeSettings();
      } finally {
        // Repõe o estado (nome a null) mesmo se o teste falhou a meio.
        try {
          if ((await p.settingsDialog.count()) === 0) await p.openSettings();
          const d = p.settingsDialog;
          if ((await nameInput(d).inputValue()) !== "") {
            await nameInput(d).fill("");
            await saveName(d).click();
            await expect(saveName(d)).toBeDisabled();
          }
        } catch {
          /* melhor esforço: o erro que interessa é o do teste */
        }
      }
    });

    test("com alterações por guardar nas páginas o «Guardar nome» fica desligado, com a explicação", async ({ page, context }) => {
      const p = new PaginasPage(page, context, TENANT);
      await p.open();
      await p.createPage(`Pendente-${uniq()}`); // página nova por guardar → a barra de topo tem alterações pendentes
      await expect(p.saveBtn).toBeEnabled();

      const dialog = await p.openSettings();
      await nameInput(dialog).fill(`Pendente ${uniq()}`);
      await expect(saveName(dialog)).toBeDisabled();
      await expect(nameSection(dialog)).toContainText("Guarda primeiro as alterações às páginas.");
      await p.closeSettings();

      // Guardar as páginas liberta o botão.
      await p.save();
      const again = await p.openSettings();
      await nameInput(again).fill(`Livre ${uniq()}`);
      await expect(nameSection(again)).not.toContainText("Guarda primeiro as alterações às páginas.");
      await expect(saveName(again)).toBeEnabled();
      await p.closeSettings();
    });

    test("sessão de suporte: o manifest (JSON partido, recusado, fundo em uso, ficheiro válido) e a publicação (só o repositório)", async ({ page, context, request }) => {
      // O tenant dá o consentimento e fica com um bloco que usa o fundo «marca».
      const { headers, userId } = await grantSupportAccess(request, SUPPORT_TENANT);
      const state = await (await request.get(`${API}/cms/site-builder`, { headers })).json();
      const saved = await request.post(`${API}/cms/site-builder/save`, {
        headers,
        data: {
          baseRevision: state.revision,
          blocks: { upsert: [{ id: randomUUID(), name: "Em uso (definições e2e)", folderId: null, layout: 1, bg: "marca", anchor: null, comps: [] }] },
        },
      });
      expect(saved.status(), await saved.text()).toBe(200);

      await loginAs(context, ADMIN);
      const support = await openSupportTab(context, userId);
      const sp = new PaginasPage(support, context, ADMIN);
      let sentHeaders: Record<string, string> | null = null;
      try {
        await sp.gotoInSession();
        const dialog = await sp.openSettings();

        // Mesmo modal, mais duas secções (e o aviso de que o cliente não as vê).
        await expect(nameSection(dialog)).toBeVisible();
        await expect(dialog).toContainText("Só visível numa sessão de suporte");
        const manifest = dialog.getByRole("region", { name: "Manifest" });
        const pub = dialog.getByRole("region", { name: "Publicação" });
        await expect(manifest).toBeVisible({ timeout: 10_000 });
        await expect(pub).toBeVisible();

        // ── Manifest ───────────────────────────────────────────────────────────
        const area = manifest.getByRole("textbox", { name: "Manifest (JSON)" });
        const carregar = manifest.getByRole("button", { name: "Carregar manifest" });
        const alert = manifest.getByRole("alert");
        await expect(manifest).toContainText(/Carregado: versão 1, /); // vem do tenant (Winterplateau)
        await expect(carregar).toBeDisabled();

        // Texto que nem é JSON → erro de parse, sem pedido à API.
        await area.fill("{ isto não é json");
        await carregar.click();
        await expect(alert).toContainText("O texto não é JSON válido");

        // JSON válido mas que a API recusa (falta `backgrounds`): os problemas aparecem em lista.
        await area.fill(JSON.stringify({ version: 1, styles: {} }));
        await carregar.click();
        await expect(alert).toContainText("O manifest não é válido");
        await expect(alert.getByRole("listitem").first()).toBeVisible();
        await expect(alert).toContainText("backgrounds");
        // Mexer no texto limpa o aviso.
        await area.fill("{}");
        await expect(alert).toHaveCount(0);

        // Um manifest válido… que já não tem o fundo «marca», em uso por um bloco: 409 e nada gravado.
        await area.fill(JSON.stringify({ version: 1, backgrounds: [{ id: "claro", label: "Claro" }] }));
        await carregar.click();
        await expect(alert).toContainText("Não foi gravado: o manifest novo tira coisas que o site está a usar.");
        await expect(alert.getByRole("listitem").filter({ hasText: /Fundo "marca" — num bloco/ }).first()).toBeVisible();
        await expect(manifest).toContainText("3 fundos");

        // O da Winterplateau, por ficheiro.
        await manifest.getByLabel("Ficheiro do manifest").setInputFiles(MANIFEST);
        await expect(area).toHaveValue(/"edificio3d"/);
        await carregar.click();
        await expect(support.getByText("Manifest carregado")).toBeVisible();
        // (a ordem dos especiais é a que o MySQL devolve nas chaves do JSON)
        await expect(manifest).toContainText(/Carregado: versão 1, 5 tipos com estilos, 3 fundos, 2 ícones, 2 especiais \((edificio3d, faixa|faixa, edificio3d)\)\./);
        await expect(area).toHaveValue("");
        await expect(alert).toHaveCount(0);

        // ── Publicação (GitHub) ─────────────────────────────────────────────────
        const repo = pub.getByRole("textbox", { name: "Repositório", exact: true });
        const guardar = pub.getByRole("button", { name: "Guardar publicação" });
        const testar = pub.getByRole("button", { name: "Testar" });
        await expect(pub).toContainText("Por configurar");
        await expect(guardar).toBeDisabled();
        await expect(testar).toBeDisabled();
        // O avançado (workflow, branch, token) está recolhido; o token é um campo de password que começa vazio.
        const avancado = pub.locator("details");
        await expect(avancado).not.toHaveAttribute("open", "");
        await avancado.locator("summary").click();
        await expect(pub.getByRole("textbox", { name: "Workflow", exact: true })).toBeVisible();
        await expect(pub.getByRole("textbox", { name: "Branch", exact: true })).toBeVisible();
        const token = pub.getByLabel(/^Token do GitHub/);
        await expect(token).toHaveAttribute("type", "password");
        await expect(token).toHaveValue("");

        // Só o repositório chega (workflow/branch/token são opcionais).
        await repo.fill(`dono/repo-e2e-${uniq()}`);
        await expect(guardar).toBeEnabled();
        const putReq = support.waitForRequest((r) => r.method() === "PUT" && r.url().includes("/cms/site-builder/support/publish"));
        await guardar.click();
        const sent = await putReq;
        sentHeaders = await sent.allHeaders();
        const body = sent.postDataJSON() as Record<string, unknown>;
        expect(body.repo).toMatch(/^dono\/repo-e2e-/);
        expect(body).not.toHaveProperty("token"); // vazio nunca segue
        await expect(support.getByText("Publicação guardada")).toBeVisible();
        await expect(guardar).toBeDisabled(); // sem alterações
        await expect(testar).toBeEnabled(); // (não se carrega: falaria com o GitHub)
        await expect(repo).toHaveValue(/^dono\/repo-e2e-/);
      } finally {
        // Repõe «por configurar» (repo vazio = volta a runtime) com os cabeçalhos da própria sessão de suporte.
        if (sentHeaders) {
          const h = Object.fromEntries(
            Object.entries(sentHeaders).filter(([k]) => !["content-length", "host", "cookie", "connection"].includes(k.toLowerCase())),
          );
          const res = await request.put(`${API}/cms/site-builder/support/publish`, { headers: h, data: { repo: null } });
          expect(res.ok(), `repor a publicação: ${res.status()} ${await res.text()}`).toBeTruthy();
        }
        await support.close();
      }
      void page;
    });

    test("Admin → Utilizadores já não tem o botão «Construtor de páginas»", async ({ page, context }) => {
      await loginAs(context, ADMIN);
      const admin = new AdminPage(page);
      await withSessionRetry(page, context, ADMIN, () => page.goto("/admin"), async () => {
        await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
        await expect(page.getByRole("button", { name: "Eliminar" }).first()).toBeVisible({ timeout: 15_000 });
      });
      // A linha de um tenant com construtor tem as acções de sempre mas não esta.
      const row = await admin.userRowFromStart(TENANT);
      await expect(row.getByRole("button", { name: "Eliminar" })).toBeVisible();
      await expect(row.getByRole("button", { name: /Construtor de páginas/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Construtor de páginas/ })).toHaveCount(0);
      await expect(page.getByRole("dialog", { name: "Construtor de páginas" })).toHaveCount(0);
    });
  });
}
