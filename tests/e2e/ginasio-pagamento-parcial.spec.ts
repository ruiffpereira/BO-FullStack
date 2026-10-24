import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import path from "node:path";
import { API, loginAs } from "./fixtures/login";
import { apiLogin } from "./fixtures/support";
import { eur, mkCustomer, type Headers } from "./fixtures/dinheiro";

/**
 * B59 F3 — «Registar pagamento» da mensalidade do ginásio (Financeiro → Ginásio).
 * Regras: GY-36 (abaixo do preço → em dívida, o preço do mês não muda), GY-05 (só 5 métodos),
 * GY-04 (parciais contam como recebido), EQ-03 (só-ver = botões desactivados com o motivo).
 * Tenant do dono: gymhosta@e2e.local; só-ver: av-sover@e2e.local (dono: arvore-a@e2e.local).
 */
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial", retries: 0 });

const DONO = "gymhosta@e2e.local";
const ARVORE_DONO = "arvore-a@e2e.local";
const SO_VER = "av-sover@e2e.local";
const VIEW_ONLY = "Só tens permissão para ver";
const PRECO = 40;
const SHOTS = path.resolve(".capturas", "ronda-grande", "capturas");
const tag = String(Date.now()).slice(-6);

/** Cliente com a subscrição de 40 € atribuída (nasce com a mensalidade do mês por pagar — GY-37). */
async function mkSocio(request: APIRequestContext, h: Headers, nome: string): Promise<{ customerId: string; period: string }> {
  const sub = await request.post(`${API}/gym/subscriptions`, { headers: h, data: { name: `Plano Parcial ${nome}`, price: PRECO, dueDay: 8 } });
  expect(sub.ok(), `criar subscrição (${sub.status()}) ${await sub.text()}`).toBeTruthy();
  const { subscriptionId } = (await sub.json()) as { subscriptionId: string };
  const customerId = await mkCustomer(request, h, nome);
  const put = await request.put(`${API}/gym/mensalidade/customers/${customerId}/subscription`, { headers: h, data: { subscriptionId } });
  expect(put.ok(), `atribuir subscrição (${put.status()}) ${await put.text()}`).toBeTruthy();
  return { customerId, period: (await ficha(request, h, customerId)).currentPeriod };
}

async function ficha(request: APIRequestContext, h: Headers, customerId: string) {
  const res = await request.get(`${API}/gym/mensalidade/customers/${customerId}`, { headers: h });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { currentPeriod: string; payments: Array<{ period: string; status: string; amount: number; paidAmount: number | null; method: string | null }> };
}

async function mesDe(request: APIRequestContext, h: Headers, customerId: string, period: string) {
  const p = (await ficha(request, h, customerId)).payments.find((x) => x.period === period);
  expect(p, "mensalidade do mês existe").toBeTruthy();
  return p!;
}

async function recebido(request: APIRequestContext, h: Headers, period: string): Promise<number> {
  const res = await request.get(`${API}/gym/mensalidade/finance?period=${period}`, { headers: h });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { kpis: { recebido: number } }).kpis.recebido;
}

/** Financeiro → Ginásio → abre a linha do sócio (vista da ficha da mensalidade). */
async function abrirFicha(page: Page, nome: string) {
  await page.goto("/financeiro/ginasio");
  await page.getByPlaceholder("Procurar cliente…").fill(nome);
  await page.getByRole("button", { name: new RegExp(nome) }).first().click();
  await expect(page.getByText("Mês corrente")).toBeVisible({ timeout: 10_000 });
}

const modal = (page: Page) => page.getByRole("dialog", { name: "Registar pagamento" });
const valor = (page: Page) => modal(page).getByRole("spinbutton").first();

async function abrirPagamento(page: Page) {
  await page.getByRole("button", { name: "Paga", exact: true }).click();
  await expect(modal(page)).toBeVisible();
  await expect(valor(page)).toHaveValue(String(PRECO));
}

async function semScrollHorizontal(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, "sem scroll horizontal").toBeLessThanOrEqual(0);
}

test.describe("B59 F3 — Registar pagamento (ginásio)", () => {
  let h: Headers;
  test.beforeEach(async ({ context, request }) => {
    await loginAs(context, DONO);
    h = (await apiLogin(request, DONO)).headers;
  });

  test("GY-36: pagar o preço inteiro → «Marcar paga», sem aviso, fica paga", async ({ page, request }) => {
    const nome = `Socio Inteiro ${tag}`;
    const { customerId, period } = await mkSocio(request, h, nome);
    await abrirFicha(page, nome);
    await abrirPagamento(page);
    await expect(modal(page).getByText(/fica «em dívida»/)).toHaveCount(0);
    await expect(modal(page).getByText(/Não pode ser mais/)).toHaveCount(0);
    await expect(modal(page).getByRole("button", { name: "Marcar paga" })).toBeEnabled();
    await modal(page).getByRole("button", { name: "Marcar paga" }).click();
    await expect(modal(page)).toHaveCount(0);
    const p = await mesDe(request, h, customerId, period);
    expect(p.status).toBe("paid");
    expect(p.amount).toBe(PRECO);
  });

  test("GY-36 + GY-04: abaixo do preço → aviso com os valores, «Registar parcial», grava em dívida, preço igual e conta como recebido", async ({ page, request }) => {
    const nome = `Socio Parcial ${tag}`;
    const { customerId, period } = await mkSocio(request, h, nome);
    const antes = await recebido(request, h, period);
    await abrirFicha(page, nome);
    await abrirPagamento(page);
    await valor(page).fill("15");
    const aviso = modal(page).getByText(/Abaixo do preço — fica «em dívida»/);
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText(eur("15,00"));
    await expect(aviso).toContainText(eur("25,00"));
    await expect(aviso).toContainText("O preço do mês não muda");
    await expect(modal(page).getByRole("button", { name: "Marcar paga" })).toHaveCount(0);
    await modal(page).getByRole("button", { name: "Registar parcial" }).click();
    await expect(modal(page)).toHaveCount(0);

    const p = await mesDe(request, h, customerId, period);
    expect(p.status).toBe("debt");
    expect(p.paidAmount).toBe(15);
    expect(p.amount).toBe(PRECO); // o preço do mês não muda
    // A ficha mostra a dívida: já pagou 15, em falta 25.
    await expect(page.getByText("Em falta")).toBeVisible();
    await expect(page.getByText(eur("25,00")).first()).toBeVisible();
    // GY-04: o parcial conta como recebido (API) e o Financeiro mostra o mesmo número.
    expect(await recebido(request, h, period)).toBeCloseTo(antes + 15, 2);
    await page.getByRole("button", { name: "Voltar" }).click();
    await page.getByRole("tab", { name: /^Todos/ }).click();
    await page.getByPlaceholder("Procurar cliente…").fill(nome);
    await expect(page.getByRole("button", { name: new RegExp(nome) }).first()).toContainText(/Falta\s+25,00/);
    const rec = await recebido(request, h, period);
    await expect(page.getByText("Recebido", { exact: true }).locator("xpath=following-sibling::p[1]"))
      .toContainText(new RegExp(rec.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".?")));
  });

  test("GY-36: acima do preço → aviso vermelho com o máximo e o botão desactivado", async ({ page, request }) => {
    const nome = `Socio Excesso ${tag}`;
    const { customerId, period } = await mkSocio(request, h, nome);
    await abrirFicha(page, nome);
    await abrirPagamento(page);
    await valor(page).fill("55");
    const erro = modal(page).getByText(/Não pode ser mais do que o preço do mês/);
    await expect(erro).toBeVisible();
    await expect(erro).toContainText(eur("40,00"));
    await expect(modal(page).getByRole("button", { name: "Marcar paga" })).toBeDisabled();
    await valor(page).fill("0");
    await expect(modal(page).getByRole("button", { name: "Marcar paga" })).toBeDisabled();
    expect((await mesDe(request, h, customerId, period)).status).toBe("unpaid"); // nada gravado
  });

  test("GY-36: «Marcar pago» numa linha em dívida só deixa pagar o que falta; pagar o resto fecha em paga", async ({ page, request }) => {
    const nome = `Socio Resto ${tag}`;
    const { customerId, period } = await mkSocio(request, h, nome);
    const r = await request.post(`${API}/gym/mensalidade/customers/${customerId}/payments`, { headers: h, data: { period, status: "debt", paidAmount: 12 } });
    expect(r.ok()).toBeTruthy();
    await page.goto("/financeiro/ginasio");
    await page.getByPlaceholder("Procurar cliente…").fill(nome);
    await page.getByRole("button", { name: new RegExp(nome) }).first().getByRole("button", { name: "Marcar pago" }).click();
    await expect(modal(page)).toBeVisible();
    await expect(modal(page).getByText("Valor recebido (€)")).toBeVisible();
    await expect(valor(page)).toHaveValue("28"); // por omissão, o que falta
    await valor(page).fill("10");
    await expect(modal(page).getByText(/pago .*22,00.*faltam .*18,00/)).toBeVisible();
    await valor(page).fill("30");
    await expect(modal(page).getByText(/Não pode ser mais do que falta pagar/)).toContainText(eur("28,00"));
    await expect(modal(page).getByRole("button", { name: "Marcar paga" })).toBeDisabled();
    await valor(page).fill("28");
    await modal(page).getByRole("button", { name: "Marcar paga" }).click();
    await expect(modal(page)).toHaveCount(0);
    const p = await mesDe(request, h, customerId, period);
    expect(p.status).toBe("paid");
    expect(p.amount).toBe(PRECO);
  });

  test("GY-36: «Em dívida» pela ficha grava com o valor pago (paidAmount no pedido) e deixa corrigir o já pago", async ({ page, request }) => {
    const nome = `Socio Divida ${tag}`;
    const { customerId, period } = await mkSocio(request, h, nome);
    await abrirFicha(page, nome);
    const pedido = page.waitForRequest((rq) => rq.method() === "POST" && rq.url().includes(`/payments`));
    await page.getByRole("button", { name: "Em dívida", exact: true }).click();
    const body = (await pedido).postDataJSON();
    expect(body.status).toBe("debt");
    expect(body.paidAmount).toBe(0);
    await expect(page.getByText("Já pagou")).toBeVisible();
    const campo = page.locator("input[type=number]").last();
    await campo.fill("12");
    await campo.blur();
    await expect.poll(async () => (await mesDe(request, h, customerId, period)).paidAmount).toBe(12);
    const p = await mesDe(request, h, customerId, period);
    expect(p.status).toBe("debt");
    expect(p.amount).toBe(PRECO);
  });

  test("GY-05: o Método só oferece os 5 e grava o escolhido (Multibanco não se funde com transferência)", async ({ page, request }) => {
    const nome = `Socio Metodo ${tag}`;
    const { customerId, period } = await mkSocio(request, h, nome);
    await abrirFicha(page, nome);
    await abrirPagamento(page);
    await modal(page).getByRole("button", { name: /MB Way/ }).click();
    const opcoes = page.getByRole("option");
    await expect(opcoes).toHaveCount(5);
    await expect(opcoes).toHaveText(["Numerário", "MB Way", "Cartão", "Transferência", "Multibanco"]);
    await opcoes.filter({ hasText: "Multibanco" }).click();
    await modal(page).getByRole("button", { name: "Marcar paga" }).click();
    await expect(modal(page)).toHaveCount(0);
    const p = await mesDe(request, h, customerId, period);
    expect(p.status).toBe("paid");
    expect(p.method).toBe("multibanco");
  });

  for (const vp of [{ w: 1440, h: 900 }, { w: 834, h: 1112 }, { w: 390, h: 844 }]) {
    test(`GY-36 responsivo ${vp.w}: o modal e o aviso cabem, nada cortado, sem scroll horizontal`, async ({ page, request }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      const nome = `Socio Largura${vp.w} ${tag}`;
      await mkSocio(request, h, nome);
      await abrirFicha(page, nome);
      await semScrollHorizontal(page);
      await abrirPagamento(page);
      await valor(page).fill("15");
      const aviso = modal(page).getByText(/Abaixo do preço — fica «em dívida»/);
      await expect(aviso).toBeVisible();
      await expect(modal(page).getByRole("button", { name: "Registar parcial" })).toBeVisible();
      await expect(modal(page).getByRole("button", { name: "Cancelar" })).toBeVisible();
      // Tudo dentro do ecrã: o aviso, os botões e o modal.
      for (const loc of [aviso, modal(page).getByRole("button", { name: "Registar parcial" }), modal(page).getByRole("button", { name: "Cancelar" })]) {
        const b = (await loc.boundingBox())!;
        expect(b.x, "dentro do ecrã (esquerda)").toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, "dentro do ecrã (direita)").toBeLessThanOrEqual(vp.w + 0.5);
        expect(b.y + b.height, "dentro do ecrã (fundo)").toBeLessThanOrEqual(vp.h + 0.5);
      }
      // O texto do aviso não é cortado por overflow do próprio elemento.
      const cortado = await aviso.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(cortado, "aviso sem texto cortado").toBe(false);
      await semScrollHorizontal(page);
      await page.screenshot({ path: path.join(SHOTS, `b59f3-pagamento-parcial-${vp.w}.png`) });
      // Excesso (vermelho) também legível.
      await valor(page).fill("55");
      await expect(modal(page).getByText(/Não pode ser mais do que o preço do mês/)).toBeVisible();
      await semScrollHorizontal(page);
      await page.screenshot({ path: path.join(SHOTS, `b59f3-pagamento-excesso-${vp.w}.png`) });
    });
  }
});

test.describe("B59 F3 — Registar pagamento: membro só-ver (EQ-03)", () => {
  test("EQ-03: o membro só-ver vê Paga / Em dívida / Não pago e «Marcar pago» desactivados com o motivo", async ({ page, context, request }) => {
    const hDono = (await apiLogin(request, ARVORE_DONO)).headers;
    const nome = `Socio SoVer ${tag}`;
    const { customerId, period } = await mkSocio(request, hDono, nome);
    await loginAs(context, SO_VER);
    await page.goto("/financeiro/ginasio");
    await page.getByPlaceholder("Procurar cliente…").fill(nome);
    const linha = page.getByRole("button", { name: new RegExp(nome) }).first();
    await expect(linha).toBeVisible({ timeout: 15_000 });
    const marcar = linha.getByRole("button", { name: "Marcar pago" });
    await expect(marcar).toBeDisabled();
    await expect(marcar).toHaveAttribute("title", VIEW_ONLY);
    await linha.click();
    await expect(page.getByText("Mês corrente")).toBeVisible({ timeout: 10_000 });
    for (const n of ["Paga", "Em dívida", "Não pago"]) {
      const b = page.getByRole("button", { name: n, exact: true });
      await expect(b).toBeDisabled();
      await expect(b).toHaveAttribute("title", VIEW_ONLY);
    }
    await page.screenshot({ path: path.join(SHOTS, "b59f3-pagamento-sover-1440.png") });
    // Nada gravado.
    expect((await mesDe(request, hDono, customerId, period)).status).toBe("unpaid");
  });
});
