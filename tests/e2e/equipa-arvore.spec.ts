import { test, expect, type Page, type BrowserContext, type APIRequestContext } from "@playwright/test";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { EquipaPage } from "./pages/EquipaPage";
import { PaginasPage } from "./pages/PaginasPage";

/**
 * B41 fase 2b — ÁRVORE de permissões da equipa, vista pela UI com membros reais.
 *
 * Seed (`API-FullStack/scripts/seedE2e.ts`, `ARVORE_MEMBERS`): dois tenants NÃO-admin completos —
 * `arvore-a@e2e.local` ("Salão Ametista") e `arvore-b@e2e.local` ("Estúdio Basalto") — com dados DISTINTOS
 * (cliente, serviço, marcações paga/em dívida, produto com custo, exercício). Os membros do A têm folhas
 * diferentes (`av-*@e2e.local`); `av-totalb` é o membro de acesso total do B.
 *
 * Valores que nunca podem aparecer a quem não tem `agenda.marcacoes.valores`: preços 77,50 / 63,25 (A), dívida
 * 43,25, "gasto total", "Dívida", coluna "Pago". Custo de compra do A: 7,31 (B: 6,17).
 */
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial" });

const OWNER_A = "arvore-a@e2e.local";
const OWNER_B = "arvore-b@e2e.local";
const M = {
  semValores: "av-semvalores@e2e.local",
  comValores: "av-comvalores@e2e.local",
  soServicos: "av-soservicos@e2e.local",
  clientesVer: "av-clientesver@e2e.local",
  clientesAcoes: "av-clientesacoes@e2e.local",
  lojaSemCusto: "av-lojasemcusto@e2e.local",
  lojaComCusto: "av-lojacomcusto@e2e.local",
  ginasioVer: "av-ginasiover@e2e.local",
  paginasVer: "av-paginasver@e2e.local",
  paginasPublica: "av-paginaspublica@e2e.local",
  editavel: "av-editavel@e2e.local",
  total: "av-total@e2e.local",
  totalB: "av-totalb@e2e.local",
};

const VIEWPORTS = [
  { label: "computador 1440", width: 1440, height: 900 },
  { label: "telemóvel 390", width: 390, height: 844 },
] as const;

const VIEW_ONLY = "Só tens permissão para ver";
/** Dinheiro de uma marcação: nunca no DOM (nem escondido) de quem não tem `agenda.marcacoes.valores`. */
const MONEY_UI = /Dívida|gasto total|Pagamento|\bPago\b|77[.,]5|63[.,]25|43[.,]25|97[.,]5/;
const MONEY_KEYS = /"(servicePrice|paymentCash|paymentMbway|paymentCard|paidAt|paymentHistory|totalSpent)"/;
const ALL_LEAF_KEYS = [
  "dashboard", "financeiro.negocio", "financeiro.agenda", "financeiro.loja",
  "agenda.marcacoes", "agenda.marcacoes.valores", "agenda.servicos", "agenda.bloqueios", "agenda.config",
  "loja.produtos", "loja.produtos.custo", "loja.encomendas", "loja.categorias",
  "ginasio.exercicios", "ginasio.treinos", "ginasio.clientes",
  "clientes.lista", "clientes.lista.exportar", "clientes.lista.apagar", "clientes.leads",
  "financeiro.mensalidades", "financeiro.despesas",
  "conteudos.website", "conteudos.produtos", "conteudos.servicos", "conteudos.ginasio", "conteudos.linguas", "conteudos.emails", "conteudos.notificacoes",
  "paginas.rascunho", "paginas.publicar",
  // Mensagens (B43): agrupador com 3 folhas; `mensagens.clientes` nasce fechada e fica fora do "Acesso total".
  "estatisticas", "mensagens.equipa", "mensagens.suporte",
];

// ── helpers ────────────────────────────────────────────────────────────────────

const sidebar = (page: Page) => page.locator("aside:visible nav").first();
const navBtn = (page: Page, name: string) => sidebar(page).getByRole("button", { name, exact: true });

/** Abaixo de `lg` a sidebar só existe depois de abrir o drawer (hambúrguer `lg:hidden` da topbar). */
async function openSidebarIfDrawer(page: Page): Promise<void> {
  if (page.viewportSize()!.width >= 1024) return;
  await page.locator("header button.lg\\:hidden").click();
  await expect(sidebar(page)).toBeVisible();
}

/** Texto completo do DOM, incluindo o que está escondido por CSS (colunas `hidden md:table-cell`, etc.). */
const domText = (page: Page) => page.evaluate(() => document.body.textContent ?? "");

/** Regista o corpo das respostas da API que interessam (para provar que o dinheiro nem viaja na rede). */
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
const listOf = (body: any): any[] => (Array.isArray(body) ? body : (body.rows ?? body.products ?? body.appointments ?? []));

/** Entra como `user` e navega para `path`, repetindo se a sessão cair (corrida do refresh). */
async function enter(page: Page, context: BrowserContext, user: string, path: string, ready: () => Promise<void>): Promise<void> {
  await loginAs(context, user);
  await withSessionRetry(page, context, user, () => page.goto(path), ready);
}

// ═══════════════════════════ (a) dinheiro das marcações ═══════════════════════════

for (const vp of VIEWPORTS) {
  test.describe(`Árvore — sem 'Valores e pagamentos' · ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("o membro abre uma marcação com pagamento registado e não vê preço, pagamento nem dívida em lado nenhum", async ({ page, context }) => {
      const bodies = captureApi(page, /\/(appointments|customers)/);
      const linhaDivida = page.locator("tr").filter({ hasText: "Marc Ametista Divida" });

      await enter(page, context, M.semValores, "/agenda/marcacoes", async () => {
        await expect(linhaDivida).toBeVisible({ timeout: 10_000 });
      });
      // Lista: sem coluna "Pago", sem "Dívida" no estado.
      await expect(page.getByRole("columnheader", { name: "Pago" })).toHaveCount(0);
      await expect(page.locator("tr").filter({ hasText: "Marc Ametista Paga" })).toBeVisible();
      expect(await domText(page)).not.toMatch(MONEY_UI);

      // Modal da marcação: só Detalhes (sem aba Pagamento), sem preço nem dívida.
      await linhaDivida.click();
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      await expect(modal.getByText("Corte Ametista")).toBeVisible();
      await expect(modal.getByRole("button", { name: "Editar marcação" })).toBeVisible();
      await expect(modal.getByText("Pagamento", { exact: true })).toHaveCount(0);
      await expect(modal.getByText("Detalhes", { exact: true })).toHaveCount(0); // sem abas: só o conteúdo
      expect(await domText(page)).not.toMatch(MONEY_UI);
      expect(await modal.textContent()).not.toMatch(/€/);
      await page.keyboard.press("Escape");
      await expect(modal).toBeHidden();

      // Ficha do cliente (tem `clientes.lista` em ver): visitas, sem "gasto total", sem dívida, sem preço.
      await page.goto("/clientes");
      await page.getByText("Cliente Ametista Rosa").first().click();
      const ficha = page.getByRole("dialog", { name: "Ficha de cliente" });
      await expect(ficha).toBeVisible({ timeout: 10_000 });
      await expect(ficha.getByText("visitas")).toBeVisible();
      await expect(ficha.getByText("2026-06-20 · 11:00")).toBeVisible();
      expect(await domText(page)).not.toMatch(MONEY_UI);
      expect(await ficha.textContent()).not.toMatch(/€/);

      // Rede: nenhuma resposta de marcações/clientes traz um campo de dinheiro.
      expect(bodies.length, "devia ter capturado respostas de /appointments e /customers").toBeGreaterThan(0);
      for (const b of bodies) expect(b.text, `campo de dinheiro em ${b.url}`).not.toMatch(MONEY_KEYS);
    });

    test("contraste: quem tem 'Valores e pagamentos' vê coluna Pago, dívida, aba Pagamento e gasto total", async ({ page, context }) => {
      const bodies = captureApi(page, /\/appointments/);
      await enter(page, context, M.comValores, "/agenda/marcacoes", async () => {
        await expect(page.locator("tr").filter({ hasText: "Marc Ametista Divida" })).toBeVisible({ timeout: 10_000 });
      });
      await expect(page.locator("tr").filter({ hasText: "Marc Ametista Divida" })).toContainText(/43[.,]25/);
      await page.locator("tr").filter({ hasText: "Marc Ametista Divida" }).click();
      const modal = page.getByRole("dialog");
      await expect(modal.getByText("Pagamento", { exact: true })).toBeVisible();
      await expect(modal).toContainText(/Dívida\s*43[.,]25/);
      expect(bodies.some((b) => MONEY_KEYS.test(b.text)), "o dono do dinheiro devia receber os campos").toBe(true);
    });
  });
}

test("Agenda: a ficha do cliente aberta de dentro da marcação também não mostra dinheiro", async ({ page, context }) => {
  await enter(page, context, M.semValores, "/agenda/marcacoes", async () => {
    await expect(page.locator("tr").filter({ hasText: "Marc Ametista Divida" })).toBeVisible({ timeout: 10_000 });
  });
  await page.locator("tr").filter({ hasText: "Marc Ametista Divida" }).click();
  const modal = page.getByRole("dialog");
  // A "linha" do cliente no topo do modal (com a seta) abre a ficha com o histórico.
  await modal.getByText("Marc Ametista Divida").first().click();
  await expect(modal.getByText("visitas")).toBeVisible({ timeout: 10_000 });
  expect(await domText(page)).not.toMatch(MONEY_UI);
  // Sem `clientes.lista` em editar: nem "Bloquear" (só as preferências de fatura são editáveis).
  await expect(modal.getByRole("button", { name: /Bloquear/ })).toHaveCount(0);
});

test("sem 'Valores e pagamentos' o membro conclui a marcação no próprio modal, com o pagamento por registar", async ({ page, context, request }) => {
  const member = auth(await tokenOf(request, M.semValores));
  const services = listOf(await (await request.get(`${API}/schedule/services`, { headers: member })).json());
  const serviceId = services.find((s: any) => s.name === "Corte Ametista")?.serviceId ?? services[0].serviceId;
  const clientName = `Marc Ametista Concluir ${Date.now()}`;
  const created = await request.post(`${API}/schedule/appointments`, {
    headers: member,
    data: { date: "2026-10-20", time: "10:00", serviceId, clientName, clientEmail: "concluir@e2e.local", clientPhone: "910000000" },
  });
  expect(created.status()).toBe(201);
  const apptId = (await created.json()).appointmentId as string;

  const linha = page.locator("tr").filter({ hasText: clientName });
  await enter(page, context, M.semValores, "/agenda/marcacoes", async () => {
    await expect(linha).toBeVisible({ timeout: 10_000 });
  });
  await linha.click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "Concluir marcação" }).click();
  await expect(linha).toContainText("Concluída", { timeout: 10_000 });
  expect(await domText(page)).not.toMatch(MONEY_UI);

  // Do lado do dono: concluída, sem nenhum pagamento registado (fica em dívida para quem tem a folha).
  const owner = auth(await tokenOf(request, OWNER_A));
  const appt = await (await request.get(`${API}/schedule/appointments/${apptId}`, { headers: owner })).json();
  expect(appt.status).toBe("completed");
  expect(Number(appt.paymentCash ?? 0) + Number(appt.paymentMbway ?? 0) + Number(appt.paymentCard ?? 0)).toBe(0);
});

// ═══════════════════════════ (b) só Serviços ═══════════════════════════

test.describe("Árvore — só 'Serviços' da Agenda", () => {
  test("vê só Serviços no submenu da Agenda, as outras rotas redireccionam e consegue editar um serviço", async ({ page, context }) => {
    await enter(page, context, M.soServicos, "/agenda", async () => {
      await expect(page).toHaveURL(/\/agenda\/servicos/, { timeout: 10_000 });
    });
    await expect(navBtn(page, "Agenda")).toBeVisible();
    for (const hidden of ["Calendário", "Marcações", "Configurações", "Clientes", "Loja", "Financeiro", "Dashboard"]) {
      await expect(navBtn(page, hidden), `"${hidden}" não devia aparecer`).toHaveCount(0);
    }
    for (const route of ["/agenda/marcacoes", "/agenda/config", "/clientes", "/loja"]) {
      await page.goto(route);
      await expect(page, `${route} devia redireccionar`).toHaveURL(/\/agenda\/servicos/, { timeout: 10_000 });
    }

    // Edita o preço de um serviço (a folha é `edit`): grava e a lista reflecte.
    await expect(page.getByRole("button", { name: "Novo serviço" })).toBeEnabled();
    const card = page.locator("div.select-none").filter({ hasText: "Corte Ametista" }).first();
    await card.getByRole("button", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[type="number"]').nth(1).fill("41");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Serviço actualizado")).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText("41.00€");
  });

  test("Agenda só para ver (serviços) com 'Calendário e marcações' em editar: os dois submenus aparecem e Serviços fica bloqueado", async ({ page, context }) => {
    // `semValores`: marcações em editar, serviços em ver, clientes em ver.
    await enter(page, context, M.semValores, "/agenda/servicos", async () => {
      await expect(page.getByRole("button", { name: "Novo serviço" })).toBeVisible({ timeout: 10_000 });
    });
    await expect(navBtn(page, "Marcações")).toBeVisible();
    await expect(navBtn(page, "Serviços")).toBeVisible();
    await expect(navBtn(page, "Configurações")).toHaveCount(0);
    const novo = page.getByRole("button", { name: "Novo serviço" });
    await expect(novo).toBeDisabled();
    await expect(novo.locator("xpath=..")).toHaveAttribute("title", VIEW_ONLY);
    // …mas "Nova marcação" (folha de edição) está activa.
    await page.goto("/agenda");
    await expect(page.getByRole("button", { name: "Nova marcação" })).toBeEnabled({ timeout: 10_000 });
  });
});

// ═══════════════════════════ (c) Clientes em "só ver" e acções ═══════════════════════════

test.describe("Árvore — Clientes", () => {
  test("em 'só ver': botões de escrita desactivados com o motivo e sem Exportar/Apagar", async ({ page, context }) => {
    await enter(page, context, M.clientesVer, "/clientes", async () => {
      await expect(page.getByText("Cliente Ametista Rosa").first()).toBeVisible({ timeout: 10_000 });
    });
    const novo = page.getByRole("button", { name: "Novo cliente" });
    await expect(novo).toBeDisabled();
    await expect(novo.locator("xpath=..")).toHaveAttribute("title", VIEW_ONLY);

    await page.getByText("Cliente Ametista Rosa").first().click();
    const ficha = page.getByRole("dialog", { name: "Ficha de cliente" });
    await expect(ficha).toBeVisible();
    const bloquear = ficha.getByRole("button", { name: "Bloquear" });
    await expect(bloquear).toBeDisabled();
    await expect(bloquear.locator("xpath=..")).toHaveAttribute("title", VIEW_ONLY);
    await expect(ficha.getByText("Privacidade (RGPD)")).toHaveCount(0);
    await expect(ficha.getByRole("button", { name: "Exportar dados" })).toHaveCount(0);
    await expect(ficha.getByRole("button", { name: "Apagar dados" })).toHaveCount(0);
    // Sem Agenda nem Ginásio na árvore: a ficha não tem os atalhos desses módulos, nem dinheiro.
    await expect(ficha.getByRole("button", { name: "Agenda" })).toHaveCount(0);
    expect(await domText(page)).not.toMatch(MONEY_UI);

    // "Editar" abre o formulário só para ler: Guardar bloqueado.
    await ficha.getByRole("button", { name: "Editar", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "Editar cliente" });
    await expect(edit.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  test("em 'editar' com Exportar mas sem Apagar: só aparece 'Exportar dados'", async ({ page, context }) => {
    await enter(page, context, M.clientesAcoes, "/clientes", async () => {
      await expect(page.getByText("Cliente Ametista Rosa").first()).toBeVisible({ timeout: 10_000 });
    });
    await expect(page.getByRole("button", { name: "Novo cliente" })).toBeEnabled();
    await page.getByText("Cliente Ametista Rosa").first().click();
    const ficha = page.getByRole("dialog", { name: "Ficha de cliente" });
    await expect(ficha.getByText("Privacidade (RGPD)")).toBeVisible();
    await expect(ficha.getByRole("button", { name: "Exportar dados" })).toBeVisible();
    await expect(ficha.getByRole("button", { name: "Apagar dados" })).toHaveCount(0);
    await expect(ficha.getByRole("button", { name: "Bloquear" })).toBeEnabled();
  });

  test("com as duas acções (Ana, equipa Navalha) vê Exportar e Apagar", async ({ page, context }) => {
    await enter(page, context, "membro@e2e.local", "/clientes", async () => {
      await expect(page.getByText("Cliente da Navalha").first()).toBeVisible({ timeout: 10_000 });
    });
    await page.getByText("Cliente da Navalha").first().click();
    const ficha = page.getByRole("dialog", { name: "Ficha de cliente" });
    await expect(ficha.getByRole("button", { name: "Exportar dados" })).toBeVisible();
    await expect(ficha.getByRole("button", { name: "Apagar dados" })).toBeVisible();
  });

  test("fronteira da API: sem a acção, exportar um cliente é 403 (e com ela, 200)", async ({ request }) => {
    const owner = auth(await tokenOf(request, OWNER_A));
    const custId = listOf(await (await request.get(`${API}/customers`, { headers: owner })).json())[0].customerId as string;
    const ver = await request.get(`${API}/customers/${custId}/export`, { headers: auth(await tokenOf(request, M.clientesVer)) });
    expect(ver.status()).toBe(403);
    const comAccao = await request.get(`${API}/customers/${custId}/export`, { headers: auth(await tokenOf(request, M.clientesAcoes)) });
    expect(comAccao.status()).toBe(200);
  });
});

// ═══════════════════════════ (d) custo de compra ═══════════════════════════

test.describe("Árvore — Loja e 'Custo de compra'", () => {
  test("sem a folha o produto não tem campo Custo (nem na rede); gravar o preço não apaga o custo", async ({ page, context }) => {
    const bodies = captureApi(page, /\/products/);
    await enter(page, context, M.lojaSemCusto, "/loja", async () => {
      await expect(page.getByText("AMT-ARV-1").first()).toBeVisible({ timeout: 10_000 });
    });
    await page.getByText("AMT-ARV-1").first().click();
    const dialog = page.getByRole("dialog", { name: "Editar produto" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Preço (€)")).toBeVisible();
    await expect(dialog.getByText(/Custo/)).toHaveCount(0);
    expect(await domText(page)).not.toMatch(/7[.,]31/);
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) expect(b.text, `custo em ${b.url}`).not.toMatch(/"(cost|costAtPurchase)"/);

    // Edita o preço e guarda: a API tem de ignorar/preservar o custo.
    await dialog.locator('input[type="number"]').first().fill("20.5");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });

  test("com a folha vê o custo (7.31) — intacto depois de um colega sem custo gravar o produto", async ({ page, context }) => {
    await enter(page, context, M.lojaComCusto, "/loja", async () => {
      await expect(page.getByText("AMT-ARV-1").first()).toBeVisible({ timeout: 10_000 });
    });
    await page.getByText("AMT-ARV-1").first().click();
    const dialog = page.getByRole("dialog", { name: "Editar produto" });
    await expect(dialog.getByLabel("Custo (€)")).toHaveValue("7.31");
    await expect(dialog.getByLabel("Custo (€)")).toBeEnabled();
  });

  test("Ginásio 'só ver': os botões de escrita ficam desactivados com o motivo", async ({ page, context }) => {
    await enter(page, context, M.ginasioVer, "/ginasio", async () => {
      await expect(page.getByText("Remo Ametista").first()).toBeVisible({ timeout: 15_000 });
    });
    const novo = page.getByRole("button", { name: "Novo exercício" });
    await expect(novo).toBeDisabled();
    await expect(novo.locator("xpath=..")).toHaveAttribute("title", VIEW_ONLY);
    await page.goto("/ginasio/treinos");
    const dia = page.getByRole("button", { name: "Novo dia de treino" }).first();
    await expect(dia).toBeDisabled({ timeout: 10_000 });
  });
});

// ═══════════════════════════ (e) Páginas em leitura ═══════════════════════════

test.describe("Árvore — Páginas", () => {
  const TITLE = "Pagina Ametista Leitura";

  test("o dono prepara uma página (rascunho) no site do tenant A", async ({ page, context }) => {
    const p = new PaginasPage(page, context, OWNER_A);
    await p.open();
    if ((await p.pageRow(TITLE).count()) === 0) {
      await p.createPage(TITLE, "ametista-leitura");
      await p.save();
    }
    await expect(p.pageRow(TITLE)).toBeVisible();
  });

  test("'Editar rascunho' só em ver: editor em leitura, sem Guardar nem Publicar nem Definições", async ({ page, context }) => {
    const p = new PaginasPage(page, context, M.paginasVer);
    await p.open();
    await expect(page.getByRole("status").filter({ hasText: "Só tens permissão para ver" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Definições do site" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Publicar/ })).toHaveCount(0);
    await expect(p.saveBtn).toBeDisabled();
    // A página existe e abre (leitura), mas não há como criar blocos nem desfazer.
    await p.openPage(TITLE);
    await expect(p.pageHeading).toHaveText(TITLE);
    await expect(p.saveBtn).toBeDisabled();
    await expect(p.undoBtn).toBeDisabled();
    await expect(page.getByRole("button", { name: "Novo bloco" })).toBeDisabled();
    // Os restantes CTAs de escrita aparecem desactivados em leitura, com o motivo, e o "＋" entre blocos some.
    const addBlock = page.getByRole("button", { name: "Adicionar bloco", exact: true });
    await expect(addBlock).toBeDisabled();
    await expect(addBlock).toHaveAttribute("title", "Só tens permissão para ver");
    await expect(page.getByRole("button", { name: "Adicionar bloco aqui" })).toHaveCount(0);
    await expect(p.group("Páginas").getByRole("button", { name: "Nova página" })).toBeDisabled();
    await expect(p.saveBtn).toBeDisabled();
    await expect(p.status).not.toContainText("Alterações por guardar");
  });

  test("com 'Publicar e definições' aparecem as Definições do site e não há aviso de leitura", async ({ page, context }) => {
    const p = new PaginasPage(page, context, M.paginasPublica);
    await p.open();
    await expect(page.getByRole("button", { name: "Definições do site" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Só tens permissão para ver" })).toHaveCount(0);
  });
});

// ═══════════════════════════ (f) o dono edita a árvore ═══════════════════════════

for (const vp of VIEWPORTS) {
  test.describe(`Árvore — editar permissões de um membro · ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("marcar Agenda marca os filhos, desmarcar um ramo deixa o pai parcial e, ao guardar, o membro ganha o acesso novo", async ({ browser, request }) => {
      // Estado inicial determinístico (um retry não herda o que o 1.º intento gravou).
      const owner = auth(await tokenOf(request, OWNER_A));
      const team = (await (await request.get(`${API}/team`, { headers: owner })).json()) as any[];
      const edna = team.find((m) => m.email === M.editavel);
      const reset = await request.put(`${API}/team/${edna.memberId}`, { headers: owner, data: { grants: [{ key: "agenda.servicos", level: "view" }] } });
      expect(reset.ok(), `reset do membro (${reset.status()})`).toBeTruthy();

      const size = { width: vp.width, height: vp.height };
      const ctxDono = await browser.newContext({ viewport: size });
      const ctxMembro = await browser.newContext({ viewport: size });
      try {
        const dono = await ctxDono.newPage();
        const membro = await ctxMembro.newPage();

        // Antes: o membro só tem Serviços da Agenda.
        await loginAs(ctxMembro, M.editavel);
        await withSessionRetry(membro, ctxMembro, M.editavel, () => membro.goto("/agenda/marcacoes"), async () => {
          await expect(membro).toHaveURL(/\/agenda\/servicos/, { timeout: 10_000 });
        });

        // O dono marca "Agenda": todos os filhos ficam marcados (e o já escolhido, Serviços em ver, mantém-se).
        const eq = new EquipaPage(dono, ctxDono, OWNER_A);
        await eq.open();
        const ficha = await eq.openMember("Edna Editavel");
        const agenda = eq.node(ficha, "Agenda");
        expect(await eq.isPartial(agenda), "Agenda começa parcial (1 de 5)").toBe(true);
        await expect(ficha.getByText("1 de 5")).toBeVisible();
        await agenda.check();
        await expect(ficha.getByText("5 de 5")).toBeVisible();
        expect(await eq.isPartial(agenda)).toBe(false);
        await eq.expand(ficha, "Agenda");
        for (const filho of ["Calendário e marcações", "Serviços", "Bloqueios e férias", "Horário e configurações"]) {
          await expect(eq.node(ficha, filho), filho).toBeChecked();
        }
        await expect(eq.level(ficha, "Serviços", "só ver")).toHaveAttribute("aria-selected", "true");
        await eq.expand(ficha, "Calendário e marcações");
        await expect(eq.node(ficha, "Valores e pagamentos")).toBeChecked();

        // Desmarca o ramo "Calendário e marcações" (arrasta "Valores e pagamentos"): o pai fica parcial.
        await eq.node(ficha, "Calendário e marcações").uncheck();
        await expect(eq.node(ficha, "Valores e pagamentos")).not.toBeChecked();
        expect(await eq.isPartial(agenda), "Agenda parcial").toBe(true);
        await expect(agenda).not.toBeChecked();
        await expect(ficha.getByText("3 de 5")).toBeVisible();

        const guardar = ficha.getByRole("button", { name: "Guardar permissões" });
        await expect(guardar).toBeEnabled();
        await guardar.click();
        await expect(guardar).toBeDisabled({ timeout: 10_000 });

        // Depois: o membro, ao recarregar, ganha Configurações (e continua sem Marcações/Calendário).
        await membro.goto("/agenda/config");
        await withSessionRetry(membro, ctxMembro, M.editavel, () => membro.goto("/agenda/config"), async () => {
          await expect(membro).toHaveURL(/\/agenda\/config/, { timeout: 10_000 });
          await openSidebarIfDrawer(membro);
          await expect(navBtn(membro, "Configurações")).toBeVisible();
          await expect(navBtn(membro, "Serviços")).toBeVisible();
          await expect(navBtn(membro, "Marcações")).toHaveCount(0);
          await expect(navBtn(membro, "Calendário")).toHaveCount(0);
        });
        await membro.goto("/agenda/marcacoes");
        await expect(membro).not.toHaveURL(/\/agenda\/marcacoes/, { timeout: 10_000 });

        // Reabrir a ficha confirma o que ficou gravado.
        await dono.reload();
        const ficha2 = await eq.openMember("Edna Editavel");
        await expect(ficha2.getByText("3 de 5")).toBeVisible();
        await eq.expand(ficha2, "Agenda");
        await expect(eq.node(ficha2, "Horário e configurações")).toBeChecked();
        await expect(eq.node(ficha2, "Calendário e marcações")).not.toBeChecked();
      } finally {
        await ctxDono.close();
        await ctxMembro.close();
      }
    });
  });
}

// ═══════════════════════════ (g) Acesso total ═══════════════════════════

test.describe("Árvore — 'Acesso total'", () => {
  test("o convite com 'Acesso total' envia todas as folhas do tenant e a ficha mostra os topos marcados", async ({ page, context }) => {
    const eq = new EquipaPage(page, context, OWNER_A);
    await eq.open();
    await page.getByRole("button", { name: "Convidar utilizador" }).click();
    const invite = page.getByRole("dialog", { name: "Convidar utilizador" });
    const email = `acesso.total.${Date.now()}@e2e.local`;
    await invite.getByLabel("Nome").fill("Olga Acessototal");
    await invite.getByLabel("Email").fill(email);
    await invite.getByRole("radio", { name: /Acesso total/ }).check();
    // Com "Acesso total" a árvore não se mostra.
    await expect(invite.getByRole("list", { name: "Permissões" })).toHaveCount(0);
    const req = page.waitForRequest((r) => r.method() === "POST" && /\/team$/.test(r.url()));
    await invite.getByRole("button", { name: "Enviar convite" }).click();
    const sent = (await req).postDataJSON() as { grants: { key: string; level: string }[] };
    expect(sent.grants.map((g) => g.key).sort()).toEqual([...ALL_LEAF_KEYS].sort());
    const edits = sent.grants.filter((g) => g.level === "edit").length;
    // Só-ver por desenho: Estatísticas e as 4 folhas da 2c (Dashboard, O Negócio, Agenda, Loja do Financeiro).
    expect(edits, "tudo ao nível máximo (excepto as folhas só-ver)").toBe(ALL_LEAF_KEYS.length - 5);

    const ficha = await eq.openMember("Olga Acessototal");
    for (const topo of ["Agenda", "Loja", "Ginásio", "Clientes", "Financeiro", "Conteúdos", "Páginas", "Estatísticas do site", "Mensagens"]) {
      await expect(eq.node(ficha, topo), topo).toBeChecked();
    }
    // Remove o convite de teste (deixa o tenant como estava).
    await ficha.getByRole("button", { name: "Remover" }).click();
    await page.getByRole("button", { name: "Remover" }).last().click();
    await expect(eq.row("Olga Acessototal")).toHaveCount(0, { timeout: 10_000 });
  });

  test("o membro de acesso total vê todos os módulos do tenant, nunca Faturação / Perfil do negócio / Cupões", async ({ page, context, request }) => {
    await enter(page, context, M.total, "/clientes", async () => {
      await expect(page.getByText("Cliente Ametista Rosa").first()).toBeVisible({ timeout: 10_000 });
    });
    for (const modulo of ["Clientes", "Mensagens", "Conteúdos", "Estatísticas", "Loja", "Agenda", "Ginásio", "Financeiro", "Páginas", "Dashboard"]) { // Dashboard desde a 2c (folha `dashboard` no acesso total)
      await expect(navBtn(page, modulo), modulo).toBeVisible();
    }
    for (const fora of ["Faturação", "Admin", "Equipa"]) {
      await expect(navBtn(page, fora), fora).toHaveCount(0);
    }
    // Rotas do dono: expulsas. O perfil é o do membro (sem dados do negócio).
    for (const route of ["/faturacao", "/equipa", "/admin"]) {
      await page.goto(route);
      await expect(page, route).not.toHaveURL(new RegExp(`${route}$`), { timeout: 10_000 });
    }
    await page.goto("/perfil");
    await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Tania Total", { timeout: 10_000 });
    for (const absent of ["Nome do negócio", "Logótipo", "Acesso de suporte", "Faturação", "Cupões"]) {
      await expect(page.getByText(absent)).toHaveCount(0);
    }
    // Fronteira da API: cupões e billing são só do dono.
    const membro = auth(await tokenOf(request, M.total));
    for (const url of ["/coupons", "/billing/subscription"]) {
      const res = await request.get(`${API}${url}`, { headers: membro });
      expect(res.status(), `${url} para um membro`).toBe(403);
    }
    const dono = auth(await tokenOf(request, OWNER_A));
    expect((await request.get(`${API}/coupons`, { headers: dono })).status()).toBe(200);
  });
});

// ═══════════════════════════ (h) isolamento ═══════════════════════════

test.describe("Árvore — isolamento multi-tenant dos membros", () => {
  const A_ONLY = /Basalto|BSL-ARV|Remo Basalto|88[.,]5|41[.,]75/;
  const B_ONLY = /Ametista|AMT-ARV|Remo Ametista/;

  /** Visita cada página com dados e devolve o texto do DOM acumulado. */
  async function percorrer(page: Page, rotas: { path: string; espera: string | RegExp }[]): Promise<string> {
    let all = "";
    for (const r of rotas) {
      await page.goto(r.path);
      await expect(page.getByText(r.espera).first(), `${r.path}: dados do próprio tenant`).toBeVisible({ timeout: 15_000 });
      all += `\n##${r.path}\n` + (await domText(page));
    }
    return all;
  }

  test("membro do A (acesso total) nunca vê dados do B em nenhuma página", async ({ page, context }) => {
    await enter(page, context, M.total, "/clientes", async () => {
      await expect(page.getByText("Cliente Ametista Rosa").first()).toBeVisible({ timeout: 10_000 });
    });
    const texto = await percorrer(page, [
      { path: "/clientes", espera: "Cliente Ametista Rosa" },
      { path: "/agenda/marcacoes", espera: "Marc Ametista Paga" },
      { path: "/agenda/servicos", espera: "Corte Ametista" },
      { path: "/loja", espera: "AMT-ARV-1" },
      { path: "/ginasio", espera: "Remo Ametista" },
    ]);
    expect(texto).not.toMatch(A_ONLY);
    expect(texto).toMatch(/Ametista/);
  });

  test("membro do B (acesso total) nunca vê dados do A, e vice-versa nos deep-links de recurso alheio", async ({ page, context, request }) => {
    const dono = auth(await tokenOf(request, OWNER_A));
    const custA = listOf(await (await request.get(`${API}/customers`, { headers: dono })).json())[0].customerId as string;
    const prodA = listOf(await (await request.get(`${API}/products`, { headers: dono })).json())[0].productId as string;
    const apptA = listOf(await (await request.get(`${API}/schedule/appointments`, { headers: dono })).json())[0].appointmentId as string;

    await enter(page, context, M.totalB, "/clientes", async () => {
      await expect(page.getByText("Cliente Basalto Cinza").first()).toBeVisible({ timeout: 10_000 });
    });
    const texto = await percorrer(page, [
      { path: "/clientes", espera: "Cliente Basalto Cinza" },
      { path: "/agenda/marcacoes", espera: "Marc Basalto Paga" },
      { path: "/agenda/servicos", espera: "Corte Basalto" },
      { path: "/loja", espera: "BSL-ARV-1" },
      { path: "/ginasio", espera: "Remo Basalto" },
    ]);
    expect(texto).not.toMatch(B_ONLY);

    // Deep-links de recurso do A, com sessão do B: nem o recurso nem o modal.
    await page.goto(`/clientes?cliente=${custA}`);
    await expect(page.getByText("Cliente Basalto Cinza").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("dialog", { name: "Ficha de cliente" })).toHaveCount(0);
    expect(await domText(page)).not.toMatch(B_ONLY);
    await page.goto(`/loja?openProduct=${prodA}`);
    await expect(page.getByText("BSL-ARV-1").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await domText(page)).not.toMatch(B_ONLY);
    await page.goto(`/agenda/marcacoes?marcacao=${apptA}`);
    await expect(page.getByText("Marc Basalto Paga").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await domText(page)).not.toMatch(B_ONLY);

    // Fronteira da API: o token do membro do B nunca lê recursos do A (404/403 e sem vazar o nome).
    const memB = auth(await tokenOf(request, M.totalB));
    for (const url of [`/customers/${custA}`, `/customers/${custA}/history`, `/customers/${custA}/export`, `/products/${prodA}`, `/schedule/appointments/${apptA}`]) {
      const res = await request.get(`${API}${url}`, { headers: memB });
      expect([403, 404], `${url} com token de membro do B → ${res.status()}`).toContain(res.status());
      expect(await res.text()).not.toMatch(B_ONLY);
    }
    // Escrever também não: um PUT a um serviço/produto do A não passa (nem altera nada).
    const put = await request.put(`${API}/products/${prodA}`, { headers: memB, data: { price: 1 } });
    expect([403, 404], `PUT /products/${prodA} → ${put.status()}`).toContain(put.status());
  });

  test("membros com folhas parciais do A também só vêem o A (marcações sem valores, loja sem custo, clientes em ver)", async ({ page, context }) => {
    await enter(page, context, M.semValores, "/agenda/marcacoes", async () => {
      await expect(page.getByText("Marc Ametista Paga").first()).toBeVisible({ timeout: 10_000 });
    });
    await page.goto("/clientes");
    await expect(page.getByText("Cliente Ametista Rosa").first()).toBeVisible({ timeout: 10_000 });
    expect(await domText(page)).not.toMatch(A_ONLY);
    await loginAs(context, M.lojaSemCusto);
    await page.goto("/loja");
    await expect(page.getByText("AMT-ARV-1").first()).toBeVisible({ timeout: 10_000 });
    expect(await domText(page)).not.toMatch(A_ONLY);
  });
});
