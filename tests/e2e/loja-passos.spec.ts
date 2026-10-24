import { test, expect, type Page, type Locator, type APIRequestContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { API, loginAs } from "./fixtures/login";
import { apiLogin } from "./fixtures/support";
import { LARGURAS, eur, expectNoHScroll } from "./fixtures/dinheiro";

/**
 * B59 · F4 — Loja → Encomendas: estado em badge e coluna «Passos» (só os passos que a API devolve em `allowedTransitions`).
 *
 * Regras provadas: LJ-33 (só os passos válidos aparecem: processing → enviada/cancelar/reembolsar; enviada → entregue/reembolsar;
 * entregue → reembolsar; por pagar → só cancelar; cancelada/reembolsada sem botões), LJ-34 (cancelar/reembolsar uma paga repõe o stock;
 * a confirmação di-lo e diz que o dinheiro se devolve na Stripe), EQ-03 (membro só-ver: botões desactivados com o motivo),
 * FI-06 (euros pt-PT), B57 (confirmação com a folha do gatilho; 402 do billingGate dá feedback visível).
 *
 * Seed (`API-FullStack/scripts/seedE2e.ts`, `E2E_LOJA_PASSOS`): dono `loja-passos@e2e.local`, membro só-ver `lp-sover@e2e.local`;
 * produto «Produto Zimbro» (stock 10) e uma encomenda por situação, cada uma com 2 unidades e um preço único (31,10 … 36,60).
 * Capturas em `.design/ronda-grande/capturas/b59f4-*.png` — para OLHAR.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial", retries: 0 });

const DONO = "loja-passos@e2e.local";
const SO_VER = "lp-sover@e2e.local";
const VIEW_ONLY = "Só tens permissão para ver";
const REF = "ZIM-PAS-1";
const STOCK0 = 10;
const QTY = 2;

const P = { fluxo: "31,10", cancelar: "32,20", porPagar: "33,30", cancelada: "34,40", reembolsada: "35,50", guarda: "36,60" } as const;

const SHOTS = path.resolve(".design", "ronda-grande", "capturas");
async function shot(page: Page, nome: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `b59f4-${nome}.png`) });
}

async function abrir(page: Page) {
  await page.goto("/loja/encomendas");
  await expect(page.getByText("Total faturado")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("columnheader", { name: "Passos" })).toBeVisible();
}

const linha = (page: Page, preco: string): Locator => page.locator("tbody tr").filter({ hasText: eur(preco) });
const passo = (row: Locator, nome: RegExp | string) => row.getByRole("button", { name: nome });
const todosPassos = (row: Locator) => row.locator("td").last().getByRole("button");

async function stock(request: APIRequestContext): Promise<number> {
  const { headers } = await apiLogin(request, DONO);
  const res = await request.get(`${API}/products`, { headers });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const list: any[] = Array.isArray(body) ? body : body.rows ?? body.products ?? [];
  const p = list.find((x) => x.reference === REF);
  expect(p, "produto Zimbro na API").toBeTruthy();
  return Number(p.stock);
}

test.describe("Loja — passos das encomendas", () => {
  test("LJ-33: encomenda paga → «Marcar enviada» → «Marcar entregue» → «Reembolsar» (confirmação; o stock volta)", async ({ page, context, request }) => {
    await loginAs(context, DONO);
    await abrir(page);
    const row = linha(page, P.fluxo);
    await expect(row.getByText("A processar")).toBeVisible();
    // processing: enviar, cancelar, reembolsar — e nada mais
    await expect(todosPassos(row)).toHaveCount(3);
    await expect(passo(row, /^Marcar enviada/)).toBeEnabled();
    await expect(passo(row, /^Cancelar/)).toBeVisible();
    await expect(passo(row, /^Reembolsar/)).toBeVisible();
    await expect(passo(row, /^Marcar entregue/)).toHaveCount(0);

    await passo(row, /^Marcar enviada/).click();
    await expect(row.getByText("Enviada", { exact: true })).toBeVisible({ timeout: 15_000 });
    // enviada: entregue + reembolsar (já não há «enviada» nem «cancelar»)
    await expect(todosPassos(row)).toHaveCount(2);
    await expect(passo(row, /^Marcar entregue/)).toBeVisible();
    await expect(passo(row, /^Reembolsar/)).toBeVisible();
    await expect(passo(row, /^Cancelar/)).toHaveCount(0);

    await passo(row, /^Marcar entregue/).click();
    await expect(row.getByText("Entregue", { exact: true })).toBeVisible({ timeout: 15_000 });
    // entregue: só reembolsar
    await expect(todosPassos(row)).toHaveCount(1);
    await expect(passo(row, /^Reembolsar/)).toBeVisible();
    expect(await stock(request)).toBe(STOCK0); // enviar/entregar não mexe no stock

    // «Voltar» não faz nada
    await passo(row, /^Reembolsar/).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toBeVisible();
    await dlg.getByRole("button", { name: "Voltar" }).click();
    await expect(dlg).toHaveCount(0);
    await expect(row.getByText("Entregue", { exact: true })).toBeVisible();
    expect(await stock(request)).toBe(STOCK0);

    // Reembolsar de facto
    await passo(row, /^Reembolsar/).click();
    await expect(dlg).toBeVisible();
    await dlg.getByRole("button", { name: "Reembolsar", exact: true }).click();
    await expect(row.getByText("Reembolsada", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(todosPassos(row)).toHaveCount(0); // estado final: sem botões
    await expect.poll(() => stock(request), { timeout: 10_000 }).toBe(STOCK0 + QTY); // LJ-34: o stock volta
  });

  test("LJ-34: a confirmação de Reembolsar diz que o stock volta e que o dinheiro se devolve à mão na Stripe", async ({ page, context }) => {
    await loginAs(context, DONO);
    await abrir(page);
    const row = linha(page, P.guarda);
    await passo(row, /^Reembolsar/).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByText("Reembolsar esta encomenda?")).toBeVisible();
    await expect(dlg).toContainText("O stock volta para a loja");
    await expect(dlg).toContainText("reembolsa o cliente na Stripe");
    await expect(dlg).toContainText("Não dá para desfazer");
    await shot(page, "confirmar-reembolso-1440");
    await dlg.getByRole("button", { name: "Voltar" }).click();
    await expect(dlg).toHaveCount(0);
    await expect(row.getByText("A processar")).toBeVisible();
  });

  test("LJ-34: Cancelar uma encomenda paga pede confirmação (stock volta, dinheiro na Stripe) e repõe o stock", async ({ page, context, request }) => {
    await loginAs(context, DONO);
    await abrir(page);
    const antes = await stock(request);
    const row = linha(page, P.cancelar);
    await passo(row, /^Cancelar/).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByText("Cancelar esta encomenda?")).toBeVisible();
    await expect(dlg).toContainText("O stock volta para a loja");
    await expect(dlg).toContainText("reembolsa-o na Stripe");
    await dlg.getByRole("button", { name: "Cancelar encomenda" }).click();
    await expect(row.getByText("Cancelada", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(todosPassos(row)).toHaveCount(0);
    await expect.poll(() => stock(request), { timeout: 10_000 }).toBe(antes + QTY);
  });

  test("LJ-33/LJ-34: encomenda por pagar só mostra «Cancelar»; a confirmação diz que o stock não muda", async ({ page, context, request }) => {
    await loginAs(context, DONO);
    await abrir(page);
    const antes = await stock(request);
    const row = linha(page, P.porPagar);
    await expect(row.getByText("Por pagar")).toBeVisible();
    await expect(todosPassos(row)).toHaveCount(1);
    await expect(passo(row, /^Cancelar/)).toBeVisible();
    await expect(passo(row, /^Marcar enviada/)).toHaveCount(0);
    await expect(passo(row, /^Reembolsar/)).toHaveCount(0);
    await passo(row, /^Cancelar/).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toContainText("Ainda não foi paga, por isso o stock não muda");
    await dlg.getByRole("button", { name: "Cancelar encomenda" }).click();
    await expect(row.getByText("Cancelada", { exact: true })).toBeVisible({ timeout: 15_000 });
    expect(await stock(request)).toBe(antes); // por pagar nunca mexeu no stock
  });

  test("LJ-33: cancelada e reembolsada são finais — badge, sem botões", async ({ page, context }) => {
    await loginAs(context, DONO);
    await abrir(page);
    const canc = linha(page, P.cancelada);
    const reemb = linha(page, P.reembolsada);
    await expect(canc.getByText("Cancelada", { exact: true })).toBeVisible();
    await expect(reemb.getByText("Reembolsada", { exact: true })).toBeVisible();
    await expect(todosPassos(canc)).toHaveCount(0);
    await expect(todosPassos(reemb)).toHaveCount(0);
  });

  test("EQ-03/LJ-33: membro só-ver vê os passos desactivados com o motivo (e a confirmação nunca chega a abrir)", async ({ page, context }) => {
    await loginAs(context, SO_VER);
    await abrir(page);
    const row = linha(page, P.guarda);
    const botoes = todosPassos(row);
    await expect(botoes).toHaveCount(3); // continuam visíveis — nunca escondidos
    for (let i = 0; i < 3; i++) {
      await expect(botoes.nth(i)).toBeDisabled();
      await expect(botoes.nth(i).locator("xpath=..")).toHaveAttribute("title", VIEW_ONLY);
    }
    await botoes.last().click({ force: true }).catch(() => undefined);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(row.getByText("A processar")).toBeVisible();
  });

  test("B57: um 402 do billingGate ao mudar o estado dá feedback visível e a linha não muda", async ({ page, context }) => {
    await loginAs(context, DONO);
    await abrir(page);
    await page.route("**/orders/**", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 402, contentType: "application/json", body: JSON.stringify({ error: "Payment Required", reason: "past_due_locked", graceEndsAt: null }) })
        : route.continue(),
    );
    const row = linha(page, P.guarda);
    await passo(row, /^Marcar enviada/).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /regulariza o pagamento/i })).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText("A processar")).toBeVisible();
    await expect(passo(row, /^Marcar enviada/)).toBeEnabled(); // a mutação acabou; pode tentar de novo
  });

  for (const L of LARGURAS) {
    test(`responsivo ${L.label}: coluna «Passos» legível, botões alcançáveis, confirmação cabe, sem scroll horizontal`, async ({ page, context }) => {
      await page.setViewportSize({ width: L.width, height: L.height });
      await loginAs(context, DONO);
      await abrir(page);
      await expectNoHScroll(page);
      // a página mostra os passos de uma encomenda de cada tipo
      const row = linha(page, P.guarda);
      await expect(row).toBeVisible();
      const enviar = passo(row, /^Marcar enviada/);
      await enviar.scrollIntoViewIfNeeded();
      await expect(enviar).toBeVisible();
      const box = await enviar.boundingBox();
      expect(box, "botão com caixa").toBeTruthy();
      const vw = page.viewportSize()!.width;
      // alcançável: o botão está dentro da área visível (a tabela pode ter scroll interno, a página não)
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
      // a tabela não precisa de scroll interno para chegar ao último passo («Reembolsar» não fica cortado)
      const scrollInterno = await page.locator("table").evaluate((t) => {
        const w = t.parentElement as HTMLElement;
        return w.scrollWidth - w.clientWidth;
      });
      expect(scrollInterno, "a tabela de encomendas tem scroll horizontal interno").toBeLessThanOrEqual(1);
      await expect(passo(row, /^Reembolsar/)).toBeInViewport({ ratio: 1 });
      // texto não cortado
      const cortado = await enviar.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(cortado, "texto do botão cortado").toBe(false);
      await shot(page, `passos-${L.label}`);

      await passo(row, /^Reembolsar/).click();
      const dlg = page.getByRole("dialog");
      await expect(dlg).toBeVisible();
      const d = await dlg.boundingBox();
      expect(d!.x).toBeGreaterThanOrEqual(-1);
      expect(d!.x + d!.width).toBeLessThanOrEqual(vw + 1);
      await expect(dlg.getByRole("button", { name: "Voltar" })).toBeInViewport();
      await expect(dlg.getByRole("button", { name: "Reembolsar", exact: true })).toBeInViewport();
      await expectNoHScroll(page);
      await shot(page, `confirmar-${L.label}`);
      await dlg.getByRole("button", { name: "Voltar" }).click();
    });
  }
});
