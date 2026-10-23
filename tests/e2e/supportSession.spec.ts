import { test, expect, request, type BrowserContext, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { loginAs, nextClientIp, E2E_PASSWORD, API } from "./fixtures/login";
import { AdminPage } from "./pages/AdminPage";

/**
 * "Acesso de suporte" — o admin da plataforma entra na conta de um tenant
 * (sessão de suporte) com o consentimento do tenant.
 *
 * Tenants do seed (`scripts/seedE2e.ts`, todos NÃO-admin; `tenantA/B` têm `Admin`
 * e por isso nunca são impersonáveis). Cada cenário que MUDA o consentimento
 * tem o seu tenant, para os specs não se estragarem uns aos outros:
 *   suporte-sim     "Cliente Suporte"     consentimento activo (+7d)
 *   suporte-nao     "Cliente Sem Acesso"  sem consentimento
 *   suporte-revoga  "Cliente Revoga"      activo — só o teste de revogação o revoga
 *   suporte-perfil  "Cliente Perfil"      activo — só o teste do cartão do Perfil
 *
 * Nota: `window.close()` (chamado pelo "Sair") é neutralizado num init script —
 * numa janela aberta por script o browser fecharia mesmo o separador e o ecrã
 * "A sessão de suporte terminou" nunca ficaria observável.
 */

// Cada teste autentica o seu próprio utilizador — começa sem sessão.
test.use({ storageState: { cookies: [], origins: [] } });

const SHOTS = path.resolve("test-results", "support-screens");
fs.mkdirSync(SHOTS, { recursive: true });

const SIM = { name: "Cliente Suporte", email: "suporte-sim@e2e.local" };
const NAO = { name: "Cliente Sem Acesso", email: "suporte-nao@e2e.local" };
const REVOGA = { name: "Cliente Revoga", email: "suporte-revoga@e2e.local" };
const PERFIL = { name: "Cliente Perfil", email: "suporte-perfil@e2e.local" };
const ADMIN = "admin@e2e";

/** userId do tenant, via login numa sessão de API isolada (não toca no jar do browser). */
async function tenantId(email: string): Promise<string> {
  const api = await request.newContext();
  try {
    const res = await api.post(`${API}/users/login`, {
      data: { username: email, password: E2E_PASSWORD },
      headers: { "CF-Connecting-IP": nextClientIp() },
    });
    expect(res.ok(), `login de ${email} falhou (${res.status()})`).toBeTruthy();
    return (await res.json()).userId as string;
  } finally {
    await api.dispose();
  }
}

const bar = (page: Page) => page.getByRole("region", { name: "Sessão de suporte" });
const ended = (page: Page) => page.getByRole("heading", { name: "A sessão de suporte terminou" });
const nav = (page: Page) => page.locator("nav").first();

/** Neutraliza `window.close()` em todos os separadores do contexto (ver nota acima). */
async function stubWindowClose(context: BrowserContext) {
  await context.addInitScript(() => {
    (window as any).__closeCalls = 0;
    window.close = () => {
      (window as any).__closeCalls += 1;
    };
  });
}

/**
 * Abre um separador de suporte directamente em `/suporte/entrar/<id>` (o mesmo
 * que o "Entrar como" abre). Corre com a sessão do admin (cookie). Se o arranque
 * cair no ecrã de Login por corrida do refresh em série (ver ARMADILHAS →
 * "Testes e2e"), reautentica o admin e repete — o assert não se enfraquece.
 */
async function openSupportTab(context: BrowserContext, userId: string): Promise<Page> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const page = await context.newPage();
    await page.goto(`/suporte/entrar/${userId}`);
    try {
      await expect(bar(page)).toBeVisible({ timeout: 20_000 });
      return page;
    } catch (err) {
      lastErr = err;
      await page.close();
      await loginAs(context, ADMIN);
    }
  }
  throw lastErr;
}

/** Cria um serviço pela UI (/agenda/servicos). Funciona em sessão normal e de suporte. */
async function createService(page: Page, name: string) {
  await page.goto("/agenda/servicos");
  await page.getByRole("button", { name: "Novo serviço" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Pesquisar ou escrever um nome…").first().fill(name);
  await dialog.locator('input[type="number"]').nth(1).fill("10");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Serviço criado")).toBeVisible({ timeout: 10_000 });
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 10_000 });
}

/** Edita o preço de um serviço pela UI. */
async function editServicePrice(page: Page, name: string, price: string) {
  const card = page.locator("div.select-none").filter({ hasText: name }).first();
  await card.getByRole("button", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="number"]').nth(1).fill(price);
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Serviço actualizado")).toBeVisible({ timeout: 10_000 });
}

test.describe("Acesso de suporte — Admin → Utilizadores", () => {
  test("lista: 'Entrar como' activo / desactivado com motivo / ausente no próprio admin", async ({
    page,
    context,
  }) => {
    await loginAs(context, ADMIN);
    const admin = new AdminPage(page);
    await admin.goto();
    await expect(page.locator("tr").first()).toBeVisible({ timeout: 15_000 });

    // Tenant com consentimento → activo.
    const sim = await admin.impersonateButton(SIM.name);
    await expect(sim).toHaveAccessibleName(`Entrar como ${SIM.name}`);
    await expect(sim).toBeEnabled();

    // Captura da lista (com os botões) — antes de paginar para outras linhas.
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, "admin-users.png"), fullPage: true });

    // Sem consentimento → desactivado, com o motivo de não autorizado.
    const nao = await admin.impersonateButton(NAO.name);
    await expect(nao).toBeDisabled();
    await expect(nao).toHaveAccessibleName(/\(indisponível\).*não autorizou/);

    // Alvo com a permissão Admin → desactivado (motivo: conta de admin ou não autorizado).
    const tenantA = await admin.impersonateButton("tenantA@e2e");
    await expect(tenantA).toBeDisabled();

    // O próprio admin nunca tem a acção.
    const own = await admin.userRowFromStart(ADMIN);
    await expect(own).toBeVisible();
    await expect(own.getByRole("button", { name: /^Entrar como / })).toHaveCount(0);
  });

  test("sem consentimento: /suporte/entrar/<id> mostra a mensagem de não autorizado", async ({
    page,
    context,
  }) => {
    await loginAs(context, ADMIN);
    const id = await tenantId(NAO.email);
    await page.goto(`/suporte/entrar/${id}`);
    await expect(page.getByRole("alert")).toContainText("O cliente não autorizou o acesso", {
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: "Fechar separador" })).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
  });
});

test.describe("Acesso de suporte — sessão de suporte", () => {
  test("entrar como: popup em '/', faixa + nome, sem sino; a página do admin fica intacta", async ({
    page,
    context,
  }) => {
    await loginAs(context, ADMIN);
    const admin = new AdminPage(page);
    await admin.goto();

    const button = await admin.impersonateButton(SIM.name);
    const [popup] = await Promise.all([context.waitForEvent("page"), button.click()]);

    await expect(bar(popup)).toBeVisible({ timeout: 20_000 });
    await expect(bar(popup)).toContainText("estás na conta de");
    await expect(bar(popup)).toContainText(SIM.name);
    await expect(bar(popup)).toContainText("termina às");
    await expect(bar(popup).getByRole("button", { name: "Sair" })).toBeVisible();
    await expect(popup).toHaveURL(/\/(dashboard)?$/);
    // O sino de notificações fica escondido em suporte.
    await expect(popup.getByRole("button", { name: /^Notificações/ })).toHaveCount(0);

    // A página do admin continua em Admin e sem faixa.
    await expect(page).toHaveURL(/\/admin/);
    await expect(bar(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Novo utilizador" })).toBeVisible();
  });

  test("isolamento entre separadores: localStorage e sessão do admin intactos", async ({
    page,
    context,
  }) => {
    await loginAs(context, ADMIN);
    const admin = new AdminPage(page);
    await admin.goto();
    await expect(page.getByRole("button", { name: "Novo utilizador" })).toBeVisible();

    const button = await admin.impersonateButton(SIM.name);
    const [popup] = await Promise.all([context.waitForEvent("page"), button.click()]);
    await expect(bar(popup)).toBeVisible({ timeout: 20_000 });

    // O estado de suporte vive no sessionStorage do separador de suporte...
    const support = await popup.evaluate(() => window.sessionStorage.getItem("backoffice.supportSession"));
    expect(support, "o estado de suporte devia estar no sessionStorage do popup").toBeTruthy();
    // ...e a identidade partilhada (localStorage) continua a do admin.
    const identity = async (p: Page) =>
      JSON.parse((await p.evaluate(() => window.localStorage.getItem("backoffice.auth.identity"))) ?? "{}");
    const adminId = await tenantId("admin@e2e.local");
    const simId = await tenantId(SIM.email);
    expect((await identity(page)).userId).toBe(adminId);
    expect((await identity(popup)).userId).toBe(adminId);
    expect((await identity(popup)).userId).not.toBe(simId);
    expect(await page.evaluate(() => window.sessionStorage.getItem("backoffice.supportSession"))).toBeNull();

    // O separador do admin, recarregado, continua a ser o admin.
    await page.reload();
    await expect(page.getByRole("button", { name: "Novo utilizador" })).toBeVisible({ timeout: 20_000 });
    await expect(nav(page).getByRole("button", { name: "Admin", exact: true })).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
    expect((await identity(page)).userId).toBe(adminId);
  });

  test("em suporte: serviço grava na conta do cliente; perfil bloqueado; reload mantém a faixa", async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    await loginAs(context, ADMIN);
    const id = await tenantId(SIM.email);
    const support = await openSupportTab(context, id);

    const svc = `Serviço Suporte ${Date.now()}`;
    await createService(support, svc);
    await editServicePrice(support, svc, "25");

    // Perfil: email e passwords desactivados (nota "Indisponível numa sessão de suporte").
    await support.goto("/perfil");
    await expect(bar(support)).toBeVisible({ timeout: 20_000 });
    await expect(support.locator('input[type="email"]')).toBeDisabled({ timeout: 15_000 });
    const pwds = support.locator('input[type="password"]');
    await expect(pwds.first()).toBeVisible();
    for (let i = 0; i < (await pwds.count()); i++) await expect(pwds.nth(i)).toBeDisabled();
    await expect(support.getByText("Indisponível numa sessão de suporte").first()).toBeVisible();

    // Reload mantém a sessão de suporte.
    await support.reload();
    await expect(bar(support)).toBeVisible({ timeout: 20_000 });
    await expect(bar(support)).toContainText(SIM.name);

    // Prova de que gravou na conta do CLIENTE: numa sessão normal dele, o serviço está lá.
    const tenantCtx = await browser.newContext({ baseURL });
    try {
      await loginAs(tenantCtx, SIM.email);
      const tp = await tenantCtx.newPage();
      await tp.goto("/agenda/servicos");
      await expect(tp.getByText(svc, { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(tp.getByText(/25,00\s€/)).toBeVisible();
      await expect(bar(tp)).toHaveCount(0);
    } finally {
      await tenantCtx.close();
    }
    void page;
  });

  test("sair: ecrã 'terminou', sem /users/logout, voltar ao backoffice do admin", async ({ context, page }) => {
    await stubWindowClose(context);
    await loginAs(context, ADMIN);
    const id = await tenantId(SIM.email);
    const support = await openSupportTab(context, id);

    const logoutRequests: string[] = [];
    support.on("request", (r) => {
      if (r.url().includes("/users/logout")) logoutRequests.push(r.url());
    });

    await bar(support).getByRole("button", { name: "Sair" }).click();
    await expect(ended(support)).toBeVisible({ timeout: 10_000 });
    await expect(support.getByRole("button", { name: "Fechar separador" })).toBeVisible();
    await support.screenshot({ path: path.join(SHOTS, "ended.png") });

    await support.getByRole("button", { name: "Ir para o meu backoffice" }).click();
    await expect(ended(support)).toHaveCount(0);
    await expect(bar(support)).toHaveCount(0);
    await expect(nav(support).getByRole("button", { name: "Admin", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    expect(support.url()).not.toContain("/suporte/");

    expect(logoutRequests, "o Sair nunca devia chamar /users/logout").toEqual([]);
    void page;
  });

  test("revogação pelo cliente: o separador de suporte mostra 'A sessão de suporte terminou'", async ({
    context,
    browser,
    baseURL,
  }) => {
    await stubWindowClose(context);
    await loginAs(context, ADMIN);
    const id = await tenantId(REVOGA.email);
    const support = await openSupportTab(context, id);

    // O cliente (outro contexto, sessão normal) revoga o acesso no Perfil.
    const tenantCtx = await browser.newContext({ baseURL });
    try {
      await loginAs(tenantCtx, REVOGA.email);
      const tp = await tenantCtx.newPage();
      await tp.goto("/perfil");
      await expect(tp.getByTestId("support-access-state")).toContainText("O suporte tem acesso", {
        timeout: 20_000,
      });
      await tp.getByRole("button", { name: "Revogar acesso" }).click();
      await tp.getByRole("dialog").getByRole("button", { name: "Revogar acesso" }).click();
      await expect(tp.getByTestId("support-access-state")).toContainText("O suporte não tem acesso", {
        timeout: 10_000,
      });
    } finally {
      await tenantCtx.close();
    }

    // Uma navegação no separador de suporte → 401 SUPPORT_SESSION_ENDED → ecrã final.
    await support.reload();
    await expect(ended(support)).toBeVisible({ timeout: 20_000 });
    await expect(support.getByText("O cliente revogou o acesso")).toBeVisible();
  });
});

test.describe("Acesso de suporte — Perfil do tenant", () => {
  test("cartão: estado, registo (sessão + alteração do admin), dar e revogar acesso", async ({
    context,
    browser,
    baseURL,
  }) => {
    // 1) O admin entra na conta do tenant e altera um serviço (gera registo).
    await loginAs(context, ADMIN);
    const id = await tenantId(PERFIL.email);
    const support = await openSupportTab(context, id);
    const svc = `Serviço Perfil ${Date.now()}`;
    await createService(support, svc);
    await support.close();

    // 2) O tenant, em sessão normal, vê o cartão.
    const tenantCtx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 1400 } });
    try {
      await loginAs(tenantCtx, PERFIL.email);
      const tp = await tenantCtx.newPage();
      await tp.goto("/perfil");
      const state = tp.getByTestId("support-access-state");
      await expect(tp.getByText("Acesso do suporte", { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(state).toContainText("O suporte tem acesso à tua conta até", { timeout: 15_000 });

      // Registo: a sessão de suporte e a alteração (com o nome do admin).
      await expect(tp.getByText("Registo do suporte")).toBeVisible();
      // O registo pagina a 10: as leituras da sessão (R1.9, «Viu …») empurram «Entrou…» para a 2.ª página conforme o
      // número de ecrãs que o admin abriu — procura-se página a página, o assert não se enfraquece.
      await showLogRow(tp, "Entrou na tua conta (sessão de suporte)");
      await expect(tp.getByText("Entrou na tua conta (sessão de suporte)").first()).toBeVisible({ timeout: 15_000 });
      // `POST /schedule/services` → "Criou os serviços"; o nome do serviço (CMS) →
      // "Alterou os conteúdos" — ambos com o nome do admin.
      await showLogRow(tp, "Criou os serviços");
      const created = tp.locator("tr").filter({ hasText: "Criou os serviços" }).first();
      await expect(created).toContainText(ADMIN);
      await showLogRow(tp, "Alterou os conteúdos");
      const cms = tp.locator("tr").filter({ hasText: "Alterou os conteúdos" }).first();
      await expect(cms).toContainText(ADMIN);

      await state
        .locator("xpath=ancestor::div[contains(@class,'p-5')][1]")
        .screenshot({ path: path.join(SHOTS, "perfil-card.png") });

      // Dar acesso por 24 horas actualiza o texto (a data de fim muda).
      const before = await state.innerText();
      await tp.getByLabel("Duração").selectOption("1");
      await tp.getByRole("button", { name: "Dar acesso ao suporte" }).click();
      await expect(tp.getByText("Deste acesso ao suporte.")).toBeVisible({ timeout: 10_000 });
      await expect(async () => {
        const after = await state.innerText();
        expect(after).toContain("O suporte tem acesso à tua conta até");
        expect(after).not.toBe(before);
      }).toPass({ timeout: 10_000 });
      await expect(tp.getByText("Deste acesso ao suporte por 1 dia").first()).toBeVisible({ timeout: 10_000 });

      // Revogar com confirmação actualiza o texto.
      await tp.getByRole("button", { name: "Revogar acesso" }).click();
      await tp.getByRole("dialog").getByRole("button", { name: "Revogar acesso" }).click();
      await expect(state).toContainText("O suporte não tem acesso à tua conta", { timeout: 10_000 });
      await expect(tp.getByRole("button", { name: "Revogar acesso" })).toHaveCount(0);
      await expect(tp.getByText("Revogaste o acesso do suporte").first()).toBeVisible({ timeout: 10_000 });
    } finally {
      await tenantCtx.close();
    }
  });
});

/** Volta à 1.ª página do registo e avança até a linha com `text` estar na página (ou o registo acabar). */
async function showLogRow(tp: Page, text: string): Promise<void> {
  const prev = tp.getByRole("button", { name: "Página anterior" });
  const next = tp.getByRole("button", { name: "Página seguinte" });
  while ((await prev.count()) > 0 && (await prev.isEnabled())) await prev.click();
  for (let i = 0; i < 20; i++) {
    if ((await tp.getByText(text).count()) > 0) return;
    if ((await next.count()) === 0 || !(await next.isEnabled())) return;
    await next.click();
  }
}

test.describe("Acesso de suporte — capturas para revisão visual", () => {
  test("faixa de suporte em tema claro e escuro", async ({ context }) => {
    await loginAs(context, ADMIN);
    const id = await tenantId(SIM.email);
    const support = await openSupportTab(context, id);
    await support.setViewportSize({ width: 1280, height: 800 });

    for (const theme of ["light", "dark"] as const) {
      // O tema segue o sistema (preferência do tenant = "system"; o servidor manda sobre o
      // localStorage). A sessão de suporte sobrevive ao reload (sessionStorage).
      await support.emulateMedia({ colorScheme: theme });
      await support.reload();
      await expect(bar(support)).toBeVisible({ timeout: 20_000 });
      await expect(support.locator("html")).toHaveClass(
        theme === "dark" ? /(^|\s)dark(\s|$)/ : /^(?!.*\bdark\b).*$/,
      );
      await support.waitForTimeout(400);
      await support.screenshot({
        path: path.join(SHOTS, `bar-${theme}.png`),
        clip: { x: 0, y: 0, width: 1280, height: 220 },
      });
    }
  });
});
