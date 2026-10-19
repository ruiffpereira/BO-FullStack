import { test, expect, request as pwRequest, type Page, type BrowserContext, type APIRequestContext } from "@playwright/test";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { EquipaPage } from "./pages/EquipaPage";

/**
 * R2.2 — PROFISSIONAIS no Backoffice (1440 / 834 / 390).
 *
 * Tenant: `equipa@e2e.local` ("Barbearia Navalha": Agenda + Clientes + Loja + Despesas, serviço "Corte Navalha", cliente
 * "Cliente da Navalha"). Só o `equipa.spec.ts` o usa e corre antes (ordem alfabética), por isso criar profissionais aqui
 * não estraga mais nada. Os profissionais "de apoio" criam-se pela API (o seed não se toca).
 *
 * O membro "Só os meus" é o `meus@e2e.local` (Mário Pessoal): o seed dá-lhe `agenda.marcacoes` Ver com âmbito `meus` e
 * liga-o ao profissional "Pedro Tesoura" (R6.0) — nada aqui mexe nas folhas do `membro@e2e.local`. A Ana só serve para o
 * teste de ligar/desligar um profissional (que se desfaz a si próprio).
 */
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial", retries: 0 });

const DONO = "equipa@e2e.local";
const MEMBRO = "membro@e2e.local";
const MEMBRO_NOME = "Ana Membro";
// Seed R6.0 (`E2E_TEAM_MEMBERS.meus` / `E2E_TEAM_STAFF`): «Só os meus», ligado ao profissional Pedro Tesoura.
const MEUS = "meus@e2e.local";
const MEUS_NOME = "Mário Pessoal";
const MEUS_STAFF = "Pedro Tesoura";

const VIEWPORTS = [
  { label: "computador 1440", width: 1440, height: 900 },
  { label: "tablet 834", width: 834, height: 1112 },
  { label: "telemóvel 390", width: 390, height: 844 },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const now = new Date();
/** Hoje, no fuso do browser/máquina (é o que a «Nova marcação» propõe). */
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

// ── helpers de API ─────────────────────────────────────────────────────────────

type Headers = Record<string, string>;

async function tokenOf(api: APIRequestContext, username: string): Promise<Headers> {
  const res = await api.post(`${API}/users/login`, {
    data: { username, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${username} (${res.status()})`).toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).accessToken as string}` };
}

const listOf = (body: any): any[] => (Array.isArray(body) ? body : (body.rows ?? []));

async function mkStaff(api: APIRequestContext, h: Headers, data: Record<string, unknown>): Promise<{ staffId: string; name: string }> {
  const res = await api.post(`${API}/schedule/staff`, { headers: h, data });
  expect(res.ok(), `criar profissional ${data.name} (${res.status()} ${await res.text()})`).toBeTruthy();
  return res.json();
}

async function mkAppt(api: APIRequestContext, h: Headers, p: { serviceId: string; staffId: string; time: string; name: string }) {
  const res = await api.post(`${API}/schedule/appointments`, {
    headers: h,
    data: { date: TODAY, time: p.time, serviceId: p.serviceId, staffId: p.staffId, clientName: p.name, clientEmail: "", clientPhone: "" },
  });
  expect(res.ok(), `criar marcação ${p.name} (${res.status()} ${await res.text()})`).toBeTruthy();
  return res.json();
}

async function staffByName(api: APIRequestContext, h: Headers, name: string): Promise<any> {
  const res = await api.get(`${API}/schedule/staff`, { headers: h });
  expect(res.ok()).toBeTruthy();
  const found = listOf(await res.json()).find((s) => s.name === name);
  expect(found, `profissional ${name} devia existir`).toBeTruthy();
  return found;
}

async function staffDetail(api: APIRequestContext, h: Headers, id: string): Promise<any> {
  const res = await api.get(`${API}/schedule/staff/${id}`, { headers: h });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// ── estado partilhado (criado pela API, uma vez) ────────────────────────────────

let api: APIRequestContext;
let owner: Headers;
let svc: { serviceId: string; name: string };
let ocupado: { staffId: string; name: string };
let ferias: { staffId: string; name: string };
let ligar: { staffId: string; name: string };
let membro: { memberId: string };
let meuStaff: { staffId: string; name: string };
let meuSetupDone = false;

test.beforeAll(async () => {
  api = await pwRequest.newContext();
  owner = await tokenOf(api, DONO);

  const services = listOf(await (await api.get(`${API}/schedule/services`, { headers: owner })).json());
  const first = services.find((s) => s.active !== false) ?? services[0];
  expect(first, "o tenant devia ter um serviço").toBeTruthy();
  svc = { serviceId: first.serviceId, name: first.name };

  ocupado = await mkStaff(api, owner, { name: "Ocupado E2E", color: "#E0733A" });
  ferias = await mkStaff(api, owner, { name: "Ferias E2E", color: "#7C5CDB" });
  ligar = await mkStaff(api, owner, { name: "Ligar E2E", color: "#1F8A5B" });
  // O "Ocupado" já tem uma marcação hoje às 09:00; o "Ferias" está de folga hoje.
  await mkAppt(api, owner, { serviceId: svc.serviceId, staffId: ocupado.staffId, time: "09:00", name: "Cliente Ocupado E2E" });
  const off = await api.post(`${API}/schedule/staff/${ferias.staffId}/time-off`, {
    headers: owner,
    data: { startDate: TODAY, endDate: TODAY, reason: "Folga E2E" },
  });
  expect(off.ok(), `folga do Ferias (${off.status()})`).toBeTruthy();

  const team = listOf(await (await api.get(`${API}/team`, { headers: owner })).json());
  const ana = team.find((m) => m.email === MEMBRO);
  expect(ana, "o membro semeado devia existir").toBeTruthy();
  membro = { memberId: ana.memberId };
  meuStaff = await staffByName(api, owner, MEUS_STAFF);
});

test.afterAll(async () => {
  await api.dispose();
});

// ── helpers de UI ──────────────────────────────────────────────────────────────

async function enter(page: Page, context: BrowserContext, user: string, path: string, ready: () => Promise<void>): Promise<void> {
  await loginAs(context, user);
  await withSessionRetry(page, context, user, () => page.goto(path), ready);
}

const dialog = (page: Page) => page.getByRole("dialog").first();

function forEachViewport(title: string, body: (vp: (typeof VIEWPORTS)[number]) => void) {
  for (const vp of VIEWPORTS) {
    test.describe(`${title} · ${vp.label}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });
      body(vp);
    });
  }
}

// ═══════════════════ 1. Agenda → Profissionais ═══════════════════

forEachViewport("Profissionais — criar e configurar", (vp) => {
  const nome = `Prof ${vp.width}`;

  test("criar um profissional (nome, cor) e ele aparece na lista", async ({ page, context }) => {
    await enter(page, context, DONO, "/agenda/profissionais", async () => {
      await expect(page.getByRole("button", { name: "Novo profissional" }).first()).toBeVisible({ timeout: 10_000 });
    });
    await page.getByRole("button", { name: "Novo profissional" }).first().click();
    const dlg = dialog(page);
    await dlg.getByLabel("Nome", { exact: true }).fill(nome);
    await dlg.getByRole("button", { name: "Criar profissional" }).click();
    await expect(page.getByText("Profissional criado", { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    // Depois de criar, os outros separadores abrem-se.
    await expect(dlg.getByRole("tab", { name: "Serviços" })).toBeEnabled();
    await expect(dlg.getByRole("tab", { name: "Horário" })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("list", { name: "Profissionais" }).getByText(nome, { exact: true })).toBeVisible();
    const s = await staffByName(api, owner, nome);
    expect(s.active).toBe(true);
    expect(s.showOnSite).toBe(true);
  });

  test("preço próprio por serviço (vazio = o normal) grava-se", async ({ page, context }) => {
    await enter(page, context, DONO, "/agenda/profissionais", async () => {
      await expect(page.getByRole("button", { name: `Editar ${nome}` })).toBeVisible({ timeout: 10_000 });
    });
    await page.getByRole("button", { name: `Editar ${nome}` }).click();
    const dlg = dialog(page);
    await dlg.getByRole("tab", { name: "Serviços" }).click();
    const preco = dlg.getByLabel(`Preço próprio em ${svc.name}`);
    await expect(preco).toBeVisible();
    await expect(preco).toHaveValue(""); // vazio = o normal
    await expect(preco).not.toHaveAttribute("readonly"); // o dono tem `precos`
    await preco.fill("9.5");
    const put = page.waitForResponse((r) => r.request().method() === "PUT" && /\/schedule\/staff\/[^/]+\/services/.test(r.url()));
    await dlg.getByRole("button", { name: "Guardar serviços" }).click();
    expect((await put).ok()).toBeTruthy();
    const s = await staffByName(api, owner, nome);
    const det = await staffDetail(api, owner, s.staffId);
    const rule = det.services.find((r: any) => r.serviceId === svc.serviceId);
    expect(Number(rule?.price)).toBe(9.5);
    expect(rule?.excluded).toBe(false);
  });

  test("tirar o profissional de um serviço (desmarcar = excluído) e vê-lo na ficha do serviço", async ({ page, context }) => {
    await enter(page, context, DONO, "/agenda/profissionais", async () => {
      await expect(page.getByRole("button", { name: `Editar ${nome}` })).toBeVisible({ timeout: 10_000 });
    });
    await page.getByRole("button", { name: `Editar ${nome}` }).click();
    const dlg = dialog(page);
    await dlg.getByRole("tab", { name: "Serviços" }).click();
    const faz = dlg.getByRole("checkbox", { name: `Faz ${svc.name}` });
    await expect(faz).toBeChecked();
    await faz.uncheck();
    const put = page.waitForResponse((r) => r.request().method() === "PUT" && /\/schedule\/staff\/[^/]+\/services/.test(r.url()));
    await dlg.getByRole("button", { name: "Guardar serviços" }).click();
    expect((await put).ok()).toBeTruthy();
    const s = await staffByName(api, owner, nome);
    const det = await staffDetail(api, owner, s.staffId);
    expect(det.services.find((r: any) => r.serviceId === svc.serviceId)?.excluded).toBe(true);

    // Ficha do serviço: "Disponível no site" e a lista de quem o faz (este profissional já não faz).
    await page.keyboard.press("Escape");
    await page.goto("/agenda/servicos");
    await page.getByRole("button", { name: "Editar", exact: true }).first().click();
    const ficha = dialog(page);
    await expect(ficha.getByRole("switch", { name: "Disponível no site" })).toBeVisible({ timeout: 10_000 });
    const quem = ficha.getByTestId("service-staff");
    await expect(quem).toBeVisible({ timeout: 10_000 });
    await expect(quem).toContainText(nome);
    await expect(quem).toContainText("Ocupado E2E");
  });

  test("férias e folgas: adicionar e apagar", async ({ page, context }) => {
    const motivo = `Férias ${vp.width}`;
    await enter(page, context, DONO, "/agenda/profissionais", async () => {
      await expect(page.getByRole("button", { name: `Editar ${nome}` })).toBeVisible({ timeout: 10_000 });
    });
    await page.getByRole("button", { name: `Editar ${nome}` }).click();
    const dlg = dialog(page);
    await dlg.getByRole("tab", { name: "Férias e folgas" }).click();
    await dlg.getByLabel("Motivo", { exact: false }).fill(motivo);
    await dlg.getByRole("button", { name: "Adicionar" }).click();
    const lista = dlg.getByRole("list", { name: "Férias e folgas" });
    await expect(lista).toContainText(motivo, { timeout: 10_000 });
    const s = await staffByName(api, owner, nome);
    expect((await staffDetail(api, owner, s.staffId)).timeOff.some((t: any) => t.reason === motivo)).toBe(true);

    await lista.getByRole("button", { name: /Apagar folga de/ }).first().click();
    await page.getByRole("dialog", { name: "Apagar esta folga?" }).getByRole("button", { name: "Eliminar" }).click();
    await expect(dlg.getByText("Sem férias nem folgas marcadas.")).toBeVisible({ timeout: 10_000 });
  });

  test("desactivar e apagar (sem histórico) um profissional", async ({ page, context }) => {
    await enter(page, context, DONO, "/agenda/profissionais", async () => {
      await expect(page.getByRole("button", { name: `Editar ${nome}` })).toBeVisible({ timeout: 10_000 });
    });
    const cartao = page.locator("li[data-staff]").filter({ hasText: nome });
    await cartao.getByRole("button", { name: "Desactivar", exact: true }).click();
    await expect(cartao.getByText("Inactivo", { exact: true })).toBeVisible({ timeout: 10_000 });
    await cartao.getByRole("button", { name: "Activar", exact: true }).click();
    await expect(cartao.getByText("Inactivo", { exact: true })).toHaveCount(0, { timeout: 10_000 });
  });
});

test("apagar um profissional COM histórico recusa com a mensagem em PT (STAFF_HAS_HISTORY)", async ({ page, context }) => {
  await enter(page, context, DONO, "/agenda/profissionais", async () => {
    await expect(page.getByRole("button", { name: `Editar ${ocupado.name}` })).toBeVisible({ timeout: 10_000 });
  });
  await page.getByRole("button", { name: `Apagar ${ocupado.name}` }).click();
  await page.getByRole("dialog", { name: `Apagar "${ocupado.name}"?` }).getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Tem histórico — desactiva-o em vez de apagar.")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("list", { name: "Profissionais" }).getByText(ocupado.name, { exact: true })).toBeVisible();
});

// ═══════════════════ 2. Agenda: filtro e marcação com profissional ═══════════════════

forEachViewport("Agenda — filtro e marcação com profissional", (vp) => {
  async function novaMarcacao(page: Page, staffName: string) {
    await page.getByRole("button", { name: "Nova marcação" }).first().click();
    const dlg = page.getByRole("dialog", { name: "Nova marcação" });
    await dlg.getByPlaceholder("Procurar cliente existente…").fill("Navalha");
    await dlg.getByRole("button", { name: /Cliente da Navalha/ }).click();
    await dlg.getByRole("button", { name: /Escolher serviço/ }).click();
    await page.getByRole("option", { name: new RegExp(svc.name) }).click();
    await dlg.getByRole("button", { name: "Profissional", exact: true }).click();
    await page.getByRole("option", { name: staffName }).click();
    await dlg.getByRole("button", { name: "Criar marcação" }).click();
    return dlg;
  }

  test("filtro por profissional: chips por cor, «Todos» / «Sem profissional»; o pedido leva ?staff=", async ({ page, context }) => {
    await enter(page, context, DONO, "/agenda", async () => {
      await expect(page.getByTestId("staff-chips")).toBeVisible({ timeout: 10_000 });
    });
    const chips = page.getByTestId("staff-chips");
    await expect(chips.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
    await expect(chips.getByRole("button", { name: "Sem profissional" })).toBeVisible();
    await expect(chips.getByRole("button", { name: ocupado.name })).toBeVisible();

    const req = page.waitForRequest((r) => r.url().includes("/schedule/appointments") && r.url().includes(`staff=${ocupado.staffId}`));
    await chips.getByRole("button", { name: ocupado.name }).click();
    await req;
    await expect(chips.getByRole("button", { name: ocupado.name })).toHaveAttribute("aria-pressed", "true");

    const none = page.waitForRequest((r) => r.url().includes("/schedule/appointments") && r.url().includes("staff=none"));
    await chips.getByRole("button", { name: "Sem profissional" }).click();
    await none;
  });

  test("marcação com profissional ocupado: avisa («Já tem marcação a essa hora») mas aceita", async ({ page, context }) => {
    await enter(page, context, DONO, "/agenda", async () => {
      await expect(page.getByRole("button", { name: "Nova marcação" }).first()).toBeVisible({ timeout: 10_000 });
    });
    await novaMarcacao(page, ocupado.name);
    await expect(page.getByText("Marcação criada").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Já tem marcação a essa hora.")).toBeVisible({ timeout: 10_000 });
    // Foi aceite: a marcação existe na API, com o profissional.
    const res = await api.get(`${API}/schedule/appointments?from=${TODAY}&to=${TODAY}&staff=${ocupado.staffId}`, { headers: owner });
    expect(listOf(await res.json()).filter((a) => a.staffId === ocupado.staffId).length).toBeGreaterThanOrEqual(2);
  });

  test("marcação com profissional de folga: avisa («Está de férias») mas aceita", async ({ page, context }) => {
    await enter(page, context, DONO, "/agenda", async () => {
      await expect(page.getByRole("button", { name: "Nova marcação" }).first()).toBeVisible({ timeout: 10_000 });
    });
    await novaMarcacao(page, ferias.name);
    await expect(page.getByText("Marcação criada").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Está de férias ou de folga nesse horário.")).toBeVisible({ timeout: 10_000 });
  });

  test("a lista de Marcações tem o filtro e a coluna Profissional (a partir de md)", async ({ page, context }) => {
    await enter(page, context, DONO, "/agenda/marcacoes", async () => {
      await expect(page.getByRole("combobox", { name: "Profissional" })).toBeVisible({ timeout: 10_000 });
    });
    const req = page.waitForRequest((r) => r.url().includes("/schedule/appointments") && r.url().includes(`staff=${ocupado.staffId}`));
    await page.getByRole("combobox", { name: "Profissional" }).selectOption({ label: ocupado.name });
    await req;
    if (vp.width >= 768) await expect(page.getByRole("columnheader", { name: "Profissional" })).toBeVisible();
  });
});

// ═══════════════════ 3. Financeiro, Despesas, Dashboard ═══════════════════

forEachViewport("Financeiro, Despesas e Dashboard", (vp) => {
  test("Financeiro: selector Global · Sem profissional · cada um muda o ?staff= (e Global tira-o)", async ({ page, context }) => {
    await enter(page, context, DONO, "/financeiro", async () => {
      await expect(page.getByRole("combobox", { name: "Profissional" })).toBeVisible({ timeout: 10_000 });
    });
    const sel = page.getByRole("combobox", { name: "Profissional" });
    const labels = await sel.locator("option").allTextContents();
    expect(labels.slice(0, 2)).toEqual(["Global", "Sem profissional"]);
    expect(labels).toContain(ocupado.name);

    const none = page.waitForRequest((r) => /\/financeiro\/negocio/.test(r.url()) && r.url().includes("staff=none"));
    await sel.selectOption({ label: "Sem profissional" });
    await none;

    const one = page.waitForRequest((r) => /\/financeiro\/negocio/.test(r.url()) && r.url().includes(`staff=${ocupado.staffId}`));
    await sel.selectOption({ label: ocupado.name });
    await one;

    const global = page.waitForRequest((r) => /\/financeiro\/negocio/.test(r.url()) && !r.url().includes("staff="));
    await sel.selectOption({ label: "Global" });
    await global;
  });

  test("Dashboard: o mesmo selector filtra o resumo (?staff=)", async ({ page, context }) => {
    await enter(page, context, DONO, "/dashboard", async () => {
      await expect(page.getByRole("combobox", { name: "Profissional" })).toBeVisible({ timeout: 10_000 });
    });
    const none = page.waitForRequest((r) => /\/dashboard\?/.test(r.url()) && r.url().includes("staff=none"));
    await page.getByRole("combobox", { name: "Profissional" }).selectOption({ label: "Sem profissional" });
    await none;
  });

  test("Despesas: campo Profissional (opcional) grava-se e aparece na lista", async ({ page, context }) => {
    const desc = `Despesa prof ${vp.width}`;
    await enter(page, context, DONO, "/financeiro/despesas", async () => {
      await expect(page.getByRole("button", { name: "Nova despesa" }).first()).toBeVisible({ timeout: 10_000 });
    });
    await page.getByRole("button", { name: "Nova despesa" }).first().click();
    const dlg = dialog(page);
    await dlg.getByPlaceholder("Ex: Fatura eletricidade").fill(desc);
    await dlg.getByPlaceholder("0.00").fill("12.50");
    await dlg.getByRole("button", { name: "Profissional", exact: true }).click();
    await page.getByRole("listbox").getByRole("option", { name: ocupado.name }).click();
    await dlg.getByRole("button", { name: "Registar" }).click();
    const linha = page.locator("div.group").filter({ hasText: desc }).first();
    await expect(linha).toBeVisible({ timeout: 10_000 });
    await expect(linha).toContainText(ocupado.name);
    const res = await api.get(`${API}/expenses?month=${TODAY.slice(0, 7)}`, { headers: owner });
    const exp = listOf(await res.json()).find((e) => e.description === desc);
    expect(exp?.staffId).toBe(ocupado.staffId);
  });

  test("Loja → Encomendas: coluna «Vendido por» (selector por encomenda)", async ({ page, context }) => {
    await enter(page, context, DONO, "/loja/encomendas", async () => {
      await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible({ timeout: 10_000 });
    });
    // O filtro de profissional existe sempre que o tenant tem profissionais.
    await expect(page.getByRole("combobox", { name: "Profissional" })).toBeVisible({ timeout: 10_000 });
    // Sem encomendas semeadas neste tenant, a coluna só aparece com linhas; garante-se pelo menos o cabeçalho.
    await expect(page.getByRole("columnheader", { name: "Vendido por" })).toBeVisible();
  });
});

// ═══════════════════ 4. Equipa: âmbito na árvore e separador Profissional ═══════════════════

forEachViewport("Equipa — âmbito [Todos | Só os meus] e ligação a um profissional", () => {
  test("a ficha mostra o âmbito «Só os meus» do Mário (seed) e os nós novos nascem fechados", async ({ page, context }) => {
    const equipa = new EquipaPage(page, context, DONO);
    await equipa.open();
    const ficha = await equipa.openMember(MEUS_NOME);
    await ficha.getByRole("button", { name: "Abrir Agenda" }).click();

    // Nós novos: aparecem como os outros e nascem fechados.
    const profissionais = ficha.getByRole("checkbox", { name: "Profissionais", exact: true });
    await expect(profissionais).toBeVisible();
    await expect(profissionais).not.toBeChecked();
    await ficha.getByRole("button", { name: "Abrir Profissionais" }).click();
    await expect(ficha.getByRole("checkbox", { name: "Preços por profissional", exact: true })).not.toBeChecked();

    // Âmbito: o seed já o pôs em «Só os meus» (nada se grava aqui, por isso nada há a repor).
    await expect(ficha.getByRole("tab", { name: "Calendário e marcações: âmbito só os meus" })).toHaveAttribute("aria-selected", "true");
    await expect(ficha.getByRole("tab", { name: "Calendário e marcações: âmbito todos" })).toHaveAttribute("aria-selected", "false");

    const team = listOf(await (await api.get(`${API}/team`, { headers: owner })).json());
    const mario = team.find((m) => m.email === MEUS);
    expect(mario.grants.find((g: any) => g.key === "agenda.marcacoes")?.scope).toBe("meus");
  });

  test("o convite tem o âmbito nos nós com âmbito (por omissão «Todos»)", async ({ page, context }) => {
    const equipa = new EquipaPage(page, context, DONO);
    await equipa.open();
    await page.getByRole("button", { name: "Convidar utilizador" }).first().click();
    const dlg = page.getByRole("dialog", { name: "Convidar utilizador" });
    await dlg.getByRole("button", { name: "Abrir Agenda" }).click();
    await dlg.getByRole("checkbox", { name: "Calendário e marcações", exact: true }).check();
    await expect(dlg.getByRole("tab", { name: "Calendário e marcações: âmbito todos" })).toHaveAttribute("aria-selected", "true");
    await expect(dlg.getByRole("tab", { name: "Calendário e marcações: âmbito só os meus" })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("separador Profissional: ligar o membro a um profissional e desligar", async ({ page, context }) => {
    const equipa = new EquipaPage(page, context, DONO);
    await equipa.open();
    const ficha = await equipa.openMember(MEMBRO_NOME);
    await ficha.getByRole("tab", { name: "Profissional" }).click();
    const tab = ficha.getByTestId("staff-link-tab");
    await tab.getByRole("button", { name: /Escolher profissional/ }).click();
    await page.getByRole("option", { name: ligar.name }).click();
    await tab.getByRole("button", { name: "Ligar", exact: true }).click();
    await expect(tab).toContainText(`Ligado a`, { timeout: 10_000 });
    await expect(tab).toContainText(ligar.name);
    expect((await staffDetail(api, owner, ligar.staffId)).memberId).toBe(membro.memberId);

    await tab.getByRole("button", { name: "Desligar" }).click();
    await expect(tab.getByRole("button", { name: "Ligar", exact: true })).toBeVisible({ timeout: 10_000 });
    expect((await staffDetail(api, owner, ligar.staffId)).memberId ?? null).toBeNull();
  });
});

// ═══════════════════ 5. Membro «Só os meus» só vê a agenda dele ═══════════════════

async function ensureMeuSetup() {
  if (meuSetupDone) return;
  // O seed já deu «Só os meus» ao Mário e ligou-o ao Pedro Tesoura: só faltam as marcações.
  await mkAppt(api, owner, { serviceId: svc.serviceId, staffId: meuStaff.staffId, time: "10:30", name: "Cliente Meu E2E" });
  await mkAppt(api, owner, { serviceId: svc.serviceId, staffId: ocupado.staffId, time: "11:30", name: "Cliente Colega E2E" });
  meuSetupDone = true;
}

forEachViewport("Membro «Só os meus»", () => {
  test("na API só vê as marcações do profissional ligado a ele (as do colega dão 404)", async () => {
    await ensureMeuSetup();
    const m = await tokenOf(api, MEUS);
    const list = listOf(await (await api.get(`${API}/schedule/appointments`, { headers: m })).json());
    const nomes = list.map((a) => a.clientName);
    expect(nomes).toContain("Cliente Meu E2E");
    expect(nomes).not.toContain("Cliente Colega E2E");
    expect(nomes).not.toContain("Cliente Ocupado E2E");

    const todas = listOf(await (await api.get(`${API}/schedule/appointments`, { headers: owner })).json());
    const colega = todas.find((a) => a.clientName === "Cliente Colega E2E");
    expect(colega).toBeTruthy();
    const um = await api.get(`${API}/schedule/appointments/${colega.appointmentId}`, { headers: m });
    expect(um.status()).toBe(404);
  });

  test("na UI a lista de Marcações só traz as marcações dele", async ({ page, context }) => {
    await ensureMeuSetup();
    await enter(page, context, MEUS, "/agenda/marcacoes", async () => {
      await expect(page.getByText("Cliente Meu E2E").first()).toBeVisible({ timeout: 10_000 });
    });
    await expect(page.getByText("Cliente Colega E2E")).toHaveCount(0);
    await expect(page.getByText("Cliente Ocupado E2E")).toHaveCount(0);
  });
});
