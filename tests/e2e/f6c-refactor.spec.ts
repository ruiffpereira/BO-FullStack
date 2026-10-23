import { test, expect, request as pwRequest, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { ADMIN, openSupportTab } from "./fixtures/support";

/**
 * B57 · F6c1 + F6c2 — o refactor do Backoffice não pode mudar o comportamento.
 *
 * F6c1: o token só pelo interceptor (nada de `headers` à mão: refresh e sessão de suporte incluídos), o `confirmDialog`
 * imperativo desenha o `ConfirmDialog` com `GuardButton` (EQ-03: só-ver e tenant só-leitura veem o confirmar desactivado).
 * F6c2: ficha de cliente única (curta na Agenda, `full` em Clientes — EQ-06), `PeriodSelector` único (Estatísticas e
 * Financeiro, `aria-pressed`), abas do pagamento do `ApptModal` (`role=tab`, teclado), filtros do Ginásio em `<Tabs>`.
 *
 * Seed (`API-FullStack/scripts/seedE2e.ts`): dono `arvore-a@e2e.local`; só-ver `av-sover@e2e.local` (todas as folhas em Ver);
 * `av-semvalores@e2e.local` (marcações Editar, serviços e clientes Ver, SEM `agenda.marcacoes.valores`); sessão de suporte em
 * `suporte-sim@e2e.local` (consentimento activo, só lido aqui).
 *
 * Regras: EQ-02, EQ-03, EQ-06 · AG-06 (abas do pagamento) · G (token só pelo interceptor).
 */
test.use({ storageState: { cookies: [], origins: [] } });

const DONO = "arvore-a@e2e.local";
const SO_VER = "av-sover@e2e.local";
const SEM_VALORES = "av-semvalores@e2e.local";
const SUPORTE_SIM = { name: "Cliente Suporte", email: "suporte-sim@e2e.local" };
const VIEW_ONLY = "Só tens permissão para ver";

const SHOTS = path.resolve(".design", "b57-f6c", "capturas");
fs.mkdirSync(SHOTS, { recursive: true });

const WIDTHS = [
  { w: 1440, h: 900 },
  { w: 834, h: 1112 },
  { w: 390, h: 844 },
] as const;

// ── helpers ─────────────────────────────────────────────────────────────────────

async function settled(page: Page): Promise<void> {
  await expect(page.locator("main")).toBeVisible();
  await expect.poll(async () => /A carregar/.test(await page.locator("main").innerText()), { timeout: 15_000 }).toBe(false);
}

async function open(page: Page, context: BrowserContext, user: string, route: string, ready?: () => Promise<void>): Promise<void> {
  await loginAs(context, user);
  await withSessionRetry(page, context, user, () => page.goto(route), async () => {
    await expect(page.locator("header").first()).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe(route.split("?")[0]);
    await settled(page);
    if (ready) await ready();
  });
}

/** Navegação dentro da app, SEM recarregar (o React Router ouve o `popstate`). */
async function irSemRecarregar(page: Page, rota: string): Promise<void> {
  await page.evaluate((r) => {
    window.history.pushState({}, "", r);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, rota);
  await page.waitForURL(`**${rota}`, { timeout: 10_000 });
}

async function expectNoHScroll(page: Page, label: string): Promise<void> {
  const o = await page.evaluate(() => {
    const de = document.documentElement;
    const m = document.querySelector("main");
    return { doc: de.scrollWidth - de.clientWidth, main: m ? m.scrollWidth - m.clientWidth : 0 };
  });
  expect.soft(o.doc, `${label}: scroll horizontal da página (${o.doc}px)`).toBeLessThanOrEqual(1);
  expect.soft(o.main, `${label}: scroll horizontal do <main> (${o.main}px)`).toBeLessThanOrEqual(1);
}

/** Tenant só-leitura (subscrição por regularizar): o `GET /billing/subscription` diz `readOnly`. */
async function billingSoLeitura(page: Page): Promise<void> {
  await page.route("**/billing/subscription", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "past_due",
            reason: "past_due_locked",
            readOnly: true,
            modules: [],
            monthlyTotalEur: 0,
            trialEnd: null,
            currentPeriodEnd: null,
            cancelAt: null,
            graceEndsAt: null,
            hasStripeSubscription: true,
          }),
        })
      : route.continue(),
  );
}

/** Conta os DELETE que o browser lançou (um confirmar cancelado nunca os lança). */
function countDeletes(page: Page): () => number {
  let n = 0;
  page.on("request", (r) => {
    if (r.method() === "DELETE") n += 1;
  });
  return () => n;
}

function captureApi(page: Page, match: RegExp): { url: string; text: string }[] {
  const bodies: { url: string; text: string }[] = [];
  page.on("response", async (res) => {
    if (!res.url().startsWith(API) || !match.test(res.url())) return;
    try {
      bodies.push({ url: res.url(), text: await res.text() });
    } catch {
      /* redireccionamentos / corpo já descartado */
    }
  });
  return bodies;
}

const MONEY_KEYS = /"(servicePrice|paymentCash|paymentMbway|paymentCard|paidAt|paymentHistory|totalSpent)"/;
const MONEY_TEXT = /€|gasto total|Dívida|43[.,]25|Pago\b/;

async function shot(page: Page, name: string, w: number): Promise<void> {
  await page.screenshot({ path: path.join(SHOTS, `${name}-${w}.png`) });
}

// ═══════════════ F6c1 · (a) confirmar imperativo com write-guard (EQ-03) ═══════════════

for (const vp of WIDTHS) {
  test.describe(`F6c1 · confirmDialog imperativo · ${vp.w}`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });

    const cartaoServico = (page: Page) => page.locator("div.select-none").filter({ hasText: "Corte Ametista" }).first();
    const eliminarServico = (page: Page) => cartaoServico(page).getByRole("button", { name: "Eliminar", exact: true });
    const readyServicos = (page: Page) => async () => {
      await expect(cartaoServico(page)).toBeVisible({ timeout: 15_000 });
    };

    test(`EQ-03: Agenda → Serviços — o dono abre o confirmar do Eliminar com o botão activo; Cancelar não apaga nada`, async ({ page, context }) => {
      const apagados = countDeletes(page);
      await open(page, context, DONO, "/agenda/servicos", readyServicos(page));
      await expect(eliminarServico(page)).toBeEnabled();
      await eliminarServico(page).click();
      const dlg = page.getByRole("dialog", { name: /Eliminar .Corte Ametista.\?/ });
      await expect(dlg).toBeVisible();
      await expect(dlg.getByRole("button", { name: "Eliminar", exact: true })).toBeEnabled();
      await expect(dlg.getByRole("button", { name: "Cancelar" })).toBeEnabled();
      await shot(page, "confirm-servico-dono", vp.w);
      await expectNoHScroll(page, `confirmar@${vp.w}`);
      await dlg.getByRole("button", { name: "Cancelar" }).click();
      await expect(dlg).toHaveCount(0);
      await page.waitForTimeout(300);
      expect(apagados(), "Cancelar não pode lançar nenhum DELETE").toBe(0);
    });

    test(`EQ-03: Agenda → Serviços — membro só-ver vê o Eliminar desactivado com o motivo (nunca abre o confirmar)`, async ({ page, context }) => {
      await open(page, context, SO_VER, "/agenda/servicos", readyServicos(page));
      const del = eliminarServico(page);
      await expect(del).toBeVisible();
      await expect(del).toBeDisabled();
      await expect(del).toHaveAttribute("title", VIEW_ONLY);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test(`EQ-03: Agenda → Serviços — tenant só-leitura (billing): Eliminar desactivado com o motivo de pagamento`, async ({ page, context }) => {
      await billingSoLeitura(page);
      await open(page, context, DONO, "/agenda/servicos", readyServicos(page));
      const del = eliminarServico(page);
      await expect(del).toBeDisabled();
      await expect(del).toHaveAttribute("title", /Pagamento pendente/);
    });

    test(`EQ-03: Loja — o dono abre o confirmar do produto com o botão activo; o só-ver e o tenant só-leitura têm o Eliminar desactivado`, async ({ page, context }) => {
      const apagados = countDeletes(page);
      const ready = async () => {
        await expect(page.getByText("Produto Ametista").first()).toBeVisible({ timeout: 15_000 });
      };
      await open(page, context, DONO, "/loja", ready);
      const del = page.locator("main button[title='Eliminar']").first();
      await expect(del).toBeEnabled();
      await del.click();
      const dlg = page.getByRole("dialog", { name: /Eliminar ".+"\?/ });
      await expect(dlg).toBeVisible();
      await expect(dlg.getByRole("button", { name: "Eliminar", exact: true })).toBeEnabled();
      await dlg.getByRole("button", { name: "Cancelar" }).click();
      await expect(dlg).toHaveCount(0);
      expect(apagados()).toBe(0);

      // Só-ver: o mesmo botão (agora com o motivo no title) está desactivado.
      await open(page, context, SO_VER, "/loja", ready);
      const soVer = page.locator(`main button[title="${VIEW_ONLY}"]`).first();
      await expect(soVer).toBeDisabled();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // Tenant só-leitura: desactivado com o motivo de billing.
      await billingSoLeitura(page);
      await open(page, context, DONO, "/loja", ready);
      await expect(page.locator("main button[title^='Pagamento pendente']").first()).toBeDisabled();
    });

    test(`EQ-03: Perfil — «Revogar acesso» do suporte continua a funcionar com o tenant só-leitura (a API não põe billingGate; guard:false)`, async ({ page, context }) => {
      const api = await pwRequest.newContext();
      try {
        const login = await api.post(`${API}/users/login`, {
          data: { username: DONO, password: E2E_PASSWORD },
          headers: { "CF-Connecting-IP": nextClientIp() },
        });
        expect(login.ok()).toBeTruthy();
        const headers = { Authorization: `Bearer ${(await login.json()).accessToken as string}` };
        const grant = await api.put(`${API}/users/me/support-access`, { headers, data: { days: 7 } });
        expect(grant.ok(), `consentimento (${grant.status()})`).toBeTruthy();

        await billingSoLeitura(page);
        await open(page, context, DONO, "/perfil", async () => {
          await expect(page.getByTestId("support-access-state")).toContainText("O suporte tem acesso", { timeout: 20_000 });
        });
        const revogar = page.getByRole("button", { name: "Revogar acesso" });
        await expect(revogar).toBeEnabled();
        await revogar.click();
        const dlg = page.getByRole("dialog", { name: "Revogar o acesso do suporte?" });
        await expect(dlg).toBeVisible();
        const confirmar = dlg.getByRole("button", { name: "Revogar acesso" });
        await expect(confirmar).toBeEnabled();
        await shot(page, "confirm-revogar-suporte", vp.w);
        await confirmar.click();
        await expect(page.getByTestId("support-access-state")).toContainText("O suporte não tem acesso", { timeout: 10_000 });
      } finally {
        // Limpa o consentimento mesmo que o teste falhe a meio.
        const l2 = await api.post(`${API}/users/login`, {
          data: { username: DONO, password: E2E_PASSWORD },
          headers: { "CF-Connecting-IP": nextClientIp() },
        });
        if (l2.ok()) {
          await api.put(`${API}/users/me/support-access`, { headers: { Authorization: `Bearer ${(await l2.json()).accessToken as string}` }, data: { days: 0 } });
        }
        await api.dispose();
      }
    });
  });
}

// ═══════════════ F6c1 · (b) token só pelo interceptor: refresh e sessão de suporte ═══════════════

test.describe("F6c1 · token só pelo interceptor", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("um 401 a meio da sessão faz refresh UMA vez e repete o pedido com o token novo (sem headers à mão)", async ({ page, context }) => {
    await open(page, context, DONO, "/perfil");

    const auths: string[] = [];
    let derrubado = false;
    await page.route("**/schedule/services**", async (route) => {
      const r = route.request();
      if (r.method() !== "GET") return route.continue();
      auths.push((await r.allHeaders())["authorization"] ?? "");
      if (!derrubado) {
        derrubado = true;
        return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Unauthorized", code: "TOKEN_EXPIRED" }) });
      }
      return route.continue();
    });

    // Só os refreshes depois deste ponto contam (o arranque da sessão já fez o seu).
    const refreshes: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/users/refresh")) refreshes.push(r.url());
    });

    await irSemRecarregar(page, "/agenda/servicos");
    await expect(page.locator("div.select-none").filter({ hasText: "Corte Ametista" }).first()).toBeVisible({ timeout: 20_000 });

    expect(auths.length, "o pedido foi repetido depois do 401").toBeGreaterThanOrEqual(2);
    expect(auths[0], "o interceptor injecta o Bearer no pedido original").toMatch(/^Bearer .+/);
    expect(auths[1], "o pedido repetido leva o token NOVO").toMatch(/^Bearer .+/);
    expect(auths[1]).not.toBe(auths[0]);
    expect(refreshes.length, "um só refresh para o 401").toBe(1);
  });

  test("sessão de suporte: os pedidos levam o Bearer da sessão de suporte; um 401 termina a sessão e NUNCA tenta refrescar", async ({ context }) => {
    await context.addInitScript(() => {
      window.close = () => {
        /* neutralizado: senão o separador fecharia e o ecrã final nunca ficava observável */
      };
    });
    await loginAs(context, ADMIN);
    const api = await pwRequest.newContext();
    let tenantId = "";
    try {
      const res = await api.post(`${API}/users/login`, {
        data: { username: SUPORTE_SIM.email, password: E2E_PASSWORD },
        headers: { "CF-Connecting-IP": nextClientIp() },
      });
      expect(res.ok()).toBeTruthy();
      tenantId = (await res.json()).userId as string;
    } finally {
      await api.dispose();
    }

    const support = await openSupportTab(context, tenantId);
    const comToken: string[] = [];
    const refreshes: string[] = [];
    support.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/users/refresh")) refreshes.push(r.url());
      if (r.method() === "GET" && r.url().includes("/schedule/services")) void r.allHeaders().then((h) => comToken.push(h["authorization"] ?? ""));
    });

    const resposta = support.waitForResponse((r) => r.url().includes("/schedule/services") && r.request().method() === "GET");
    await support.goto("/agenda/servicos");
    expect((await resposta).status(), "a sessão de suporte lê os serviços do cliente").toBe(200);
    await expect.poll(() => comToken.length, { timeout: 5_000 }).toBeGreaterThan(0);
    expect(comToken[0]).toMatch(/^Bearer .+/);
    await expect(support.getByRole("region", { name: "Sessão de suporte" })).toContainText(SUPORTE_SIM.name);

    // O cliente revogou (simulado): o próximo pedido dá 401 SUPPORT_SESSION_ENDED → ecrã final, sem refresh.
    refreshes.length = 0;
    await support.route("**/schedule/services**", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Unauthorized", code: "SUPPORT_SESSION_ENDED" }) }),
    );
    await support.reload();
    await expect(support.getByRole("heading", { name: "A sessão de suporte terminou" })).toBeVisible({ timeout: 20_000 });
    expect(refreshes, "em sessão de suporte um 401 nunca refresca (o cookie de refresh é o do admin)").toEqual([]);
  });
});

// ═══════════════ F6c2 · (c) ficha de cliente única ═══════════════

for (const vp of WIDTHS) {
  test.describe(`F6c2 · ficha de cliente única · ${vp.w}`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });

    const MARC = "Marc Ametista Divida";
    const CLIENTE = "Cliente Ametista Rosa";
    const ficha = (page: Page) => page.getByRole("dialog", { name: "Ficha de cliente" });

    /** Agenda → Marcações → abre a marcação → cabeçalho do cliente → ficha curta. */
    async function fichaDaAgenda(page: Page, context: BrowserContext, user: string): Promise<void> {
      await open(page, context, user, "/agenda/marcacoes", async () => {
        await expect(page.locator("tr").filter({ hasText: MARC }).first()).toBeVisible({ timeout: 15_000 });
      });
      await page.locator("tr").filter({ hasText: MARC }).first().click();
      const modal = page.getByRole("dialog", { name: "Marcação", exact: true });
      await expect(modal).toBeVisible();
      await modal.getByRole("button", { name: new RegExp(MARC) }).click();
      await expect(ficha(page)).toBeVisible({ timeout: 10_000 });
      await expect(ficha(page).getByText("visitas")).toBeVisible({ timeout: 10_000 });
    }

    async function fichaDeClientes(page: Page, context: BrowserContext, user: string): Promise<void> {
      await open(page, context, user, "/clientes", async () => {
        await expect(page.getByText(CLIENTE).first()).toBeVisible({ timeout: 15_000 });
      });
      await page.getByText(CLIENTE).first().click();
      await expect(ficha(page)).toBeVisible({ timeout: 10_000 });
    }

    test(`EQ-06: o dono — Agenda: ficha CURTA (só marcações, com dinheiro, «Bloquear» activo); Clientes: ficha COMPLETA (separadores, novidades, RGPD)`, async ({ page, context }) => {
      await fichaDaAgenda(page, context, DONO);
      const curta = ficha(page);
      await expect(curta.getByText("gasto total")).toBeVisible();
      await expect(curta.getByRole("tab")).toHaveCount(0);
      await expect(curta.getByText("Privacidade (RGPD)")).toHaveCount(0);
      await expect(curta.getByRole("switch", { name: "Aceita novidades por email" })).toHaveCount(0);
      await expect(curta.getByTestId("open-customer-conversation")).toHaveCount(0);
      await expect(curta.getByText("Contribuinte na fatura")).toHaveCount(0); // quem bloqueia não vê o editor «só fatura»
      await expect(curta.getByRole("button", { name: "Bloquear" })).toBeEnabled();
      await shot(page, "ficha-curta-dono", vp.w);
      await expectNoHScroll(page, `ficha curta@${vp.w}`);
      // Há dois «Fechar» (o X do cabeçalho e o do rodapé): o do rodapé é o último.
      await curta.getByRole("button", { name: "Fechar", exact: true }).last().click();
      await expect(curta).toHaveCount(0);
      await expect(page.getByRole("dialog", { name: "Marcação", exact: true }), "a marcação por baixo fica aberta").toBeVisible();

      await fichaDeClientes(page, context, DONO);
      const completa = ficha(page);
      await expect(completa.getByRole("tab", { name: "Agenda" })).toBeVisible();
      await expect(completa.getByText("gasto total")).toBeVisible();
      await expect(completa.getByRole("switch", { name: "Aceita novidades por email" })).toBeVisible();
      await expect(completa.getByText("Privacidade (RGPD)")).toBeVisible();
      await expect(completa.getByRole("button", { name: "Bloquear" })).toBeEnabled();
      await shot(page, "ficha-completa-dono", vp.w);
      await expectNoHScroll(page, `ficha completa@${vp.w}`);
    });

    test(`EQ-06: membro sem «valores» — nenhuma das duas fichas tem dinheiro; «Bloquear» fora da Agenda e desactivado com o motivo em Clientes`, async ({ page, context }) => {
      const bodies = captureApi(page, /\/(customers|appointments)/);

      await fichaDaAgenda(page, context, SEM_VALORES);
      const curta = ficha(page);
      expect(await curta.textContent()).not.toMatch(MONEY_TEXT);
      await expect(curta.getByRole("tab")).toHaveCount(0);
      await expect(curta.getByRole("button", { name: /Bloquear/ })).toHaveCount(0);
      // Só tem a Agenda (editar): mexe apenas na preferência de fatura.
      await expect(curta.getByText("Contribuinte na fatura")).toBeVisible();
      await shot(page, "ficha-curta-semvalores", vp.w);
      await expectNoHScroll(page, `ficha curta sem valores@${vp.w}`);

      await fichaDeClientes(page, context, SEM_VALORES);
      const completa = ficha(page);
      await expect(completa.getByText("visitas")).toBeVisible({ timeout: 10_000 });
      expect(await completa.textContent()).not.toMatch(MONEY_TEXT);
      const bloquear = completa.getByRole("button", { name: "Bloquear" });
      await expect(bloquear).toBeVisible();
      await expect(bloquear).toBeDisabled();
      await expect(bloquear).toHaveAttribute("title", VIEW_ONLY);
      await expect(completa.getByText("Privacidade (RGPD)")).toHaveCount(0);
      await shot(page, "ficha-completa-semvalores", vp.w);
      await expectNoHScroll(page, `ficha completa sem valores@${vp.w}`);

      expect(bodies.length, "devia ter capturado respostas de /customers e /appointments").toBeGreaterThan(0);
      for (const b of bodies) expect(b.text, `campo de dinheiro em ${b.url}`).not.toMatch(MONEY_KEYS);
    });
  });
}

// ═══════════════ F6c2 · (d) PeriodSelector com aria-pressed ═══════════════

for (const vp of WIDTHS) {
  test.describe(`F6c2 · PeriodSelector · ${vp.w}`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });

    test(`Estatísticas: os botões de período têm aria-pressed e o pedido leva o período escolhido`, async ({ page, context }) => {
      await page.route("**/analytics/site**", (route) =>
        route.request().method() === "GET"
          ? route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                configured: true,
                domain: "e2e.test",
                aggregate: { visitors: 12, visits: 20, pageviews: 40, bounceRate: 30, avgDuration: 90 },
                timeseries: [{ date: "2026-10-01", visitors: 3 }, { date: "2026-10-02", visitors: 9 }],
                topPages: [{ page: "/", visitors: 5 }],
                sources: [{ source: "google", visitors: 4 }],
              }),
            })
          : route.continue(),
      );
      await open(page, context, DONO, "/estatisticas", async () => {
        await expect(page.getByRole("button", { name: "Este mês", exact: true })).toBeVisible({ timeout: 15_000 });
      });
      const btn = (name: string) => page.getByRole("button", { name, exact: true });
      await expect(btn("Este mês")).toHaveAttribute("aria-pressed", "true");
      for (const outro of ["Hoje", "7 dias", "30 dias", "6 meses"]) await expect(btn(outro)).toHaveAttribute("aria-pressed", "false");

      const pedido = page.waitForRequest((r) => r.url().includes("/analytics/site") && r.url().includes("period=7d"));
      await btn("7 dias").click();
      await pedido;
      await expect(btn("7 dias")).toHaveAttribute("aria-pressed", "true");
      await expect(btn("Este mês")).toHaveAttribute("aria-pressed", "false");
      await shot(page, "estatisticas-periodo", vp.w);
      await expectNoHScroll(page, `estatísticas@${vp.w}`);
    });

    test(`Financeiro: os mesmos botões, mais «Personalizado» (aria-pressed); escolher um preset fecha o personalizado`, async ({ page, context }) => {
      await open(page, context, DONO, "/financeiro/agenda", async () => {
        await expect(page.getByRole("button", { name: "Este mês", exact: true })).toBeVisible({ timeout: 15_000 });
      });
      const btn = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
      await expect(btn("Este mês")).toHaveAttribute("aria-pressed", "true");
      await expect(btn(/Personalizado/)).toHaveAttribute("aria-pressed", "false");

      await btn("Esta semana").click();
      await expect(btn("Esta semana")).toHaveAttribute("aria-pressed", "true");
      await expect(btn("Este mês")).toHaveAttribute("aria-pressed", "false");

      await btn(/Personalizado/).click();
      await expect(btn(/Personalizado/)).toHaveAttribute("aria-pressed", "true");
      await expect(btn("Esta semana")).toHaveAttribute("aria-pressed", "false");
      await shot(page, "financeiro-personalizado", vp.w);
      // O seletor de datas tem uma película por baixo: fecha-se clicando fora (o período continua «Personalizado»).
      await page.mouse.click(5, vp.h - 5);
      await expect(btn(/Personalizado/)).toHaveAttribute("aria-pressed", "true");

      await btn("Último mês").click();
      await expect(btn("Último mês")).toHaveAttribute("aria-pressed", "true");
      await expect(btn(/Personalizado/)).toHaveAttribute("aria-pressed", "false");
      await expectNoHScroll(page, `financeiro@${vp.w}`);
    });
  });
}

// ═══════════════ F6c2 · (e) abas do pagamento no ApptModal, por teclado ═══════════════

for (const vp of WIDTHS) {
  test(`AG-06 · ApptModal @${vp.w}: Detalhes/Pagamento são tabs — setas trocam, Enter activa, Tab não passeia pelas abas inactivas`, async ({ page, context }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await open(page, context, DONO, "/agenda/marcacoes", async () => {
      await expect(page.getByText("Marc Ametista Paga").first()).toBeVisible({ timeout: 15_000 });
    });
    await page.getByText("Marc Ametista Paga").first().click();
    const dlg = page.getByRole("dialog", { name: "Marcação", exact: true });
    await expect(dlg).toBeVisible();

    const lista = dlg.getByRole("tablist");
    await expect(lista).toBeVisible();
    const detalhes = dlg.getByRole("tab", { name: "Detalhes", exact: true });
    const pagamento = dlg.getByRole("tab", { name: "Pagamento", exact: true });
    await expect(detalhes).toHaveAttribute("aria-selected", "true");
    await expect(pagamento).toHaveAttribute("aria-selected", "false");
    await expect(dlg.getByText("Hora", { exact: true })).toBeVisible();

    // Roving tabindex: só a aba activa está na ordem do Tab.
    await expect(detalhes).toHaveAttribute("tabindex", "0");
    await expect(pagamento).toHaveAttribute("tabindex", "-1");

    await detalhes.focus();
    await page.keyboard.press("ArrowRight");
    await expect(pagamento).toHaveAttribute("aria-selected", "true");
    await expect(detalhes).toHaveAttribute("aria-selected", "false");
    await expect(dlg.getByText("Hora", { exact: true })).toHaveCount(0);
    await shot(page, "apptmodal-pagamento", vp.w);
    await expectNoHScroll(page, `apptmodal pagamento@${vp.w}`);

    await page.keyboard.press("ArrowLeft");
    await expect(detalhes).toHaveAttribute("aria-selected", "true");
    await expect(dlg.getByText("Hora", { exact: true })).toBeVisible();

    // Tab sai da lista de abas (a aba inactiva não recebe o foco por Tab).
    await detalhes.focus();
    await page.keyboard.press("Tab");
    await expect(pagamento).not.toBeFocused();
    await expect(detalhes).not.toBeFocused();

    // Enter numa aba focada (programaticamente) activa-a.
    await pagamento.focus();
    await page.keyboard.press("Enter");
    await expect(pagamento).toHaveAttribute("aria-selected", "true");
  });
}

// ═══════════════ F6c2 · filtros do Ginásio (Cobranças) em <Tabs> ═══════════════

for (const vp of WIDTHS) {
  test(`Ginásio · Cobranças @${vp.w}: o filtro «Por cobrar / Pagos / Todos» são tabs com setas`, async ({ page, context }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await open(page, context, DONO, "/financeiro/ginasio", async () => {
      await expect(page.getByRole("button", { name: "Subscrições" })).toBeVisible({ timeout: 15_000 });
    });
    const cobrar = page.getByRole("tab", { name: /^Por cobrar/ });
    const pagos = page.getByRole("tab", { name: /^Pagos/ });
    const todos = page.getByRole("tab", { name: /^Todos/ });
    // Sem clientes com plano o filtro nem aparece (EmptyState): o seed do arvore-a decide.
    if ((await cobrar.count()) === 0) {
      await expect(page.getByText("Sem clientes com plano")).toBeVisible();
      return;
    }
    await expect(cobrar).toHaveAttribute("aria-selected", "true");
    await todos.click();
    await expect(todos).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(pagos).toHaveAttribute("aria-selected", "true");
    await expect(todos).toHaveAttribute("aria-selected", "false");
    await shot(page, "ginasio-cobrancas-filtro", vp.w);
    await expectNoHScroll(page, `cobranças@${vp.w}`);
  });
}
