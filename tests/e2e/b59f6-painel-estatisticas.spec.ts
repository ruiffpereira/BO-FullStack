import { test, expect, request as pwRequest, type Page, type BrowserContext, type APIRequestContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { API, loginAs } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { login, mkService, mkAppt, delAppts, delService, expectNoHScroll, LARGURAS, type Headers } from "./fixtures/dinheiro";

/**
 * B59 F6 — painel, menu de Estatísticas, Estatísticas e «novo» no Financeiro/Despesas.
 *
 * Regras provadas (fichas 0.12, 0.07, 0.04):
 *   ES-12  «7 dias» e «30 dias» das Estatísticas incluem hoje (pedido `period=7d|30d` e título «Visitas ao longo do tempo»)
 *   ES-13  o item «Estatísticas» só aparece a quem tem a folha `estatisticas` (o dono vê sempre)
 *   ES-14  crescimento contra zero → «novo» (nunca 100 %)           — O Negócio e Despesas
 *   ES-15  «Marcações hoje» e «tudo confirmado» ignoram as canceladas; «Marcações · 14 dias» = total dos 14 dias (inclui o mês anterior)
 *   ES-16  o gráfico chama-se «Visitas» (série) — título «Visitas ao longo do tempo»
 *   FI-19  «Despesas do ano» soma até hoje (não inclui meses futuros)
 *   FI-20  = ES-14 no Financeiro/Despesas
 *
 * Actores: dono do `dinheiro` (Drogaria Cobalto: Agenda + Clientes + Loja + Despesas, dedicado — sem despesas no seed nem
 * marcações no período), membros do `arvoreA` (av-sover@e2e.local tem a folha `estatisticas`; av-semvalores@e2e.local não).
 * Capturas em `.capturas/ronda-grande/capturas/b59f6-*.png` — para OLHAR.
 */

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial", retries: 0 });

const criadas: string[] = [];
const DONO = "dinheiro@e2e.local";
const AGENDA = "agenda@e2e"; // só VIEW_SCHEDULE: a faixa do painel tem espaço para «Marcações · 14 dias» (máx. 4 cartões)
const SOVER = "av-sover@e2e.local"; // tem `estatisticas`
const SEM_STATS = "av-semvalores@e2e.local"; // agenda + clientes, sem `estatisticas`
const SHOTS = path.resolve(".capturas", "ronda-grande", "capturas");

async function shot(page: Page, nome: string, w: number) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `b59f6-${nome}-${w}.png`), fullPage: false });
}

/** yyyy-MM-dd no relógio da máquina (o mesmo que o browser usa em `format(now, 'yyyy-MM-dd')`). */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

async function abrir(page: Page, context: BrowserContext, user: string, url: string, pronto: () => Promise<void>) {
  await loginAs(context, user);
  await withSessionRetry(page, context, user, () => page.goto(url), pronto);
}

const sidebarNav = (page: Page) => page.locator("aside:visible nav").first();

/** Marcações do intervalo (sem canceladas), pela API do tenant. */
async function daJanela(req: APIRequestContext, h: Headers, from: string, to: string) {
  const res = await req.get(`${API}/schedule/appointments?from=${from}&to=${to}`, { headers: h });
  expect(res.ok(), `listar marcações (${res.status()})`).toBeTruthy();
  const body = await res.json();
  return (Array.isArray(body) ? body : body.rows ?? []) as { appointmentId: string; date: string; status: string }[];
}

/** Valor do cartão do painel: o botão tem aria-label «<rótulo>: <valor>». */
async function valorKpi(page: Page, rotulo: string): Promise<number> {
  const btn = page.getByRole("button", { name: new RegExp(`^${rotulo}: \\d+$`) });
  await expect(btn).toBeVisible({ timeout: 20_000 });
  const label = (await btn.getAttribute("aria-label")) ?? "";
  return Number(label.split(": ").pop());
}

// ── dados do painel (criados pela API do tenant `dinheiro`) ─────────────────────

interface Dados {
  h: Headers;
  hd: Headers;
  svc: string;
  ids: string[];
  hoje: string;
  esperadoHoje: number;
  esperado14: number;
  canceladaHoje: string;
}
let D: Dados;

test.beforeAll(async () => {
  const req = await pwRequest.newContext();
  try {
    const h = await login(req, AGENDA);
    const hd = await login(req, DONO);
    const tag = Date.now().toString(36);
    const svc = await mkService(req, h, 10, `b59f6${tag}`);
    const hoje = ymd(new Date());
    const ids: string[] = [];
    // Hoje: 1 pendente + 1 confirmada-por-criar (pendente) + 1 CANCELADA (criada hoje) → só as duas contam.
    const p1 = await mkAppt(req, h, { date: hoje, time: "09:00", serviceId: svc, name: `F6 Hoje A ${tag}` });
    const p2 = await mkAppt(req, h, { date: hoje, time: "11:00", serviceId: svc, name: `F6 Hoje B ${tag}` });
    const c1 = await mkAppt(req, h, { date: hoje, time: "15:00", serviceId: svc, name: `F6 Cancelada ${tag}` });
    const cancel = await req.put(`${API}/schedule/appointments/${c1}`, { headers: h, data: { status: "cancelled" } });
    expect(cancel.ok(), `cancelar (${cancel.status()}) ${await cancel.text()}`).toBeTruthy();
    // Janela dos 14 dias: há 13 dias (conta), há 5 dias (conta), há 14 dias (FORA), há 8 dias cancelada (não conta).
    const a13 = await mkAppt(req, h, { date: ymd(addDays(new Date(), -13)), time: "10:00", serviceId: svc, name: `F6 d13 ${tag}` });
    const a5 = await mkAppt(req, h, { date: ymd(addDays(new Date(), -5)), time: "10:00", serviceId: svc, name: `F6 d5 ${tag}` });
    const a14 = await mkAppt(req, h, { date: ymd(addDays(new Date(), -14)), time: "10:00", serviceId: svc, name: `F6 d14 ${tag}` });
    const c8 = await mkAppt(req, h, { date: ymd(addDays(new Date(), -8)), time: "10:00", serviceId: svc, name: `F6 c8 ${tag}` });
    await req.put(`${API}/schedule/appointments/${c8}`, { headers: h, data: { status: "cancelled" } });
    ids.push(p1, p2, c1, a13, a5, a14, c8);
    const dres = await req.post(`${API}/expenses`, { headers: hd, data: { date: hoje, description: `Despesa F6 novo ${tag}`, amount: 25 } });
    expect(dres.ok(), `criar despesa (${dres.status()})`).toBeTruthy();
    const dj = await dres.json();
    criadas.push((dj.expenseId ?? dj.expense?.expenseId) as string);

    const doDia = await daJanela(req, h, hoje, hoje);
    const naJanela = await daJanela(req, h, ymd(addDays(new Date(), -13)), hoje);
    D = {
      h, hd, svc, ids, hoje, canceladaHoje: `F6 Cancelada ${tag}`,
      esperadoHoje: doDia.filter((a) => a.status !== "cancelled").length,
      esperado14: naJanela.filter((a) => a.status !== "cancelled").length,
    };
    // Sanidade do cenário: há canceladas hoje (senão o teste não provava nada).
    expect(doDia.some((a) => a.status === "cancelled"), "devia haver uma cancelada hoje").toBeTruthy();
  } finally {
    await req.dispose();
  }
});

test.afterAll(async () => {
  if (!D) return;
  const req = await pwRequest.newContext();
  try {
    await delAppts(req, D.h, D.ids);
    await delService(req, D.h, D.svc);
    for (const id of criadas) await req.delete(`${API}/expenses/${id}`, { headers: D.hd }).catch(() => undefined);
  } finally {
    await req.dispose();
  }
});

// ── Painel ──────────────────────────────────────────────────────────────────────

test.describe("Painel — marcações (ES-15)", () => {
  test("ES-15: «Marcações hoje» não conta a cancelada criada hoje; a linha «Hoje» continua a mostrá-la", async ({ page, context }) => {
    await abrir(page, context, AGENDA, "/dashboard", async () => {
      await expect(page.getByRole("button", { name: /^Marcações hoje: \d+$/ })).toBeVisible({ timeout: 20_000 });
    });
    expect(await valorKpi(page, "Marcações hoje")).toBe(D.esperadoHoje);
    expect(D.esperadoHoje).toBeGreaterThanOrEqual(2);
    // A linha do tempo mostra a cancelada com o seu estado (só as contagens a ignoram).
    await expect(page.getByText(D.canceladaHoje).first()).toBeVisible();
    // «N hoje» do título da secção «Hoje» também ignora a cancelada.
    await expect(page.getByText(`${D.esperadoHoje} hoje`, { exact: true })).toBeVisible();
  });

  test("ES-15: a cancelada de hoje não conta para a frase — com as outras confirmadas diz «tudo confirmado»", async ({ page, context }) => {
    await abrir(page, context, AGENDA, "/dashboard", async () => {
      await expect(page.getByRole("button", { name: /^Marcações hoje: \d+$/ })).toBeVisible({ timeout: 20_000 });
    });
    // As marcações do BO nascem confirmadas; a cancelada (criada hoje) não pode estragar o «tudo confirmado» nem somar ao número.
    await expect(page.getByRole("button", { name: /^Marcações hoje: \d+$/ })).toContainText("tudo confirmado");
    await expect(page.getByRole("button", { name: /^Marcações hoje: \d+$/ })).not.toContainText("por confirmar");
  });

  test("ES-15: «Marcações · 14 dias» mostra o total dos 14 dias (sem canceladas, sem o dia 15)", async ({ page, context }) => {
    await abrir(page, context, AGENDA, "/dashboard", async () => {
      await expect(page.getByRole("button", { name: /^Marcações · 14 dias: \d+$/ })).toBeVisible({ timeout: 20_000 });
    });
    expect(await valorKpi(page, "Marcações · 14 dias")).toBe(D.esperado14);
    // Pelo menos hoje (2) + d5 + d13 e o d14/cancelada de fora: 4 mínimo.
    expect(D.esperado14).toBeGreaterThanOrEqual(4);
  });

  test("ES-15: nos primeiros 13 dias do mês a janela inclui o mês anterior (relógio no dia 5 do mês seguinte)", async ({ page, context }) => {
    const alvo = new Date();
    alvo.setDate(1);
    alvo.setMonth(alvo.getMonth() + 1);
    alvo.setDate(5);
    alvo.setHours(12, 0, 0, 0);
    const req = await pwRequest.newContext();
    const ids: string[] = [];
    try {
      const tag = Date.now().toString(36);
      const fronteira = ymd(addDays(alvo, -13)); // mês anterior, dentro da janela
      const fora = ymd(addDays(alvo, -14)); // fora
      const dentro = ymd(alvo); // dia do relógio, dentro
      ids.push(await mkAppt(req, D.h, { date: fronteira, time: "10:00", serviceId: D.svc, name: `F6 prev13 ${tag}` }));
      ids.push(await mkAppt(req, D.h, { date: fora, time: "10:00", serviceId: D.svc, name: `F6 prev14 ${tag}` }));
      ids.push(await mkAppt(req, D.h, { date: dentro, time: "10:00", serviceId: D.svc, name: `F6 prev0 ${tag}` }));
      const canc = await mkAppt(req, D.h, { date: dentro, time: "12:00", serviceId: D.svc, name: `F6 prevC ${tag}` });
      await req.put(`${API}/schedule/appointments/${canc}`, { headers: D.h, data: { status: "cancelled" } });
      ids.push(canc);
      const esperado = (await daJanela(req, D.h, fronteira, dentro)).filter((a) => a.status !== "cancelled").length;
      expect(esperado).toBeGreaterThanOrEqual(2);

      await page.clock.setFixedTime(alvo);
      await abrir(page, context, AGENDA, "/dashboard", async () => {
        await expect(page.getByRole("button", { name: /^Marcações · 14 dias: \d+$/ })).toBeVisible({ timeout: 20_000 });
      });
      expect(await valorKpi(page, "Marcações · 14 dias")).toBe(esperado);
    } finally {
      await delAppts(req, D.h, ids);
      await req.dispose();
    }
  });
});

// ── Menu (ES-13) ────────────────────────────────────────────────────────────────

test.describe("Menu — Estatísticas só com a folha (ES-13)", () => {
  test("ES-13: o dono vê «Estatísticas» no menu", async ({ page, context }) => {
    await abrir(page, context, DONO, "/dashboard", async () => {
      await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
    });
    await expect(sidebarNav(page).getByRole("button", { name: "Estatísticas", exact: true })).toBeVisible();
  });

  test("ES-13: membro COM a folha `estatisticas` vê o item e abre a página", async ({ page, context }) => {
    await abrir(page, context, SOVER, "/estatisticas", async () => {
      await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe("/estatisticas");
    });
    await expect(sidebarNav(page).getByRole("button", { name: "Estatísticas", exact: true })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/something went wrong|erro inesperado/i);
  });

  test("ES-13: membro SEM a folha não vê o item e a rota directa não abre um ecrã partido", async ({ page, context }) => {
    await abrir(page, context, SEM_STATS, "/dashboard", async () => {
      await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
    });
    await expect(sidebarNav(page).getByRole("button", { name: "Estatísticas", exact: true })).toHaveCount(0);
    // O membro só tem Agenda + Clientes: o menu mostra isso mesmo (sanidade: o menu carregou).
    await expect(sidebarNav(page).getByRole("button", { name: "Agenda", exact: true })).toBeVisible();

    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(e.message));
    await withSessionRetry(page, context, SEM_STATS, () => page.goto("/estatisticas"), async () => {
      await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
      // O guard leva-o a um módulo que tem: nunca fica em /estatisticas.
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).not.toBe("/estatisticas");
    });
    await expect(page.locator("main")).not.toContainText(/Visitas ao longo do tempo|Não foi possível obter as estatísticas/);
    expect(erros, "sem excepções na página").toEqual([]);
  });
});

// ── Estatísticas (ES-12, ES-16) ─────────────────────────────────────────────────

const ANALYTICS = {
  configured: true,
  domain: "e2e.example",
  aggregate: { visitors: { value: 42 }, pageviews: { value: 120 }, bounce_rate: { value: 35 }, visit_duration: { value: 125 } },
  timeseries: [
    { date: "2026-10-18", visitors: 3 }, { date: "2026-10-19", visitors: 8 }, { date: "2026-10-20", visitors: 5 },
    { date: "2026-10-21", visitors: 12 }, { date: "2026-10-22", visitors: 7 }, { date: "2026-10-23", visitors: 9 }, { date: "2026-10-24", visitors: 4 },
  ],
  topPages: [{ page: "/", visitors: 30 }, { page: "/servicos", visitors: 12 }],
  sources: [{ source: "google.com", visitors: 20 }, { source: "Direto", visitors: 22 }],
};

async function mockAnalytics(page: Page, periodos: string[]) {
  await page.route("**/analytics/site**", (route) => {
    periodos.push(new URL(route.request().url()).searchParams.get("period") ?? "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ANALYTICS) });
  });
}

test.describe("Estatísticas — «Visitas» e períodos", () => {
  test("ES-16: o gráfico chama-se «Visitas ao longo do tempo» e o KPI «Visitantes» continua distinto", async ({ page, context }) => {
    const periodos: string[] = [];
    await mockAnalytics(page, periodos);
    await abrir(page, context, DONO, "/estatisticas", async () => {
      await expect(page.getByRole("heading", { name: "Visitas ao longo do tempo" })).toBeVisible({ timeout: 20_000 });
    });
    await expect(page.getByText("Visitantes", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Visitantes ao longo do tempo/)).toHaveCount(0);
  });

  test("ES-12: «7 dias» e «30 dias» pedem period=7d / 30d à API (que inclui hoje)", async ({ page, context }) => {
    const periodos: string[] = [];
    await mockAnalytics(page, periodos);
    await abrir(page, context, DONO, "/estatisticas", async () => {
      await expect(page.getByRole("heading", { name: "Visitas ao longo do tempo" })).toBeVisible({ timeout: 20_000 });
    });
    await page.getByRole("button", { name: "7 dias", exact: true }).click();
    await expect.poll(() => periodos).toContain("7d");
    await page.getByRole("button", { name: "30 dias", exact: true }).click();
    await expect.poll(() => periodos).toContain("30d");
    await expect(page.getByRole("heading", { name: "Visitas ao longo do tempo" })).toBeVisible();
  });
});

// ── «novo» (ES-14 / FI-20) e «Despesas do ano» (FI-19) ──────────────────────────

test.describe("Financeiro e Despesas — «novo» e ano até hoje", () => {
  async function mkDespesa(req: APIRequestContext, date: string, description: string, amount: number): Promise<string> {
    const res = await req.post(`${API}/expenses`, { headers: D.hd, data: { date, description, amount } });
    expect(res.ok(), `criar despesa (${res.status()}) ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    const id = (body.expenseId ?? body.expense?.expenseId) as string;
    expect(id).toBeTruthy();
    criadas.push(id);
    return id;
  }

  test("ES-14/FI-20: Despesas — mês com despesas contra um mês anterior a 0 € mostra «novo» (não 100 %)", async ({ page, context }) => {
    await abrir(page, context, DONO, "/financeiro/despesas", async () => {
      await expect(page.getByText("Despesas do mês", { exact: true })).toBeVisible({ timeout: 20_000 });
    });
    const cartao = page.getByText("Despesas do mês", { exact: true }).locator("xpath=ancestor::*[contains(@class,'p-5')][1]");
    await expect(cartao.getByText("novo", { exact: true })).toBeVisible();
    await expect(cartao).not.toContainText("100%");
  });

  test("FI-19: «Despesas do ano» soma até hoje — uma despesa de um dia futuro do mesmo ano não entra", async ({ page, context }) => {
    const amanha = addDays(new Date(), 1);
    test.skip(amanha.getFullYear() !== new Date().getFullYear(), "31 de Dezembro: não há dia futuro no mesmo ano");
    const req = await pwRequest.newContext();
    try {
      await abrir(page, context, DONO, "/financeiro/despesas", async () => {
        await expect(page.getByText("Despesas do ano", { exact: true })).toBeVisible({ timeout: 20_000 });
      });
      const valorAno = async () => {
        const c = page.getByText("Despesas do ano", { exact: true }).locator("xpath=ancestor::*[contains(@class,'p-5')][1]");
        return (await c.innerText()).replace(/\s+/g, " ");
      };
      const antes = await valorAno();
      const futura = await mkDespesa(req, ymd(amanha), `Despesa F6 futura ${Date.now()}`, 777);
      expect(futura).toBeTruthy();
      await page.reload();
      await expect(page.getByText("Despesas do ano", { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect.poll(valorAno, { timeout: 10_000 }).toBe(antes);
      expect(await valorAno()).not.toContain("777");
    } finally {
      await req.dispose();
    }
  });

  test("ES-14/FI-20: O Negócio — receita contra um período anterior sem receita mostra «novo» (nunca 100 %)", async ({ page, context }) => {
    await abrir(page, context, DONO, "/financeiro", async () => {
      await expect(page.getByText(/receita|faturado|Receita/i).first()).toBeVisible({ timeout: 20_000 });
    });
    await expect(page.getByText("novo", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    // A «Saúde do negócio» explica-o por extenso; o «100 %» que sobra na página é a quota da Loja, nunca um crescimento.
    await expect(page.getByText("novo (sem receita no período anterior)")).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/Crescimento de receita[^n]*100%/);
  });
});

// ── Responsivo 1440 / 834 / 390 ─────────────────────────────────────────────────

test.describe("Responsivo — painel, Estatísticas, O Negócio, Despesas", () => {
  for (const vp of LARGURAS) {
    test(`${vp.label}: sem scroll horizontal, «novo» legível, capturas`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const periodos: string[] = [];
      await mockAnalytics(page, periodos);

      await abrir(page, context, AGENDA, "/dashboard", async () => {
        await expect(page.getByRole("button", { name: /^Marcações · 14 dias: \d+$/ })).toBeVisible({ timeout: 20_000 });
      });
      await expectNoHScroll(page);
      await shot(page, "painel", vp.width);

      await page.goto("/estatisticas");
      await expect(page.getByRole("heading", { name: "Visitas ao longo do tempo" })).toBeVisible({ timeout: 20_000 });
      await expectNoHScroll(page);
      await shot(page, "estatisticas", vp.width);

      await loginAs(context, DONO);
      await withSessionRetry(page, context, DONO, () => page.goto("/financeiro"), async () => {
        await expect(page.getByText("novo", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
      });
      const novo = page.getByText("novo", { exact: true }).first();
      await expect(novo).toBeVisible({ timeout: 20_000 });
      await novo.scrollIntoViewIfNeeded();
      const caixa = (await novo.boundingBox())!;
      expect(caixa.x, "«novo» dentro do ecrã").toBeGreaterThanOrEqual(0);
      expect(caixa.x + caixa.width, "«novo» dentro do ecrã").toBeLessThanOrEqual(vp.width + 1);
      expect(await novo.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "«novo» não cortado").toBeTruthy();
      await expectNoHScroll(page);
      await shot(page, "o-negocio", vp.width);

      await page.goto("/financeiro/despesas");
      await expect(page.getByText("Despesas do mês", { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText("novo", { exact: true }).first()).toBeVisible();
      await expectNoHScroll(page);
      await shot(page, "despesas", vp.width);
    });
  }
});
