import { test, expect, request as pwRequest, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { API, loginAs } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import {
  LARGURAS, eur, login, mkService, mkCustomer, mkAppt, pay, getAppt, delAppts, delService, expectNoHScroll, type Headers,
} from "./fixtures/dinheiro";
import { DespesasPage } from "./pages/DespesasPage";

/**
 * B57 · F3 — dinheiro e dívida vêm da API (o Backoffice só os mostra).
 *
 * Regras provadas: AG-06 (anular dentro de «Editar pagamento»), AG-07 (serviço mais caro → confirmada com dívida),
 * AG-18 (dívida: 0,29×3 contra 0,87 não é dívida), AG-19 (lista «Marcações» paginada e pesquisada no servidor),
 * AG-20 (dívida anterior igual no Calendário e nas Marcações; homónimo sem customerId não herda), LJ-05 (stock baixo ≤ 5),
 * LJ-11 (total faturado só das pagas — sem pending, canceladas nem reembolsadas; encomendas > 1 página), FI-05 (escrita de dinheiro refresca
 * Dashboard e O Negócio sem recarregar), FI-06 (euros pt-PT), EQ-06 (sem `valores` não há dívida nem euros).
 *
 * Actores (seed `API-FullStack/scripts/seedE2e.ts`):
 *   dono           dinheiro@e2e.local  («Drogaria Cobalto»: 24 encomendas, 5 produtos, 30 marcações «Pag Cobalto NN»)
 *   dono           arvore-a@e2e.local  + membros av-semvalores (marcações Editar, sem valores), av-sover (tudo Ver),
 *                                       av-comvalores (marcações + valores Editar)
 *   dono           tenantA@e2e         (Despesas do mês, só para o formato dos euros)
 *
 * As marcações dos testes criam-se pela API no próprio tenant (2030, não pisam o semeado) e apagam-se no fim.
 * Capturas em `.capturas/ronda-grande/capturas/b57-f3-*.png` — para OLHAR.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const DONO = "dinheiro@e2e.local";
const ARVORE = "arvore-a@e2e.local";
const SEM_VALORES = "av-semvalores@e2e.local";
const SO_VER = "av-sover@e2e.local";
const COM_VALORES = "av-comvalores@e2e.local";

const SHOTS = path.resolve(".capturas", "ronda-grande", "capturas");
const NBSP = String.fromCharCode(160);

async function shot(page: Page, nome: string, w: number) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `b57-f3-${nome}-${w}.png`) });
}

// ── dados criados pela API (uma vez por worker) ─────────────────────────────────

interface Dados {
  h: Headers;
  tag: string;
  svc20: string;
  svc30: string;
  svc087: string;
  customerId: string;
  homonimo: string; // nome partilhado pelas 3 marcações do AG-20
  cent: string; // nome da marcação 0,29×3 / 0,87
  troca: string; // nome da marcação do AG-07
  ids: string[];
}

let D: Dados;

test.beforeAll(async () => {
  const req = await pwRequest.newContext();
  try {
    const h = await login(req, DONO);
    const tag = Date.now().toString(36);
    const svc20 = await mkService(req, h, 20, `a${tag}`);
    const svc30 = await mkService(req, h, 30, `b${tag}`);
    const svc087 = await mkService(req, h, 0.87, `c${tag}`);
    const customerId = await mkCustomer(req, h, `Hom Cliente ${tag}`);
    const ids: string[] = [];
    const homonimo = `Hom ${tag}`;
    // AG-20: A1 concluída com dívida (20 − 5), A2 confirmada do MESMO cliente, A3 homónimo SEM cliente.
    const a1 = await mkAppt(req, h, { date: "2030-04-10", time: "09:00", serviceId: svc20, name: homonimo, customerId });
    await pay(req, h, a1, { paymentCash: 5 });
    const a2 = await mkAppt(req, h, { date: "2030-04-10", time: "10:00", serviceId: svc20, name: homonimo, customerId });
    const a3 = await mkAppt(req, h, { date: "2030-04-10", time: "11:00", serviceId: svc20, name: homonimo });
    // AG-18: 0,29 × 3 contra 0,87.
    const cent = `Cent ${tag}`;
    const c1 = await mkAppt(req, h, { date: "2030-04-12", time: "10:00", serviceId: svc087, name: cent });
    await pay(req, h, c1, { paymentCash: 0.29, paymentMbway: 0.29, paymentCard: 0.29 });
    // AG-07: paga por inteiro (20) e depois troca para o serviço de 30 → volta a confirmada com dívida 10.
    const troca = `Troca ${tag}`;
    const t1 = await mkAppt(req, h, { date: "2030-04-13", time: "10:00", serviceId: svc20, name: troca });
    await pay(req, h, t1, { paymentCash: 20 });
    const sw = await req.put(`${API}/schedule/appointments/${t1}`, { headers: h, data: { serviceId: svc30 } });
    expect(sw.ok(), `trocar serviço (${sw.status()}) ${await sw.text()}`).toBeTruthy();
    ids.push(a1, a2, a3, c1, t1);
    D = { h, tag, svc20, svc30, svc087, customerId, homonimo, cent, troca, ids };
  } finally {
    await req.dispose();
  }
});

test.afterAll(async () => {
  if (!D) return;
  const req = await pwRequest.newContext();
  try {
    await delAppts(req, D.h, D.ids);
    for (const s of [D.svc20, D.svc30, D.svc087]) await delService(req, D.h, s);
  } finally {
    await req.dispose();
  }
});

// ── ajudantes de UI ─────────────────────────────────────────────────────────────

async function abrir(page: Page, context: BrowserContext, user: string, url: string, pronto: () => Promise<void>) {
  await loginAs(context, user);
  await withSessionRetry(page, context, user, () => page.goto(url), pronto);
}

/** Lista «Marcações» → pesquisa pelo nome → linhas. */
async function procurar(page: Page, termo: string) {
  const q = page.getByPlaceholder("Nome, email ou telefone…");
  await expect(q).toBeVisible({ timeout: 15_000 });
  await q.fill(termo);
  return page.locator("tbody tr").filter({ hasText: termo });
}

function modal(page: Page) {
  return page.getByRole("dialog").filter({ hasText: "Marcação" }).first();
}

async function separadorPagamento(page: Page) {
  const dlg = modal(page);
  await dlg.getByRole("tab", { name: "Pagamento", exact: true }).click();
  return dlg;
}

/** Navegação dentro da app, SEM recarregar (o React Router ouve o `popstate`). */
async function irSemRecarregar(page: Page, rota: string) {
  await page.evaluate((r) => {
    window.history.pushState({}, "", r);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, rota);
  await page.waitForURL(`**${rota}`, { timeout: 10_000 });
}

/** «1.234,50 €» → 1234.5 */
const numero = (txt: string) => Number(txt.replace(/[^\d,]/g, "").replace(",", "."));

const mostraEuros = (txt: string) => txt.match(/[\d.,]+\s?€|€\s?[\d.,]+/g) ?? [];
/** Euros mal formatados: ponto decimal («12.50 €») ou símbolo à frente («€12,50»). */
function eurosMalFormatados(txt: string) {
  return mostraEuros(txt).filter((m) => /^€/.test(m) || /\d\.\d{2}\s?€/.test(m));
}

async function abrirMarcacoes(page: Page, context: BrowserContext, user: string) {
  await abrir(page, context, user, "/agenda/marcacoes", async () => {
    await expect(page.getByPlaceholder("Nome, email ou telefone…")).toBeVisible({ timeout: 15_000 });
  });
}

// ═══ AGENDA — dono ═════════════════════════════════════════════════════════════

for (const vp of LARGURAS) {
  test.describe(`B57 F3 · Agenda — dinheiro (${vp.label})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("AG-06: «Anular pagamento» só dentro de «Editar pagamento», pede confirmação e a marcação volta a confirmada, sem pagamentos", async ({ page, context, request }) => {
      const nome = `Anula ${vp.label} ${D.tag}`;
      const id = await mkAppt(request, D.h, { date: "2030-04-14", time: "10:00", serviceId: D.svc20, name: nome });
      D.ids.push(id);
      await pay(request, D.h, id, { paymentCash: 20 });

      await abrirMarcacoes(page, context, DONO);
      const linha = await procurar(page, nome);
      await expect(linha).toHaveCount(1, { timeout: 10_000 });
      await linha.click();
      const dlg = await separadorPagamento(page);

      // Fora do modo edição não há «Anular pagamento» (é um passo dentro de «Editar pagamento»).
      await expect(dlg.getByRole("button", { name: "Editar pagamento" })).toBeVisible();
      await expect(dlg.getByRole("button", { name: "Anular pagamento" })).toHaveCount(0);
      await dlg.getByRole("button", { name: "Editar pagamento" }).click();
      const anular = dlg.getByRole("button", { name: "Anular pagamento" });
      await expect(anular).toBeVisible();
      await expect(anular).toBeEnabled();
      await shot(page, "anular-editar", vp.width);

      // Pede confirmação: «Cancelar» não grava nada.
      await anular.click();
      const confirma = page.getByRole("dialog").filter({ hasText: "Anular o pagamento registado?" });
      await expect(confirma).toBeVisible();
      await confirma.getByRole("button", { name: "Cancelar" }).click();
      await expect(confirma).toHaveCount(0);
      const intacta = await getAppt(request, D.h, id);
      expect(intacta.status).toBe("completed");
      expect(Number(intacta.paymentCash)).toBe(20);

      // Confirmar anula: o PUT leva `cancelPayment` e a marcação fica confirmada, sem pagamentos.
      await anular.click();
      const put = page.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes(`/schedule/appointments/${id}`));
      await confirma.getByRole("button", { name: "Anular pagamento" }).click();
      const res = await put;
      expect(res.request().postDataJSON()).toMatchObject({ cancelPayment: true });
      expect(res.status()).toBeLessThan(300);

      await expect.poll(async () => (await getAppt(request, D.h, id)).status).toBe("confirmed");
      const depois = await getAppt(request, D.h, id);
      expect(Number(depois.paymentCash ?? 0) + Number(depois.paymentMbway ?? 0) + Number(depois.paymentCard ?? 0)).toBe(0);
      expect(depois.paidAt ?? null).toBeNull();

      await page.keyboard.press("Escape");
      const nova = page.locator("tbody tr").filter({ hasText: nome });
      await expect(nova).toContainText("Confirmada", { timeout: 10_000 });
      await expect(nova).not.toContainText("Pago");
      await expect(nova).not.toContainText("Dívida");
      await expectNoHScroll(page);
    });

    test("AG-18: marcação paga com 0,29 + 0,29 + 0,29 contra 0,87 mostra «Pago» e nunca «Dívida 0,00 €»", async ({ page, context, request }) => {
      const api = await getAppt(request, D.h, D.ids[3]);
      expect(Number(api.debt)).toBe(0);

      await abrirMarcacoes(page, context, DONO);
      const linha = await procurar(page, D.cent);
      await expect(linha).toHaveCount(1, { timeout: 10_000 });
      if (vp.width >= 768) {
        // A coluna «Pago» só existe a partir de md.
        await expect(linha).toContainText("Pago");
        await expect(linha).not.toContainText("Dívida");
      }
      await linha.click();
      const dlg = modal(page);
      await expect(dlg.getByText("Pago", { exact: true }).first()).toBeVisible();
      await expect(dlg.getByText(/Dívida/)).toHaveCount(0);
      await separadorPagamento(page);
      await expect(dlg.getByText(/Em dívida/)).toHaveCount(0);
      await expect(dlg.getByText(/Dívida/)).toHaveCount(0);
      await expect(dlg.getByText(eur("0,87")).first()).toBeVisible();
    });

    test("AG-07 + AG-18: trocar para um serviço mais caro numa marcação concluída e paga volta-a confirmada, com a diferença em dívida (10,00 €)", async ({ page, context, request }) => {
      const api = await getAppt(request, D.h, D.ids[4]);
      expect(api.status).toBe("confirmed");
      expect(Number(api.debt)).toBe(10);

      await abrirMarcacoes(page, context, DONO);
      const linha = await procurar(page, D.troca);
      await expect(linha).toHaveCount(1, { timeout: 10_000 });
      await expect(linha).toContainText("Confirmada");
      if (vp.width >= 768) await expect(linha).toContainText(eur("10,00"));
      await linha.click();
      await expect(modal(page).getByText(/Dívida/).first()).toContainText(eur("10,00"));
    });

    test("AG-20: a dívida anterior é igual no Calendário e nas Marcações, e o homónimo sem cliente não herda", async ({ page, context, request }) => {
      // A API: A2 (mesmo cliente que a A1 em dívida) vê 15,00 €; A3 (homónimo, sem customerId) vê 0.
      const r = await request.get(`${API}/schedule/appointments/page?q=${encodeURIComponent(D.homonimo)}&limit=100`, { headers: D.h });
      expect(r.ok()).toBeTruthy();
      const rows = ((await r.json()) as { rows: { time: string; priorDebt: number; debt: number }[] }).rows;
      const por = (hhmm: string) => rows.find((x) => x.time.startsWith(hhmm))!;
      expect(por("09:00").debt).toBe(15);
      expect(por("10:00").priorDebt).toBe(15);
      expect(por("11:00").priorDebt).toBe(0);

      const AVISO = /Este cliente tem 15,00\s€ em dívida de marcações anteriores/;
      // ── Marcações ──
      await abrirMarcacoes(page, context, DONO);
      const linhas = await procurar(page, D.homonimo);
      await expect(linhas).toHaveCount(3, { timeout: 10_000 });
      await linhas.filter({ hasText: "10:00" }).click();
      let dlg = await separadorPagamento(page);
      await expect(dlg.getByText(AVISO)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dlg).toHaveCount(0);
      await linhas.filter({ hasText: "11:00" }).click();
      dlg = await separadorPagamento(page);
      await expect(dlg.getByText(/em dívida de marcações anteriores/)).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(dlg).toHaveCount(0);

      // ── Calendário (a semana de 2030-04-10) ──
      await withSessionRetry(page, context, DONO, () => page.goto("/agenda?data=2030-04-10"), async () => {
        await expect(page.getByRole("button", { name: "Nova marcação" })).toBeVisible({ timeout: 15_000 });
      });
      const bloco = (hora: string) => page.getByRole("button", { name: new RegExp(`^${hora}[–-]\\d{2}:\\d{2} ${D.homonimo}`) });
      const abrirBloco = async (hora: string) => {
        const b = bloco(hora);
        await expect(b).toBeVisible({ timeout: 15_000 });
        await b.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
        await b.click();
        return separadorPagamento(page);
      };
      dlg = await abrirBloco("10:00");
      await expect(dlg.getByText(AVISO)).toBeVisible();
      await shot(page, "divida-anterior-calendario", vp.width);
      await page.keyboard.press("Escape");
      await expect(dlg).toHaveCount(0);
      dlg = await abrirBloco("11:00");
      await expect(dlg.getByText(/em dívida de marcações anteriores/)).toHaveCount(0);
    });
  });
}

// ═══ AGENDA — Marcações paginadas no servidor (AG-19) ══════════════════════════════

for (const vp of LARGURAS) {
  test.describe(`B57 F3 · Marcações paginam e pesquisam no servidor (${vp.label})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("AG-19: o separador pede /schedule/appointments/page (nunca a lista toda), a página 2 funciona e a pesquisa vai ao servidor", async ({ page, context }) => {
      const pedidos: string[] = [];
      page.on("request", (r) => {
        if (r.url().startsWith(API) && /\/schedule\/appointments(\/page)?\?|\/schedule\/appointments$/.test(r.url())) pedidos.push(r.url());
      });
      await abrirMarcacoes(page, context, DONO);
      const linhas = page.locator("tbody tr");
      await expect(linhas).toHaveCount(25, { timeout: 15_000 });
      await expect(page.getByText("1–25")).toBeVisible();

      // Nenhum pedido à lista inteira: só `/page`, com `page` e `limit`.
      const lista = pedidos.filter((u) => !new URL(u).pathname.endsWith("/page"));
      expect(lista, `pedidos à lista inteira: ${lista.join(" | ")}`).toHaveLength(0);
      const primeira = pedidos.map((u) => new URL(u)).find((u) => u.pathname.endsWith("/schedule/appointments/page"));
      expect(primeira, "o separador devia pedir /schedule/appointments/page").toBeTruthy();
      expect(primeira!.searchParams.get("page")).toBe("1");
      expect(primeira!.searchParams.get("limit")).toBe("25");

      // Página 2 (a 390 também): pede page=2 ao servidor e mostra as restantes.
      const seguinte = page.getByRole("button", { name: "Página seguinte" });
      await seguinte.scrollIntoViewIfNeeded();
      const p2 = page.waitForRequest((r) => r.url().includes("/schedule/appointments/page") && new URL(r.url()).searchParams.get("page") === "2");
      await seguinte.click();
      await p2;
      await expect.poll(async () => linhas.count()).toBeGreaterThanOrEqual(5);
      expect(await linhas.count()).toBeLessThanOrEqual(25);
      await expect(page.getByText("26–")).toBeVisible();
      await expectNoHScroll(page);
      await shot(page, "marcacoes-pagina2", vp.width);

      // Pesquisa no servidor: o termo vai em `q`, volta à página 1 e a lista encolhe para o que o servidor devolveu.
      const q = page.getByPlaceholder("Nome, email ou telefone…");
      const pq = page.waitForRequest((r) => r.url().includes("/schedule/appointments/page") && new URL(r.url()).searchParams.get("q") === "Pag Cobalto 07");
      await q.fill("Pag Cobalto 07");
      const pedido = new URL((await pq).url());
      expect(pedido.searchParams.get("page")).toBe("1");
      await expect(linhas).toHaveCount(1, { timeout: 10_000 });
      await expect(page.getByText("1 marcação", { exact: true })).toBeVisible();
      await expect(linhas.first()).toContainText("Pag Cobalto 07");
    });
  });
}

// ═══ AGENDA — membros (EQ-06) e o que lhes cabe ═════════════════════════════════════

test.describe("B57 F3 · Agenda — dinheiro por actor (1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("AG-18 / EQ-06: o dono vê «Dívida 43,25 €»; sem `valores` não há coluna «Pago», nem dívida, nem campos de dinheiro na resposta", async ({ page, context, browser }) => {
    // Dono: a marcação semeada «Marc Ametista Divida» (63,25 − 20).
    await abrirMarcacoes(page, context, ARVORE);
    const dono = await procurar(page, "Marc Ametista Divida");
    await expect(dono).toHaveCount(1, { timeout: 10_000 });
    await expect(dono).toContainText(eur("43,25"));
    await expect(page.getByRole("columnheader", { name: "Pago" })).toBeVisible();

    // Membro sem `agenda.marcacoes.valores`: a API nem envia os campos, o ecrã não mostra nada de dinheiro.
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await ctx2.newPage();
    try {
      await loginAs(ctx2, SEM_VALORES);
      const resposta = p2.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/schedule/appointments/page") && r.status() === 200, { timeout: 20_000 });
      await withSessionRetry(p2, ctx2, SEM_VALORES, () => p2.goto("/agenda/marcacoes"), async () => {
        await expect(p2.getByPlaceholder("Nome, email ou telefone…")).toBeVisible({ timeout: 15_000 });
      });
      const corpo = (await (await resposta).json()) as { rows: Record<string, unknown>[] };
      expect(corpo.rows.length).toBeGreaterThan(0);
      for (const row of corpo.rows) {
        for (const campo of ["debt", "priorDebt", "servicePrice", "paymentCash", "paymentMbway", "paymentCard", "paidAt", "paymentHistory"]) {
          expect(row, `o campo ${campo} não devia existir sem a folha valores`).not.toHaveProperty(campo);
        }
      }
      const linha = await procurar(p2, "Marc Ametista Divida");
      await expect(linha).toHaveCount(1, { timeout: 10_000 });
      await expect(linha).not.toContainText("Dívida");
      await expect(linha).not.toContainText("Pago");
      await expect(linha).not.toContainText("€");
      await expect(p2.getByRole("columnheader", { name: "Pago" })).toHaveCount(0);
      await linha.click();
      const dlg = p2.getByRole("dialog").first();
      await expect(dlg).toBeVisible();
      await expect(dlg.getByRole("tab", { name: "Pagamento", exact: true })).toHaveCount(0);
      await expect(dlg.getByText(/Dívida|dívida|€/)).toHaveCount(0);
    } finally {
      await ctx2.close();
    }
  });

  test("EQ-06: a ficha do cliente mostra a dívida da API ao dono (43,25 €) e nada de dívida a quem não tem `valores`", async ({ page, context, request, browser }) => {
    const h = await login(request, ARVORE);
    const r = await request.get(`${API}/schedule/appointments/page?q=${encodeURIComponent("Marc Ametista Divida")}&limit=5`, { headers: h });
    const customerId = ((await r.json()) as { rows: { customerId: string }[] }).rows[0].customerId;
    expect(customerId).toBeTruthy();

    await abrir(page, context, ARVORE, `/clientes?cliente=${customerId}`, async () => {
      await expect(page.getByText("Cliente Ametista Rosa").first()).toBeVisible({ timeout: 15_000 });
    });
    await expect(page.getByText(/Este cliente tem 43,25\s€ em dívida\./)).toBeVisible({ timeout: 10_000 });

    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await ctx2.newPage();
    try {
      await loginAs(ctx2, SEM_VALORES);
      await withSessionRetry(p2, ctx2, SEM_VALORES, () => p2.goto(`/clientes?cliente=${customerId}`), async () => {
        await expect(p2.getByText("Cliente Ametista Rosa").first()).toBeVisible({ timeout: 15_000 });
      });
      await expect(p2.getByText(/em dívida/)).toHaveCount(0);
      await expect(p2.getByText(/Este cliente tem/)).toHaveCount(0);
    } finally {
      await ctx2.close();
    }
  });

  test("AG-06 / EQ-07: com `valores` (editar) o «Anular pagamento» aparece em «Editar pagamento»; só-ver nunca o tem activo", async ({ page, context, request, browser }) => {
    const h = await login(request, ARVORE);
    const svc = (await (await request.get(`${API}/schedule/services`, { headers: h })).json()) as { serviceId: string }[] | { rows: { serviceId: string }[] };
    const serviceId = (Array.isArray(svc) ? svc : svc.rows)[0].serviceId;
    const nome = `Anula Membro ${D.tag}`;
    const id = await mkAppt(request, h, { date: "2030-04-15", time: "10:00", serviceId, name: nome });
    try {
      await pay(request, h, id, { paymentCash: 10 });

      // av-comvalores: marcações + valores Editar → «Editar pagamento» → «Anular pagamento» activo.
      await abrirMarcacoes(page, context, COM_VALORES);
      await (await procurar(page, nome)).click();
      const dlg = await separadorPagamento(page);
      await dlg.getByRole("button", { name: "Editar pagamento" }).click();
      await expect(dlg.getByRole("button", { name: "Anular pagamento" })).toBeEnabled();

      // av-sover: tudo em Ver → vê o dinheiro (valores Ver) mas não pode editar nem anular.
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p2 = await ctx2.newPage();
      try {
        await loginAs(ctx2, SO_VER);
        await withSessionRetry(p2, ctx2, SO_VER, () => p2.goto("/agenda/marcacoes"), async () => {
          await expect(p2.getByPlaceholder("Nome, email ou telefone…")).toBeVisible({ timeout: 15_000 });
        });
        const linha = await procurar(p2, nome);
        await expect(linha).toHaveCount(1, { timeout: 10_000 });
        await expect(linha).toContainText("Dívida"); // vê o dinheiro (10 pagos de 40)
        await linha.click();
        const d2 = await separadorPagamento(p2);
        for (const nomeBotao of ["Editar pagamento", "Anular pagamento", "Guardar pagamento"]) {
          const botoes = d2.getByRole("button", { name: nomeBotao });
          const n = await botoes.count();
          for (let i = 0; i < n; i++) await expect(botoes.nth(i), `«${nomeBotao}» não pode estar activo para um membro só-ver`).toBeDisabled();
        }
      } finally {
        await ctx2.close();
      }
    } finally {
      await delAppts(request, h, [id]);
    }
  });
});

// ═══ CLIENTES — a ficha com a dívida da API ════════════════════════════════════════

for (const vp of LARGURAS) {
  test.describe(`B57 F3 · Clientes — dívida da API (${vp.label})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("AG-18: a ficha mostra «Este cliente tem 15,00 € em dívida.» (stats.debt da API)", async ({ page, context }) => {
      await abrir(page, context, DONO, `/clientes?cliente=${D.customerId}`, async () => {
        await expect(page.getByText(`Hom Cliente ${D.tag}`).first()).toBeVisible({ timeout: 15_000 });
      });
      await expect(page.getByText(/Este cliente tem 15,00\s€ em dívida\./)).toBeVisible({ timeout: 10_000 });
      await expectNoHScroll(page);
      await shot(page, "cliente-divida", vp.width);
    });
  });
}

// ═══ LOJA — encomendas, total faturado, stock baixo, euros ═══════════════════════════

for (const vp of LARGURAS) {
  test.describe(`B57 F3 · Loja — totais da API (${vp.label})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("LJ-11 + FI-06: 24 encomendas em 2 páginas; «Total faturado» = 250,00 € (só as 20 pagas: sem as 2 por pagar, a cancelada nem a reembolsada); euros pt-PT", async ({ page, context }) => {
      const resposta = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/api/orders") && r.status() === 200, { timeout: 25_000 });
      await abrir(page, context, DONO, "/loja/encomendas", async () => {
        await expect(page.getByText("Total faturado")).toBeVisible({ timeout: 15_000 });
      });
      const corpo = (await (await resposta).json()) as { count: number; stats: { billed: number; open: number } };
      expect(corpo.count).toBe(24);
      expect(corpo.stats).toMatchObject({ billed: 250, open: 22 });

      // O KPI mostra exactamente o que a API calculou (250 = 20 × 12,50; as 2 por pagar, a cancelada e a reembolsada ficam de fora).
      const kpi = page.locator("p").filter({ hasText: /^Total faturado$/ }).locator("xpath=preceding-sibling::p[1]");
      await expect(kpi).toHaveText(eur("250,00"));
      await expect(page.getByText(eur("399,00"))).toHaveCount(0); // 250 + 99 + 50: o que NÃO pode aparecer

      // Página 1 = 20 linhas; página 2 = as 4 restantes.
      const linhas = page.locator("tbody tr");
      await expect(linhas).toHaveCount(20, { timeout: 10_000 });
      await expect(page.getByText("1–20")).toBeVisible();
      const seguinte = page.getByRole("button", { name: "Página seguinte" });
      await seguinte.scrollIntoViewIfNeeded();
      const p2 = page.waitForRequest((r) => new URL(r.url()).pathname.endsWith("/api/orders") && new URL(r.url()).searchParams.get("page") === "2");
      await seguinte.click();
      await p2;
      await expect(linhas).toHaveCount(4, { timeout: 10_000 });
      await expect(page.getByText("21–24")).toBeVisible();
      // O total faturado é de TODAS as encomendas, não da página: continua a 250,00 €.
      await expect(kpi).toHaveText(eur("250,00"));

      // FI-06: todas as células «Total» são «12,50 €» / «99,00 €» / «50,00 €» — nunca «€12.50» nem «12.50 €».
      const textoTabela = await page.locator("table").innerText();
      expect(eurosMalFormatados(textoTabela)).toEqual([]);
      for (const celula of await linhas.locator("td:nth-child(2)").allInnerTexts()) {
        expect(celula.trim()).toMatch(new RegExp("^\\d+,\\d{2}[ " + NBSP + "]€$"));
      }
      await expectNoHScroll(page);
      await shot(page, "loja-encomendas", vp.width);
    });

    test("LJ-05: stock baixo é ≤ 5 (limite da API): 2 baixos (3 e 5), 1 esgotado, 5 produtos, 54 unidades", async ({ page, context }) => {
      const resposta = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/api/products") && r.status() === 200, { timeout: 25_000 });
      await abrir(page, context, DONO, "/loja", async () => {
        await expect(page.getByPlaceholder(/procurar produto/i)).toBeVisible({ timeout: 15_000 });
      });
      const corpo = (await (await resposta).json()) as { stats: Record<string, number> };
      expect(corpo.stats).toMatchObject({ total: 5, stock: 54, low: 2, out: 1, lowStockMax: 5 });

      const valor = (rotulo: string) => page.locator("p").filter({ hasText: new RegExp("^" + rotulo + "$") }).locator("xpath=preceding-sibling::p[1]").first();
      await expect(valor("Produtos")).toHaveText("5");
      await expect(valor("Em stock")).toHaveText("54");
      await expect(valor("Stock baixo")).toHaveText("2");
      await expect(valor("Esgotados")).toHaveText("1");

      // O cartão de cada produto segue o mesmo limite: 5 → baixo; 6 → em stock; 0 → esgotado.
      const cartao = (n: number) => page.locator("h3", { hasText: `Produto Cobalto ${n}` }).locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
      await expect(cartao(2)).toContainText("Stock baixo"); // stock 5
      await expect(cartao(1)).toContainText("Stock baixo"); // stock 3
      await expect(cartao(3)).toContainText("Em stock"); // stock 6
      await expect(cartao(3)).not.toContainText("Stock baixo");
      await expect(cartao(0)).toContainText("Esgotado");
      await expect(cartao(3)).toContainText(eur("12,50"));
      expect(eurosMalFormatados(await page.locator("main").innerText())).toEqual([]);
      await expectNoHScroll(page);
      await shot(page, "loja-produtos", vp.width);
    });
  });
}

// ═══ DASHBOARD e DESPESAS — euros pt-PT ═══════════════════════════════════════════════

for (const vp of LARGURAS) {
  test.describe(`B57 F3 · Dashboard e Despesas — euros pt-PT (${vp.label})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("FI-06: o Dashboard escreve euros como «12,50 €» (nunca «€12.50» nem «12.50 €»)", async ({ page, context }) => {
      await abrir(page, context, DONO, "/dashboard", async () => {
        await expect(page.getByRole("button", { name: /^Receita de hoje:/ })).toBeVisible({ timeout: 20_000 });
      });
      const kpi = page.getByRole("button", { name: /^Receita de hoje:/ });
      await expect(kpi).toHaveAttribute("aria-label", /^Receita de hoje: [\d.\s]*\d,\d{2}\s€$/);
      const texto = await page.locator("main").innerText();
      expect(mostraEuros(texto).length).toBeGreaterThan(0);
      expect(eurosMalFormatados(texto)).toEqual([]);
      await expectNoHScroll(page);
      await shot(page, "dashboard", vp.width);
    });

    test("FI-06: Despesas escreve euros em pt-PT («100,00 €»)", async ({ page, context }) => {
      await abrir(page, context, "tenantA@e2e", "/despesas", async () => {
        await expect(page.getByText(/Despesa A • Renda/).first()).toBeVisible({ timeout: 20_000 });
      });
      await expect(page.getByText(eur("100,00")).first()).toBeVisible();
      expect(eurosMalFormatados(await page.locator("main").innerText())).toEqual([]);
      await expectNoHScroll(page);
      await shot(page, "despesas", vp.width);
    });
  });
}

// ═══ FI-05 — uma escrita de dinheiro refresca tudo, sem recarregar ═════════════════════

test.describe("B57 F3 · FI-05 — Dashboard e O Negócio actualizam sem recarregar (1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ retries: 0 });

  test("FI-05: registar um pagamento e uma despesa muda «Receita de hoje», «Receita (recebido)» e «Despesas» sem recarregar a página", async ({ page, context, request }) => {
    const hoje = new Date();
    const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const nome = `Fi05 ${D.tag}`;
    const id = await mkAppt(request, D.h, { date: hojeIso, time: "08:00", serviceId: D.svc20, name: nome });
    D.ids.push(id);
    const descricao = `Despesa Fi05 ${D.tag}`;

    await abrir(page, context, DONO, "/dashboard", async () => {
      await expect(page.getByRole("button", { name: /^Receita de hoje:/ })).toBeVisible({ timeout: 20_000 });
    });
    // Marca a página: se recarregar, a marca desaparece.
    await page.evaluate(() => { (window as unknown as { __semRecarregar: boolean }).__semRecarregar = true; });
    const receitaHoje = async () => numero((await page.getByRole("button", { name: /^Receita de hoje:/ }).getAttribute("aria-label")) ?? "");
    const antesHoje = await receitaHoje();

    // O Negócio: valores de partida.
    await irSemRecarregar(page, "/financeiro");
    const kpiNegocio = (rotulo: string) => page.locator("p").filter({ hasText: new RegExp("^" + rotulo + "$") }).locator("xpath=../preceding-sibling::p[1]").first();
    await expect(kpiNegocio("Despesas")).toHaveText(/€/, { timeout: 15_000 });
    const antesDespesas = numero(await kpiNegocio("Despesas").innerText());
    const antesRecebido = numero(await kpiNegocio("Receita [(]recebido[)]").innerText());

    // 1) Registar o pagamento (20 €, dinheiro) na Marcação de hoje.
    await irSemRecarregar(page, "/agenda/marcacoes");
    const linha = await procurar(page, nome);
    await expect(linha).toHaveCount(1, { timeout: 15_000 });
    await linha.click();
    const dlg = await separadorPagamento(page);
    await dlg.getByPlaceholder("0.00").first().fill("20");
    const put = page.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes(`/schedule/appointments/${id}`));
    await dlg.getByRole("button", { name: /Guardar pagamento/ }).click();
    expect((await put).status()).toBeLessThan(300);
    await page.keyboard.press("Escape");

    // 2) Registar a despesa (12,34 €).
    await irSemRecarregar(page, "/despesas");
    const despesas = new DespesasPage(page);
    await despesas.createExpense({ date: hojeIso, description: descricao, amount: "12.34" });
    await despesas.expectExpenseVisible(descricao);

    // O Negócio: a receita recebida sobe 20 € e as despesas 12,34 € — sem recarregar.
    await irSemRecarregar(page, "/financeiro");
    await expect.poll(async () => numero(await kpiNegocio("Despesas").innerText()), { timeout: 15_000 }).toBeCloseTo(antesDespesas + 12.34, 2);
    await expect.poll(async () => numero(await kpiNegocio("Receita [(]recebido[)]").innerText()), { timeout: 15_000 }).toBeCloseTo(antesRecebido + 20, 2);
    await shot(page, "o-negocio-depois", 1440);

    // Dashboard: «Receita de hoje» sobe os mesmos 20 €.
    await irSemRecarregar(page, "/dashboard");
    await expect.poll(receitaHoje, { timeout: 15_000 }).toBeCloseTo(antesHoje + 20, 2);

    expect(await page.evaluate(() => (window as unknown as { __semRecarregar?: boolean }).__semRecarregar), "a página recarregou a meio").toBe(true);

    // Arruma a despesa (a marcação apaga-se no afterAll).
    await irSemRecarregar(page, "/despesas");
    await despesas.deleteExpense(descricao);
    await despesas.expectExpenseHidden(descricao);
  });
});
