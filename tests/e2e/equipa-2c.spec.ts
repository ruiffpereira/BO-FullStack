import { test, expect, type Page, type BrowserContext, type APIRequestContext } from "@playwright/test";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";

/**
 * B41 fase 2c — Dashboard, Financeiro e notificações POR MEMBRO, vistos pela UI com membros reais.
 *
 * Seed (`API-FullStack/scripts/seedE2e.ts`): tenants `arvore-a` ("Salão Ametista") e `arvore-b` ("Estúdio Basalto"),
 * cada um com marcações pagas (A: 77,50 e 63,25), uma encomenda de HOJE (A: 123,45 · B: 234,56) e notificações de
 * folhas diferentes (`ARVORE_NOTIFS`: agenda.marcacoes · loja.encomendas · financeiro.mensalidades · null = só dono).
 *
 * Membros do A: `av-dashsv` (dashboard + agenda.marcacoes SEM valores + loja.encomendas), `av-dashfin` (dashboard +
 * financeiro.negocio + financeiro.loja SEM custo/stock + loja.encomendas), `av-dashagenda` (dashboard + agenda.marcacoes:
 * a única folha que gera dinheiro é nenhuma → nenhum "€" no ecrã) e `av-semdash` (sem a folha dashboard).
 *
 * Nota de desenho: as encomendas têm preço na própria página Encomendas (`loja.encomendas`); por isso um membro com essa
 * folha vê receita DA LOJA no Dashboard. O que nunca pode ver é a receita da AGENDA (`agenda.marcacoes.valores`).
 */
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });
// O sino é stateful (ler/eliminar) — sem retries. Não é serial: a ordem entre testes não importa, cada um relê o seu estado.
test.describe.configure({ retries: 0 });

const OWNER_A = "arvore-a@e2e.local";
const OWNER_B = "arvore-b@e2e.local";
const M = {
  dashSv: "av-dashsv@e2e.local", // (i)  dashboard + agenda.marcacoes (sem valores) + loja.encomendas
  dashFin: "av-dashfin@e2e.local", // (ii) dashboard + financeiro.negocio + financeiro.loja (sem custo) + loja.encomendas
  dashAgenda: "av-dashagenda@e2e.local", // dashboard + agenda.marcacoes (sem valores) — nenhuma folha com dinheiro
  semDash: "av-semdash@e2e.local", // agenda.servicos + clientes.lista (sem dashboard)
  total: "av-total@e2e.local",
};

const N = {
  agenda: "Notif Ametista Marcacao 7731",
  loja: "Notif Ametista Encomenda 5528",
  mensal: "Notif Ametista Mensalidade 9146",
  dono: "Notif Ametista SoDono 3380",
  agendaB: "Notif Basalto Marcacao 6612",
  lojaB: "Notif Basalto Encomenda 4407",
  donoB: "Notif Basalto SoDono 2259",
};

/** Dinheiro da AGENDA do A (preços 77,50 / 63,25, recebido 97,50 e dívida 43,25) — nunca para quem não tem "valores". */
const AGENDA_MONEY = /77[.,]5|63[.,]25|43[.,]25|97[.,]5/;

// ── helpers ────────────────────────────────────────────────────────────────────

const domText = (page: Page) => page.evaluate(() => document.body.textContent ?? "");
const visibleText = (page: Page) => page.locator("main").innerText();

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

async function tokenOf(request: APIRequestContext, username: string): Promise<string> {
  const res = await request.post(`${API}/users/login`, {
    data: { username, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${username} (${res.status()})`).toBeTruthy();
  return (await res.json()).accessToken as string;
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function enter(page: Page, context: BrowserContext, user: string, path: string, ready: () => Promise<void>): Promise<void> {
  await loginAs(context, user);
  await withSessionRetry(page, context, user, () => page.goto(path), ready);
}

const bellButton = (page: Page) => page.getByRole("button", { name: /^Notificações/ }).first();
const bellPanel = (page: Page) => page.getByRole("dialog", { name: "Notificações" });
async function openBell(page: Page) {
  await bellButton(page).click();
  await expect(bellPanel(page)).toBeVisible();
  await expect(bellPanel(page).getByText("A carregar…")).toHaveCount(0);
}
const notifItem = (page: Page, title: string) => bellPanel(page).locator("div.px-4.py-3\\.5").filter({ hasText: title });

async function notificationsApi(request: APIRequestContext, username: string) {
  const res = await request.get(`${API}/notifications?limit=50`, { headers: auth(await tokenOf(request, username)) });
  expect(res.ok(), `GET /notifications como ${username} (${res.status()})`).toBeTruthy();
  return (await res.json()) as { notifications: { title: string; read: boolean }[]; unread: number; total: number };
}

// ═══════════════════ (a) Dashboard do membro SEM valores de agenda ═══════════════════

test.describe("2c — Dashboard sem 'Valores e pagamentos'", () => {
  test("(i) vê os cartões que tem, sem receita da agenda (DOM e rede) e sem buracos", async ({ page, context }) => {
    const bodies = captureApi(page, /\/dashboard(\?|$)/);
    await enter(page, context, M.dashSv, "/dashboard", async () => {
      await expect(page.getByText("Marcações hoje", { exact: true })).toBeVisible({ timeout: 10_000 });
    });
    await expect(page).toHaveURL(/\/dashboard$/);

    // Cartões que o membro TEM: marcações (agenda), encomendas (loja), sem clientes/ginásio/mensalidades.
    await expect(page.getByText("Marcações hoje", { exact: true })).toBeVisible();
    await expect(page.getByText("Marcações · 14 dias")).toBeVisible();
    await expect(page.getByText("Clientes", { exact: true })).toHaveCount(0); // sem clientes.lista
    await expect(page.getByText("Sócios ativos")).toHaveCount(0);
    await expect(page.getByText("Em atraso")).toHaveCount(0);
    await expect(page.getByText("Por cobrar")).toHaveCount(0);

    // A receita agregada só soma a loja (a agenda não entra: sem `schedule.valores`).
    const kpiReceita = page.locator("a, button, div").filter({ hasText: /^Receita de hoje/ }).first();
    if (await kpiReceita.count()) {
      const t = (await kpiReceita.innerText()).toLowerCase();
      expect(t).toContain("loja");
      expect(t).not.toContain("agenda");
    }
    expect(await domText(page)).not.toMatch(AGENDA_MONEY);
    // Sem checklist de onboarding do dono, sem "Sem acesso", sem "0 €" a fingir.
    await expect(page.getByText("Sem acesso")).toHaveCount(0);
    await expect(page.getByText("Sem dados para mostrar")).toHaveCount(0);

    // Rede: o /dashboard nem traz o dinheiro da agenda.
    await expect.poll(() => bodies.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const json = JSON.parse(bodies[bodies.length - 1].text);
    expect(json.included).toEqual(expect.arrayContaining(["schedule", "ecommerce.orders"]));
    expect(json.included).not.toContain("schedule.valores");
    expect(json.included).not.toContain("ecommerce.stock");
    expect(json.included).not.toContain("gym.revenue");
    expect(json.included).not.toContain("expenses");
    expect(JSON.stringify(json.schedule)).not.toMatch(/revenue|avgRevenue/i);
    expect(JSON.stringify(json)).not.toMatch(AGENDA_MONEY);
    // Sem clientes/ginásio/despesas no payload.
    expect(json.gym ?? null).toBeNull();
    expect(json.expenses ?? null).toBeNull();
    // Sem loja.produtos: nenhum alerta de stock.
    expect(json.ecommerce?.stockAlerts ?? []).toEqual([]);
  });

  test("um membro só com agenda (sem loja) não vê nenhum '€' no Dashboard", async ({ page, context }) => {
    await enter(page, context, M.dashAgenda, "/dashboard", async () => {
      await expect(page.getByText("Marcações hoje", { exact: true })).toBeVisible({ timeout: 10_000 });
    });
    await expect(page.getByText("Receita de hoje")).toHaveCount(0);
    await expect(page.getByText("Vendas de hoje")).toHaveCount(0);
    await expect(page.getByText("Ticket médio")).toHaveCount(0);
    expect(await domText(page)).not.toContain("€");
    expect(await visibleText(page)).not.toMatch(AGENDA_MONEY);
  });
});

// ═══════════════════ (b) Financeiro do membro ═══════════════════

test.describe("2c — Financeiro por áreas", () => {
  test("(ii) O Negócio só com a Loja: nota de áreas, sem lucro/margem/despesas, sem agenda", async ({ page, context }) => {
    const bodies = captureApi(page, /\/financeiro\//);
    await enter(page, context, M.dashFin, "/financeiro", async () => {
      await expect(page.getByTestId("negocio-partial")).toBeVisible({ timeout: 10_000 });
    });
    await expect(page.getByTestId("negocio-partial")).toHaveText(/Só vês as áreas a que tens acesso/);

    const main = await visibleText(page);
    expect(main).toMatch(/Faturado/i);
    expect(main).toMatch(/Receita por fonte/i);
    expect(main).toMatch(/Loja/);
    expect(main).toMatch(/123[.,]45/); // a encomenda do dia, da loja a que tem acesso
    for (const proibido of [/Lucro/i, /Margem/i, /Despesas/i, /Agenda/i, /Ginásio/i]) {
      expect(main, `${proibido} não devia aparecer`).not.toMatch(proibido);
    }
    expect(await domText(page)).not.toMatch(AGENDA_MONEY);

    // Sidebar: só os subitens a que tem acesso.
    const nav = page.locator("aside:visible nav").first();
    await expect(nav.getByRole("button", { name: "Financeiro", exact: true })).toBeVisible();
    await expect(nav.getByRole("button", { name: "O Negócio", exact: true })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Loja", exact: true }).first()).toBeVisible();
    await expect(nav.getByRole("button", { name: "Despesas", exact: true })).toHaveCount(0);

    // Rede: o consolidado não traz agenda nem despesas.
    await expect.poll(() => bodies.some((b) => /negocio/.test(b.url)), { timeout: 10_000 }).toBeTruthy();
    const neg = JSON.parse(bodies.find((b) => /negocio/.test(b.url))!.text);
    expect(neg.included).toMatchObject({ loja: true });
    expect(neg.included.agenda).toBeFalsy();
    expect(neg.included.gym).toBeFalsy();
    expect(neg.included.despesas).toBeFalsy();
    expect(neg.lucro ?? null).toBeNull();
    expect(neg.margem ?? null).toBeNull();
    expect(JSON.stringify(neg)).not.toMatch(AGENDA_MONEY);
  });

  test("(ii) Financeiro → Loja: sem margem nem 'Stock parado' (sem custo nem loja.produtos)", async ({ page, context }) => {
    const bodies = captureApi(page, /\/financeiro\/loja/);
    await enter(page, context, M.dashFin, "/financeiro/loja", async () => {
      await expect(page.getByText("Faturado", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    });
    await expect(page).toHaveURL(/\/financeiro\/loja$/);
    const main = await visibleText(page);
    expect(main).toMatch(/123[.,]45/);
    expect(main).not.toMatch(/Margem/i);
    expect(main).not.toMatch(/Stock parado/i);
    expect(main).not.toMatch(/7[.,]31/); // custo de compra do produto do A
    const dom = await domText(page);
    expect(dom).not.toMatch(/Margem bruta|Stock parado/i);

    await expect.poll(() => bodies.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const loja = JSON.parse(bodies[bodies.length - 1].text);
    expect(loja.access?.cost).toBe(false);
    expect(loja.margem ?? null).toBeNull();
    expect(loja.inventory?.deadStock?.value ?? null).toBeNull();
    for (const p of loja.topProducts ?? []) {
      expect(p.stock ?? null).toBeNull();
      expect(p.margem ?? null).toBeNull();
    }
    expect(JSON.stringify(loja)).not.toMatch(/"costPrice"|"cost":[0-9]/);
  });

  test("(ii) URL directo a /financeiro/agenda (sem financeiro.agenda) é redireccionado", async ({ page, context }) => {
    await enter(page, context, M.dashFin, "/financeiro/agenda", async () => {
      await expect(page).not.toHaveURL(/\/financeiro\/agenda/, { timeout: 15_000 });
    });
    expect(await domText(page)).not.toMatch(AGENDA_MONEY);
  });
});

// ═══════════════════ (c) Notificações por membro ═══════════════════

test.describe("2c — Sino do membro", () => {
  test("(i) vê só as notificações das suas folhas; ler e eliminar são só dele", async ({ page, context, request }) => {
    await enter(page, context, M.dashSv, "/dashboard", async () => {
      await expect(bellButton(page)).toBeVisible({ timeout: 10_000 });
    });
    // 2 não lidas (agenda.marcacoes + loja.encomendas); as de mensalidades e a só-do-dono não existem para ele.
    await expect(page.getByRole("button", { name: /Notificações \(2 não lidas\)/ })).toBeVisible({ timeout: 10_000 });
    await openBell(page);
    await expect(notifItem(page, N.agenda)).toBeVisible();
    await expect(notifItem(page, N.loja)).toBeVisible();
    await expect(bellPanel(page).getByText(N.mensal)).toHaveCount(0);
    await expect(bellPanel(page).getByText(N.dono)).toHaveCount(0);
    await expect(bellPanel(page).getByText(/Basalto/)).toHaveCount(0);
    expect(await domText(page)).not.toMatch(/9146|3380|Basalto/);

    // Marcar como lida: só para ele.
    await notifItem(page, N.agenda).getByRole("button", { name: "Marcar como lida", exact: true }).click();
    await expect(page.getByRole("button", { name: /Notificações \(1 não lida/ })).toBeVisible({ timeout: 10_000 });
    await expect(notifItem(page, N.agenda).getByRole("button", { name: "Marcar como lida", exact: true })).toHaveCount(0);

    // "Eliminar" só esconde para ele (e o tooltip diz-o).
    const eliminar = notifItem(page, N.loja).getByRole("button", { name: "Eliminar" });
    await expect(eliminar).toHaveAttribute("title", /só deixa de aparecer para ti/i);
    await eliminar.click();
    await expect(notifItem(page, N.loja)).toHaveCount(0, { timeout: 10_000 });
    await expect(notifItem(page, N.agenda)).toBeVisible();

    // Depois de recarregar continua escondida para ele…
    await page.reload();
    await expect(bellButton(page)).toBeVisible({ timeout: 15_000 });
    await openBell(page);
    await expect(notifItem(page, N.agenda)).toBeVisible();
    await expect(notifItem(page, N.loja)).toHaveCount(0);

    // …mas o DONO vê tudo, tudo por ler: o "lido" do membro não é o dele e nada foi apagado.
    const dono = await notificationsApi(request, OWNER_A);
    const titles = dono.notifications.map((n) => n.title);
    expect(titles).toEqual(expect.arrayContaining([N.agenda, N.loja, N.mensal, N.dono]));
    for (const t of [N.agenda, N.loja, N.mensal, N.dono]) {
      expect(dono.notifications.find((n) => n.title === t)!.read, `"${t}" do dono não pode ficar lida`).toBe(false);
    }
    expect(dono.unread).toBeGreaterThanOrEqual(4);
  });

  test("o dono entra e vê as 4 notificações do seu tenant, todas por ler", async ({ page, context }) => {
    await enter(page, context, OWNER_A, "/dashboard", async () => {
      await expect(bellButton(page)).toBeVisible({ timeout: 10_000 });
    });
    await openBell(page);
    for (const t of [N.agenda, N.loja, N.mensal, N.dono]) {
      await expect(notifItem(page, t)).toBeVisible();
      await expect(notifItem(page, t).getByRole("button", { name: "Marcar como lida", exact: true })).toBeVisible();
    }
    // Sem tooltip de "só para ti": o dono apaga de vez.
    await expect(notifItem(page, N.dono).getByRole("button", { name: "Eliminar" })).not.toHaveAttribute("title", /.+/);
    await expect(bellPanel(page).getByText(/Basalto/)).toHaveCount(0);
  });

  test("um membro com Mensalidades vê a notificação dessa folha e não as outras", async ({ page, context, request }) => {
    // `av-total` tem todas as folhas: vê as 3 de folha e NUNCA a que é só do dono.
    const res = await notificationsApi(request, M.total);
    const titles = res.notifications.map((n) => n.title);
    expect(titles).toEqual(expect.arrayContaining([N.agenda, N.loja, N.mensal]));
    expect(titles).not.toContain(N.dono);
    expect(titles.some((t) => /Basalto/.test(t))).toBe(false);

    await enter(page, context, M.total, "/dashboard", async () => {
      await expect(bellButton(page)).toBeVisible({ timeout: 10_000 });
    });
    await openBell(page);
    await expect(notifItem(page, N.mensal)).toBeVisible();
    await expect(bellPanel(page).getByText(N.dono)).toHaveCount(0);
  });
});

// ═══════════════════ (d) Aterragem sem a folha dashboard ═══════════════════

test.describe("2c — Sem a folha 'dashboard'", () => {
  test("o membro não vê Dashboard na sidebar e aterra no primeiro módulo que tem", async ({ page, context }) => {
    const bodies = captureApi(page, /\/dashboard(\?|$)/);
    await enter(page, context, M.semDash, "/dashboard", async () => {
      await expect(page).not.toHaveURL(/\/dashboard$/, { timeout: 15_000 });
    });
    // Primeiro módulo permitido: a Agenda (ou o que o Shell escolher) — nunca o dashboard nem uma página em branco.
    await expect(page).toHaveURL(/\/(agenda|clientes)/);
    const nav = page.locator("aside:visible nav").first();
    await expect(nav.getByRole("button", { name: "Dashboard", exact: true })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Agenda", exact: true })).toBeVisible();
    // Nunca chegou a pedir o /dashboard à API (a API recusaria com 403).
    expect(bodies.filter((b) => !/"error"/.test(b.text) && /included/.test(b.text))).toHaveLength(0);
    // O sino existe mas não rebenta.
    await expect(bellButton(page)).toBeVisible();
  });

  test("a API recusa o /dashboard a quem não tem a folha (403)", async ({ request }) => {
    const res = await request.get(`${API}/dashboard?period=today`, { headers: auth(await tokenOf(request, M.semDash)) });
    expect(res.status()).toBe(403);
    expect(await res.text()).not.toMatch(AGENDA_MONEY);
  });
});

// ═══════════════════ (e) O dono vê tudo, como antes ═══════════════════

test.describe("2c — O dono não perde nada", () => {
  test("Dashboard do dono: receita, vendas, marcações, clientes e checklist, com valores", async ({ page, context }) => {
    const bodies = captureApi(page, /\/dashboard(\?|$)/);
    await enter(page, context, OWNER_A, "/dashboard", async () => {
      await expect(page.getByText("Marcações hoje", { exact: true })).toBeVisible({ timeout: 10_000 });
    });
    await expect(page.getByText("Receita de hoje")).toBeVisible();
    await expect(page.getByText("Clientes", { exact: true }).first()).toBeVisible();
    // A encomenda de hoje (123,45) é receita da loja; o dono vê o valor.
    await expect.poll(async () => await visibleText(page), { timeout: 10_000 }).toMatch(/123[.,]45/);
    await expect(page.getByText("€").first()).toBeVisible();

    await expect.poll(() => bodies.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const json = JSON.parse(bodies[bodies.length - 1].text);
    // O dono recebe os blocos de dinheiro da agenda (campo presente, mesmo que seja 0 hoje).
    expect(json.schedule.period).toHaveProperty("revenue");
    expect(json.schedule).toHaveProperty("revenueByPeriod");
    expect(json.ecommerce.period.revenue).toBeCloseTo(123.45, 2);
    expect(json.ecommerce.stockAlerts).toBeDefined();
    expect(JSON.stringify(json)).not.toMatch(/234[.,]56|Basalto/);
  });

  test("Financeiro do dono: O Negócio com lucro, margem, despesas e as 3 áreas", async ({ page, context }) => {
    await enter(page, context, OWNER_A, "/financeiro", async () => {
      await expect(page.getByText("Receita por fonte")).toBeVisible({ timeout: 10_000 });
    });
    await expect(page.getByTestId("negocio-partial")).toHaveCount(0);
    const main = await visibleText(page);
    for (const rotulo of [/Faturado/i, /Recebido/i, /Em dívida/i, /Lucro/i, /Despesas/i, /Margem/i, /Receita por fonte/i]) {
      expect(main, `o dono tem de ver ${rotulo}`).toMatch(rotulo);
    }
    expect(main).toMatch(/123[.,]45/);
    const nav = page.locator("aside:visible nav").first();
    for (const sub of ["O Negócio", "Agenda", "Loja", "Despesas"]) {
      await expect(nav.getByRole("button", { name: sub, exact: true }).first()).toBeVisible();
    }
  });

  test("Financeiro → Loja do dono: margem e stock parado presentes", async ({ page, context }) => {
    await enter(page, context, OWNER_A, "/financeiro/loja", async () => {
      await expect(page.getByText("Faturado", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    });
    await expect(page.getByText("Margem bruta")).toBeVisible();
    await expect(page.getByText("Stock parado")).toBeVisible();
    expect(await visibleText(page)).toMatch(/123[.,]45/);
  });
});

// ═══════════════════ (f) Isolamento A/B ═══════════════════

test.describe("2c — Isolamento A/B nas notificações e no dashboard", () => {
  test("o sino do dono B só tem notificações do B; o do A nunca as do B", async ({ page, context, request }) => {
    const b = await notificationsApi(request, OWNER_B);
    const titlesB = b.notifications.map((n) => n.title);
    expect(titlesB).toEqual(expect.arrayContaining([N.agendaB, N.lojaB, N.donoB]));
    expect(titlesB.some((t) => /Ametista/.test(t))).toBe(false);

    const a = await notificationsApi(request, OWNER_A);
    expect(a.notifications.map((n) => n.title).some((t) => /Basalto/.test(t))).toBe(false);

    await enter(page, context, OWNER_B, "/dashboard", async () => {
      await expect(bellButton(page)).toBeVisible({ timeout: 10_000 });
    });
    await openBell(page);
    await expect(notifItem(page, N.agendaB)).toBeVisible();
    await expect(notifItem(page, N.donoB)).toBeVisible();
    await expect(bellPanel(page).getByText(/Ametista/)).toHaveCount(0);
  });

  test("o membro do A nunca vê notificações nem receita do B (e o dono B não vê a do A)", async ({ page, context, request }) => {
    const res = await notificationsApi(request, M.dashSv);
    expect(res.notifications.map((n) => n.title).filter((t) => /Basalto/.test(t))).toEqual([]);

    const bodies = captureApi(page, /\/(dashboard|notifications)/);
    await enter(page, context, OWNER_B, "/dashboard", async () => {
      await expect(page.getByText("Marcações hoje", { exact: true })).toBeVisible({ timeout: 10_000 });
    });
    await expect.poll(async () => await visibleText(page), { timeout: 10_000 }).toMatch(/234[.,]56/);
    const all = (await domText(page)) + bodies.map((x) => x.text).join("\n");
    expect(all).not.toMatch(/123[.,]45|Ametista|77[.,]5|63[.,]25/);
  });

  test("um membro do B (acesso total) não recebe notificações do A", async ({ request }) => {
    const res = await notificationsApi(request, "av-totalb@e2e.local");
    const titles = res.notifications.map((n) => n.title);
    expect(titles).toEqual(expect.arrayContaining([N.agendaB, N.lojaB]));
    expect(titles).not.toContain(N.donoB);
    expect(titles.some((t) => /Ametista/.test(t))).toBe(false);
  });
});
