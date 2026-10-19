import { test, expect, request as pwRequest, type Page, type BrowserContext, type APIRequestContext } from "@playwright/test";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";

/**
 * R3.2 — MENSAGENS (B43) no Backoffice: separadores Clientes e Backoffice (1440 / 834 / 390).
 *
 * Tenant `equipa@e2e.local` ("Barbearia Navalha") e o membro semeado `membro@e2e.local` (Ana Membro: agenda ver ·
 * clientes editar). A conversa de cliente cria-se pela API do próprio cliente: o admin (`admin@e2e`) cria um site
 * token do tenant, o cliente regista-se, entra e escreve. As folhas da Ana mudam por teste (pela API do dono) e
 * repõem-se no fim. O admin da plataforma (só Suporte) está coberto em `chat.spec.ts`.
 */
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial", retries: 0 });

const DONO = "equipa@e2e.local";
const MEMBRO = "membro@e2e.local";
const MEMBRO_NOME = "Ana Membro";
const ADMIN = "admin@e2e";

const VIEWPORTS = [
  { label: "computador 1440", width: 1440, height: 900 },
  { label: "tablet 834", width: 834, height: 1112 },
  { label: "telemóvel 390", width: 390, height: 844 },
] as const;

type Headers = Record<string, string>;
type Grant = { key: string; level: "view" | "edit"; scope?: string };

// ── helpers de API ─────────────────────────────────────────────────────────────

async function login(api: APIRequestContext, username: string): Promise<{ headers: Headers; userId: string }> {
  const res = await api.post(`${API}/users/login`, {
    data: { username, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${username} (${res.status()})`).toBeTruthy();
  const body = await res.json();
  return { headers: { Authorization: `Bearer ${body.accessToken as string}` }, userId: body.userId as string };
}

interface Cliente {
  customerId: string;
  name: string;
  headers: Headers;
  conversationId: string;
}

let api: APIRequestContext;
let owner: Headers;
let siteToken: { token: string; tokenId: string };
let anaId: string;
let anaBase: Grant[] = [];
let seq = 0;

/** Cliente novo do tenant (registo + login com o site token) que abre a conversa e escreve a 1.ª mensagem. */
async function novoCliente(mark: string, firstMessage: string): Promise<Cliente> {
  seq += 1;
  const email = `chat.${Date.now()}.${seq}@e2e.local`;
  const name = `Cliente Chat ${mark}`;
  const site = { "x-site-token": siteToken.token, "CF-Connecting-IP": nextClientIp() };
  const reg = await api.post(`${API}/websites/customers/autentication/register`, {
    headers: site,
    data: { name, email, password: E2E_PASSWORD, contact: "910000777" },
  });
  expect(reg.ok(), `registo do cliente (${reg.status()} ${await reg.text()})`).toBeTruthy();
  const log = await api.post(`${API}/websites/customers/autentication/login`, {
    headers: { ...site, "CF-Connecting-IP": nextClientIp() },
    data: { provider: "credentials", email, password: E2E_PASSWORD },
  });
  expect(log.ok(), `login do cliente (${log.status()})`).toBeTruthy();
  const body = await log.json();
  const headers = { Authorization: `Bearer ${body.accessToken as string}`, "x-site-token": siteToken.token };
  const conv = await api.post(`${API}/websites/customers/messages/conversations`, { headers, data: {} });
  expect([200, 201], `abrir a conversa (${conv.status()})`).toContain(conv.status());
  const conversationId = (await conv.json()).conversationId as string;
  const sent = await api.post(`${API}/websites/customers/messages/conversations/${conversationId}/messages`, {
    headers,
    data: { body: firstMessage },
  });
  expect(sent.ok(), `mensagem do cliente (${sent.status()})`).toBeTruthy();
  return { customerId: body.customerId ?? body.customer?.customerId, name, headers, conversationId };
}

/** Folhas da Ana: as originais + estas (substitui — o PUT leva a lista completa). */
async function setAnaGrants(extra: Grant[]): Promise<void> {
  const res = await api.put(`${API}/team/${anaId}`, {
    headers: owner,
    data: { grants: [...anaBase, ...extra].map(({ key, level }) => ({ key, level })) },
  });
  expect(res.ok(), `folhas da Ana (${res.status()} ${await res.text()})`).toBeTruthy();
}

test.beforeAll(async () => {
  api = await pwRequest.newContext();
  const o = await login(api, DONO);
  owner = o.headers;
  const admin = await login(api, ADMIN);
  const tk = await api.post(`${API}/site-tokens`, { headers: admin.headers, data: { label: "e2e mensagens", userId: o.userId } });
  expect(tk.ok(), `site token (${tk.status()} ${await tk.text()})`).toBeTruthy();
  const tkBody = await tk.json();
  siteToken = { token: tkBody.token, tokenId: tkBody.tokenId };

  const team = await (await api.get(`${API}/team`, { headers: owner })).json();
  const list: any[] = Array.isArray(team) ? team : (team.rows ?? team.members ?? []);
  const ana = list.find((m) => m.email === MEMBRO);
  expect(ana, "o membro semeado devia existir").toBeTruthy();
  anaId = ana.memberId;
  anaBase = (ana.grants ?? [])
    .filter((g: any) => !String(g.key).startsWith("mensagens"))
    .map((g: any) => ({ key: g.key, level: g.level, ...(g.scope ? { scope: g.scope } : {}) }));
});

test.afterAll(async () => {
  try {
    await setAnaGrants([]);
    const admin = await login(api, ADMIN);
    await api.delete(`${API}/site-tokens/${siteToken.tokenId}`, { headers: admin.headers });
  } finally {
    await api.dispose();
  }
});

// ── helpers de UI ──────────────────────────────────────────────────────────────

async function enter(page: Page, context: BrowserContext, user: string, path: string, ready: () => Promise<void>): Promise<void> {
  await loginAs(context, user);
  await withSessionRetry(page, context, user, () => page.goto(path), ready);
}

const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
const thread = (page: Page) => page.getByRole("log");
const composer = (page: Page) => page.getByRole("textbox", { name: "Mensagem" });
const send = (page: Page) => page.getByRole("button", { name: "Enviar" });
const clientRow = (page: Page, name: string) => page.getByTestId("customer-conversation").filter({ hasText: name });

function forEachViewport(title: string, body: (vp: (typeof VIEWPORTS)[number]) => void) {
  for (const vp of VIEWPORTS) {
    test.describe(`${title} · ${vp.label}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });
      body(vp);
    });
  }
}

// ═══════════════════ 1. Clientes ═══════════════════

forEachViewport("Mensagens — separador Clientes", (vp) => {
  test("o dono vê os dois separadores; a lista traz a conversa; abrir mostra o fio e responder chega ao cliente", async ({ page, context }) => {
    const mark = `${vp.width}-${Date.now()}`;
    const pergunta = `Posso mudar a marcação? ${mark}`;
    const resposta = `Claro, mudamos ${mark}`;
    const cli = await novoCliente(mark, pergunta);

    await enter(page, context, DONO, "/mensagens", async () => {
      await expect(tab(page, "Clientes")).toBeVisible({ timeout: 15_000 });
    });
    await expect(tab(page, "Backoffice")).toBeVisible();

    // Mais recente em cima + pré-visualização + por ler.
    const row = clientRow(page, cli.name);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText(pergunta);
    await expect(row.getByTestId("conversation-unread")).toHaveText("1");
    await expect(page.getByTestId("customer-conversation").first()).toContainText(cli.name);

    // Filtro "Por ler" contém-na; pesquisa por nome isola-a.
    await page.getByRole("button", { name: /Por ler/ }).click();
    await expect(clientRow(page, cli.name)).toBeVisible();
    await page.getByRole("button", { name: "Todas" }).click();
    await page.getByRole("textbox", { name: "Procurar cliente" }).fill(cli.name);
    await expect(page.getByTestId("customer-conversation")).toHaveCount(1);

    // Abrir → fio com a mensagem; marca lida ao abrir.
    await clientRow(page, cli.name).click();
    await expect(thread(page).getByText(pergunta)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("conversation-title")).toHaveText(cli.name);
    await expect(clientRow(page, cli.name).getByTestId("conversation-unread")).toHaveCount(0, { timeout: 10_000 });
    // Marcada lida ao abrir: já não está entre as "por ler" do dono (pela API).
    await expect
      .poll(async () => {
        const r = await (await api.get(`${API}/messages/customers/conversations?filter=unread`, { headers: owner })).json();
        return (r.conversations as { conversationId: string }[]).some((c) => c.conversationId === cli.conversationId);
      })
      .toBe(false);

    // Responder (cria a mensagem do negócio; o cliente vê-a pela sua API, sem o nome de membros).
    await composer(page).fill(resposta);
    await send(page).click();
    await expect(thread(page).getByText(resposta)).toBeVisible({ timeout: 10_000 });
    const fio = await (await api.get(`${API}/websites/customers/messages/conversations/${cli.conversationId}/messages`, { headers: cli.headers })).json();
    expect(JSON.stringify(fio)).toContain(resposta);
  });

  test("a ficha do cliente tem 'Abrir conversa' (com o contador) e leva ao fio no separador Clientes", async ({ page, context }) => {
    const mark = `ficha-${vp.width}-${Date.now()}`;
    const cli = await novoCliente(mark, `Olá da ficha ${mark}`);

    await enter(page, context, DONO, `/clientes?cliente=${cli.customerId}`, async () => {
      await expect(page.getByText("Ficha de cliente")).toBeVisible({ timeout: 15_000 });
    });
    const atalho = page.getByTestId("open-customer-conversation");
    await expect(atalho).toBeVisible({ timeout: 10_000 });
    await expect(atalho).toContainText("Abrir conversa");
    await atalho.click();
    await expect(page).toHaveURL(new RegExp(`/mensagens\\?conversa=${cli.conversationId}`));
    await expect(thread(page).getByText(`Olá da ficha ${mark}`)).toBeVisible({ timeout: 10_000 });
  });

  test("um cliente sem conversa não mostra o atalho", async ({ page, context }) => {
    const list = await (await api.get(`${API}/customers`, { headers: owner })).json();
    const rows: any[] = Array.isArray(list) ? list : (list.rows ?? list.customers ?? []);
    const sem = rows.find((c) => c.name === "Cliente da Navalha");
    expect(sem, "cliente semeado do tenant").toBeTruthy();
    await enter(page, context, DONO, `/clientes?cliente=${sem.customerId}`, async () => {
      await expect(page.getByText("Ficha de cliente")).toBeVisible({ timeout: 15_000 });
    });
    await expect(page.getByTestId("open-customer-conversation")).toHaveCount(0);
  });
});

// ═══════════════════ 2. Backoffice: Suporte + equipa ═══════════════════

forEachViewport("Mensagens — separador Backoffice", (vp) => {
  test("Suporte fixo em primeiro; conversa dono ↔ membro 1-para-1 nos dois sentidos", async ({ browser, page, context }) => {
    await setAnaGrants([{ key: "mensagens.equipa", level: "edit" }]);
    const mark = `eq-${vp.width}-${Date.now()}`;
    const doDono = `Ana, passa pelo balcão ${mark}`;
    const daAna = `Já vou ${mark}`;

    await enter(page, context, DONO, "/mensagens/backoffice", async () => {
      await expect(tab(page, "Backoffice")).toBeVisible({ timeout: 15_000 });
    });
    // Suporte em primeiro, depois a equipa (a Ana).
    await expect(page.getByTestId("support-conversation")).toBeVisible({ timeout: 15_000 });
    const rowAna = page.getByTestId("team-conversation").filter({ hasText: MEMBRO_NOME });
    await expect(rowAna).toBeVisible();
    const buttons = page.getByTestId("messages-split").locator("aside button");
    await expect(buttons.first()).toContainText("Suporte");

    // Dono escreve à Ana (a conversa abre no 1.º envio).
    await rowAna.click();
    await expect(page.getByTestId("conversation-title")).toHaveText(MEMBRO_NOME);
    await composer(page).fill(doDono);
    await send(page).click();
    await expect(thread(page).getByText(doDono)).toBeVisible({ timeout: 10_000 });

    // A Ana (outro contexto, viewport igual) vê-a no Backoffice, em "Dono", por ler; abre e responde.
    const anaCtx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    try {
      await loginAs(anaCtx, MEMBRO);
      const anaPage = await anaCtx.newPage();
      await anaPage.goto("/mensagens/backoffice");
      const rowDono = anaPage.getByTestId("team-conversation").filter({ hasText: "Dono" }).first();
      await expect(rowDono).toBeVisible({ timeout: 15_000 });
      await expect(rowDono).toContainText(doDono);
      await expect(rowDono.getByTestId("conversation-unread")).toBeVisible();
      await rowDono.click();
      await expect(thread(anaPage).getByText(doDono)).toBeVisible({ timeout: 10_000 });
      await composer(anaPage).fill(daAna);
      await send(anaPage).click();
      await expect(thread(anaPage).getByText(daAna)).toBeVisible({ timeout: 10_000 });

      // O dono recebe a resposta em tempo real (SSE `team_message`) na conversa aberta.
      await expect(thread(page).getByText(daAna)).toBeVisible({ timeout: 20_000 });
    } finally {
      await anaCtx.close();
    }
  });

  test("o Suporte abre dentro do separador e o tenant escreve ao suporte", async ({ page, context }) => {
    const mark = `sup-${vp.width}-${Date.now()}`;
    await enter(page, context, DONO, "/mensagens/backoffice", async () => {
      await expect(page.getByTestId("support-conversation")).toBeVisible({ timeout: 15_000 });
    });
    await page.getByTestId("support-conversation").click();
    await expect(page.getByTestId("conversation-title")).toHaveText("Suporte");
    await composer(page).fill(`olá suporte ${mark}`);
    await send(page).click();
    await expect(thread(page).getByText(`olá suporte ${mark}`)).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════ 3. Permissões da equipa ═══════════════════

forEachViewport("Mensagens — membro por folha", (vp) => {
  test("sem `mensagens.clientes` o membro não vê o separador Clientes (nem a API lhe responde)", async ({ page, context }) => {
    await setAnaGrants([{ key: "mensagens.equipa", level: "view" }, { key: "mensagens.suporte", level: "view" }]);
    await enter(page, context, MEMBRO, "/mensagens", async () => {
      await expect(page.getByTestId("messages-split")).toBeVisible({ timeout: 15_000 });
    });
    // Levado ao Backoffice; sem mais separadores não há barra.
    await expect(page).toHaveURL(/\/mensagens\/backoffice/);
    await expect(tab(page, "Clientes")).toHaveCount(0);
    await expect(page.getByPlaceholder("Procurar cliente…")).toHaveCount(0);

    const ana = await pwRequest.newContext();
    try {
      const t = await login(ana, MEMBRO);
      const res = await ana.get(`${API}/messages/customers/conversations`, { headers: t.headers });
      expect(res.status()).toBe(403);
    } finally {
      await ana.dispose();
    }
  });

  test("com `mensagens.clientes` só Ver o membro lê a conversa mas não escreve", async ({ page, context }) => {
    const mark = `sv-${vp.width}-${Date.now()}`;
    const cli = await novoCliente(mark, `Pergunta ${mark}`);
    await setAnaGrants([{ key: "mensagens.clientes", level: "view" }]);
    await enter(page, context, MEMBRO, `/mensagens?conversa=${cli.conversationId}`, async () => {
      await expect(thread(page)).toBeVisible({ timeout: 15_000 });
    });
    await expect(thread(page).getByText(`Pergunta ${mark}`)).toBeVisible({ timeout: 10_000 });
    // Sem a folha da equipa/Suporte: nenhum separador Backoffice.
    await expect(tab(page, "Backoffice")).toHaveCount(0);
    await expect(composer(page)).toBeDisabled();
    await expect(send(page)).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: "Só tens permissão para ver" })).toBeVisible();
  });

  test("com `mensagens.clientes` Responder o membro responde ao cliente", async ({ page, context }) => {
    const mark = `rp-${vp.width}-${Date.now()}`;
    const cli = await novoCliente(mark, `Pergunta ${mark}`);
    await setAnaGrants([{ key: "mensagens.clientes", level: "edit" }]);
    await enter(page, context, MEMBRO, `/mensagens?conversa=${cli.conversationId}`, async () => {
      await expect(thread(page)).toBeVisible({ timeout: 15_000 });
    });
    await expect(composer(page)).toBeEnabled();
    await composer(page).fill(`Resposta da Ana ${mark}`);
    await send(page).click();
    await expect(thread(page).getByText(`Resposta da Ana ${mark}`)).toBeVisible({ timeout: 10_000 });
  });
});
