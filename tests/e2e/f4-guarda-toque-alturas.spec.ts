import { test, expect, request as pwRequest, type Page, type BrowserContext, type APIRequestContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";

/**
 * B57 · F4 — write-guard, rotas↔folhas, acções em toque, alturas.
 *
 * Regras: EQ-03 (Ver = botões desactivados com o motivo — incluindo o confirmar do apagar —, acções de linha visíveis em
 * toque/teclado), EQ-02/EQ-04 (default-deny; rota sem folha = só-leitura: provado no unitário `routesLeaves.test.ts`, ver nota
 * no fim) e a regra de alturas por flex (`docs/ARMADILHAS.md`): nenhuma página tem scroll duplo.
 *
 * Seed (`API-FullStack/scripts/seedE2e.ts`): dono `arvore-a@e2e.local`; só-ver `av-sover@e2e.local` (todas as folhas em Ver);
 * Editar em tudo `av-total@e2e.local`; `av-apagarver@e2e.local` (clientes.lista Ver + clientes.lista.apagar Editar — NOVO);
 * `equipa3@e2e.local` (dono) para o Remover da Equipa; `admin@e2e` para Admin.
 *
 * Os dados que o seed não tem (secção, subscrição, despesa, bloqueio) criam-se pela API como o dono e limpam-se no fim.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ retries: 0 });

const DONO = "arvore-a@e2e.local";
const SO_VER = "av-sover@e2e.local";
const TOTAL = "av-total@e2e.local";
const APAGAR_VER = "av-apagarver@e2e.local";
const VIEW_ONLY = "Só tens permissão para ver";

const SHOTS = path.resolve(".design", "b57-f4", "capturas");
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
  await withSessionRetry(page, context, user, () => page.goto(route), async () => {
    await expect(page.locator("header").first()).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe(route.split("?")[0]);
    await settled(page);
    if (ready) await ready();
  });
}

async function token(api: APIRequestContext, username: string): Promise<Record<string, string>> {
  const res = await api.post(`${API}/users/login`, {
    data: { username, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${username} (${res.status()})`).toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).accessToken as string}` };
}

const opacityOf = (loc: ReturnType<Page["locator"]>) => loc.evaluate((el) => parseFloat(getComputedStyle(el).opacity));

/** Largura a mais (px) do documento e do <main>. */
async function overflowX(page: Page): Promise<{ doc: number; main: number }> {
  return page.evaluate(() => {
    const de = document.documentElement;
    const m = document.querySelector("main");
    return { doc: de.scrollWidth - de.clientWidth, main: m ? m.scrollWidth - m.clientWidth : 0 };
  });
}

async function expectNoHScroll(page: Page, label: string): Promise<void> {
  const o = await overflowX(page);
  expect.soft(o.doc, `${label}: scroll horizontal da página (${o.doc}px)`).toBeLessThanOrEqual(1);
  expect.soft(o.main, `${label}: scroll horizontal do <main> (${o.main}px)`).toBeLessThanOrEqual(1);
}

/** «Sem scroll duplo»: o <main> não tem scroll próprio e o documento não excede a janela. */
async function expectFits(page: Page, label: string): Promise<void> {
  const m = await page.evaluate(() => {
    const main = document.querySelector("main")!;
    const se = document.scrollingElement!;
    return { mainOver: main.scrollHeight - main.clientHeight, docOver: se.scrollHeight - window.innerHeight };
  });
  expect.soft(m.mainOver, `${label}: o <main> tem scroll próprio (${m.mainOver}px)`).toBeLessThanOrEqual(1);
  expect.soft(m.docOver, `${label}: o documento excede a janela (${m.docOver}px)`).toBeLessThanOrEqual(1);
  await expectNoHScroll(page, label);
}

/** Simula a faixa do BillingBanner (pagamento em atraso, ainda em grace). */
async function withBanner(page: Page): Promise<void> {
  await page.route("**/billing/subscription", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reason: "grace", readOnly: false, graceEndsAt: "2099-01-01T00:00:00.000Z" }) })
      : route.continue(),
  );
}

// ── dados criados pela API (dono do arvoreA) ───────────────────────────────────

const SECAO = "Secção F4 Toque";
const SUBSCR = "Plano F4 Toque";
const DESPESA = "Despesa F4 Toque";
const CATEG = "Categoria F4 Toque";
const created: { section?: string; sub?: string; expense?: string; cat?: string; vacation: boolean } = { vacation: false };
let api: APIRequestContext;
let ownerHeaders: Record<string, string>;

test.beforeAll(async () => {
  api = await pwRequest.newContext();
  ownerHeaders = await token(api, DONO);
  const sec = await api.post(`${API}/cms/sections`, { headers: ownerHeaders, data: { name: SECAO, context: "website" } });
  expect(sec.ok(), `secção (${sec.status()} ${await sec.text()})`).toBeTruthy();
  created.section = (await sec.json()).sectionId;
  const sub = await api.post(`${API}/gym/subscriptions`, { headers: ownerHeaders, data: { name: SUBSCR, price: 10, dueDay: 5 } });
  expect(sub.ok(), `subscrição (${sub.status()} ${await sub.text()})`).toBeTruthy();
  created.sub = (await sub.json()).subscriptionId;
  const cat = await api.post(`${API}/expenses/categories`, { headers: ownerHeaders, data: { name: CATEG, color: "#3B82F6" } });
  expect(cat.ok(), `categoria (${cat.status()} ${await cat.text()})`).toBeTruthy();
  created.cat = (await cat.json()).expenseCategoryId;
  const today = new Date().toISOString().slice(0, 10);
  const exp = await api.post(`${API}/expenses`, { headers: ownerHeaders, data: { description: DESPESA, amount: 12.5, date: today, categoryId: created.cat } });
  expect(exp.ok(), `despesa (${exp.status()} ${await exp.text()})`).toBeTruthy();
  created.expense = (await exp.json()).expenseId;
  const next = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  const vac = await api.post(`${API}/schedule/blocked-slots/vacation`, { headers: ownerHeaders, data: { startDate: next, endDate: next, reason: "Folga F4 Toque" } });
  created.vacation = vac.ok();
  expect(vac.ok(), `bloqueio (${vac.status()} ${await vac.text()})`).toBeTruthy();
});

test.afterAll(async () => {
  const h = await token(api, DONO);
  if (created.section) await api.delete(`${API}/cms/sections/${created.section}`, { headers: h });
  if (created.sub) await api.delete(`${API}/gym/subscriptions/${created.sub}`, { headers: h });
  if (created.expense) await api.delete(`${API}/expenses/${created.expense}`, { headers: h });
  if (created.cat) await api.delete(`${API}/expenses/categories/${created.cat}`, { headers: h });
  await api.dispose();
});

// ═══════════════ 1 · EQ-03: o confirmar do apagar é uma escrita ═══════════════

for (const vp of WIDTHS) {
  test.describe(`EQ-03 · apagar a membro só-ver — ${vp.w}px`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });

    test(`EQ-03: Conteúdos — o apagar da entrada vem desactivado com o motivo (só-ver); activo para o dono`, async ({ page, context }) => {
      await loginAs(context, SO_VER);
      await open(page, context, SO_VER, "/conteudos/produtos", async () => {
        await expect(page.getByRole("button", { name: "Eliminar entrada" }).first()).toBeAttached({ timeout: 15_000 });
      });
      const del = page.locator("main").getByRole("button", { name: "Eliminar entrada" });
      expect(await del.count()).toBeGreaterThan(0);
      for (let i = 0; i < (await del.count()); i++) {
        await expect(del.nth(i)).toBeDisabled();
        await expect(del.nth(i)).toHaveAttribute("title", VIEW_ONLY);
      }
      await expectNoHScroll(page, `conteudos-produtos só-ver@${vp.w}`);

      await loginAs(context, DONO);
      await open(page, context, DONO, "/conteudos/produtos", async () => {
        await expect(page.getByRole("button", { name: "Eliminar entrada" }).first()).toBeAttached({ timeout: 15_000 });
      });
      await expect(page.locator("main").getByRole("button", { name: "Eliminar entrada" }).first()).toBeEnabled();
    });

    if (vp.w >= 768) test(`EQ-03: Conteúdos — o apagar da secção vem desactivado (só-ver); o dono abre o confirmar activo`, async ({ page, context }) => {
      await loginAs(context, SO_VER);
      await open(page, context, SO_VER, "/conteudos", async () => {
        await expect(page.getByText(SECAO).first()).toBeVisible({ timeout: 15_000 });
      });
      const trash = page.getByRole("button", { name: "Apagar secção" }).first();
      await expect(trash).toBeDisabled();
      await expect(trash).toHaveAttribute("title", VIEW_ONLY);

      await loginAs(context, DONO);
      await open(page, context, DONO, "/conteudos", async () => {
        await expect(page.getByText(SECAO).first()).toBeVisible({ timeout: 15_000 });
      });
      const row = page.getByText(SECAO).first();
      await row.hover();
      const t2 = page.getByRole("button", { name: "Apagar secção" }).first();
      await expect(t2).toBeEnabled();
      await t2.click();
      const dlg = page.getByRole("dialog");
      await expect(dlg.getByRole("button", { name: "Eliminar", exact: true })).toBeEnabled();
      await dlg.getByRole("button", { name: "Cancelar" }).click();
      await expect(dlg).toHaveCount(0);
    });

    test(`EQ-03: Ginásio — Eliminar exercício desactivado com o motivo (só-ver)`, async ({ page, context }) => {
      await loginAs(context, SO_VER);
      await open(page, context, SO_VER, "/ginasio", async () => {
        await expect(page.getByText("Remo Ametista").first()).toBeVisible({ timeout: 15_000 });
      });
      const del = page.locator("main").getByRole("button", { name: "Eliminar", exact: true }).first();
      await expect(del).toBeDisabled();
      await expect(del).toHaveAttribute("title", VIEW_ONLY);
      await expectNoHScroll(page, `ginasio só-ver@${vp.w}`);
    });

    test(`EQ-03: Mensalidades — Eliminar subscrição desactivado (só-ver); activo, com confirmar activo, para o dono`, async ({ page, context }) => {
      await loginAs(context, SO_VER);
      await open(page, context, SO_VER, "/financeiro/ginasio", async () => {
        await expect(page.getByRole("button", { name: "Subscrições" })).toBeVisible({ timeout: 15_000 });
      });
      await page.getByRole("button", { name: "Subscrições" }).click();
      const dlg = page.getByRole("dialog", { name: "Subscrições" });
      await expect(dlg.getByText(SUBSCR)).toBeVisible();
      const del = dlg.getByRole("button", { name: "Eliminar", exact: true }).first();
      await expect(del).toBeDisabled();
      await expect(del).toHaveAttribute("title", VIEW_ONLY);

      await loginAs(context, DONO);
      await open(page, context, DONO, "/financeiro/ginasio", async () => {
        await expect(page.getByRole("button", { name: "Subscrições" })).toBeVisible({ timeout: 15_000 });
      });
      await page.getByRole("button", { name: "Subscrições" }).click();
      const d2 = page.getByRole("dialog", { name: "Subscrições" });
      await expect(d2.getByText(SUBSCR)).toBeVisible();
      await d2.getByRole("button", { name: "Eliminar", exact: true }).first().click();
      const confirm = page.getByRole("dialog", { name: /Eliminar subscrição/ });
      await expect(confirm.getByRole("button", { name: "Eliminar", exact: true })).toBeEnabled();
      await confirm.getByRole("button", { name: "Cancelar" }).click();
    });
  });
}

test.describe("EQ-03 · confirmar do apagar com a folha da rota em Ver (1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("EQ-03: Clientes — «Apagar dados» abre mas o botão do ConfirmDialog vem desactivado com o motivo (Ver na lista, Editar só em apagar)", async ({ page, context }) => {
    await loginAs(context, APAGAR_VER);
    await open(page, context, APAGAR_VER, "/clientes", async () => {
      await expect(page.getByText("Cliente Ametista Rosa").first()).toBeVisible({ timeout: 15_000 });
    });
    await page.getByText("Cliente Ametista Rosa").first().click();
    const apagar = page.getByRole("button", { name: "Apagar dados" });
    await expect(apagar).toBeVisible({ timeout: 10_000 });
    // O botão é de `clientes.lista.apagar` (Editar): abre — o confirmar é que segue a folha da rota (clientes.lista = Ver).
    if (await apagar.isEnabled()) {
      await apagar.click();
      const dlg = page.getByRole("dialog", { name: "Apagar dados do cliente?" });
      await expect(dlg).toBeVisible();
      const confirm = dlg.getByRole("button", { name: "Anonimizar" });
      await expect(confirm).toBeDisabled();
      await expect(confirm).toHaveAttribute("title", VIEW_ONLY);
    } else {
      // Se o botão também ficar desactivado com o motivo, o resultado é igual de seguro: nunca activo.
      await expect(apagar).toHaveAttribute("title", VIEW_ONLY);
    }
  });

  test("EQ-03: Clientes — membro com Editar (av-total) e dono têm «Anonimizar» activo", async ({ page, context }) => {
    for (const user of [TOTAL, DONO]) {
      await loginAs(context, user);
      await open(page, context, user, "/clientes", async () => {
        await expect(page.getByText("Cliente Ametista Rosa").first()).toBeVisible({ timeout: 15_000 });
      });
      await page.getByText("Cliente Ametista Rosa").first().click();
      await page.getByRole("button", { name: "Apagar dados" }).click();
      const dlg = page.getByRole("dialog", { name: "Apagar dados do cliente?" });
      await expect(dlg.getByRole("button", { name: "Anonimizar" })).toBeEnabled();
      await dlg.getByRole("button", { name: "Cancelar" }).click();
      await expect(dlg).toHaveCount(0);
    }
  });

  test("EQ-03: Equipa — Remover membro: o confirmar está activo para o dono (leaf=equipa) e a ficha cancela sem remover", async ({ page, context }) => {
    const dono = "equipa3@e2e.local";
    await loginAs(context, dono);
    await open(page, context, dono, "/equipa", async () => {
      await expect(page.getByRole("button", { name: "Abrir Sofia Semequipa" }).or(page.getByRole("row", { name: "Abrir Sofia Semequipa" })).first()).toBeVisible({ timeout: 15_000 });
    });
    await page.getByRole("row", { name: "Abrir Sofia Semequipa" }).or(page.getByRole("button", { name: "Abrir Sofia Semequipa", exact: true })).first().click();
    const ficha = page.getByRole("dialog", { name: "Sofia Semequipa" });
    await ficha.getByRole("button", { name: "Remover" }).click();
    const confirm = page.getByRole("dialog", { name: /Remover Sofia Semequipa/ });
    await expect(confirm.getByRole("button", { name: "Remover", exact: true })).toBeEnabled();
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirm).toHaveCount(0);
  });

  test("EQ-03: Equipa — membro só com Ver não tem Convidar nem fichas (o write-guard da Equipa segue o nó `equipa`)", async ({ page, context }) => {
    const ver = "e3-ver@e2e.local";
    await loginAs(context, ver);
    await open(page, context, ver, "/equipa", async () => {
      await expect(page.getByText("Bruno Gerir", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    });
    await expect(page.getByRole("button", { name: "Convidar utilizador" })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

// ═══════════════ 2 · acções de linha em toque e teclado ═══════════════

/** Páginas com acções escondidas até ao hover: (rota, o que esperar, localizador do botão-acção). */
interface Reveal {
  slug: string;
  user: string;
  route: string;
  ready: (p: Page) => Promise<void>;
  /** O botão de acção dentro do contentor com `REVEAL_ON_HOVER`. */
  action: (p: Page) => ReturnType<Page["locator"]>;
  /** Elemento cuja opacidade muda (por omissão o próprio botão). */
  holder?: (btn: ReturnType<Page["locator"]>) => ReturnType<Page["locator"]>;
  before?: (p: Page) => Promise<void>;
}

const REVEALS: Reveal[] = [
  {
    slug: "despesas-lista", user: DONO, route: "/financeiro/despesas",
    ready: async (p) => { await expect(p.getByText(DESPESA).first()).toBeVisible({ timeout: 15_000 }); },
    action: (p) => p.locator("main div.group", { hasText: DESPESA }).first().getByRole("button", { name: "Eliminar" }),
    holder: (b) => b.locator(".."),
  },
  {
    slug: "despesas-categorias", user: DONO, route: "/financeiro/despesas",
    ready: async (p) => { await expect(p.getByRole("button", { name: "Categorias" }).first()).toBeVisible({ timeout: 15_000 }); },
    before: async (p) => { await p.getByRole("button", { name: "Categorias" }).first().click(); await expect(p.getByRole("dialog", { name: "Categorias de despesa" })).toBeVisible(); },
    action: (p) => p.getByRole("dialog", { name: "Categorias de despesa" }).locator("div.group", { hasText: CATEG }).first().getByRole("button", { name: "Eliminar" }),
    holder: (b) => b.locator(".."),
  },
  {
    slug: "loja-produto", user: DONO, route: "/loja",
    ready: async (p) => { await expect(p.getByText("Produto Ametista").first()).toBeVisible({ timeout: 15_000 }); },
    action: (p) => p.locator("main button[title='Eliminar']").first(),
  },
  {
    slug: "agenda-bloqueios", user: DONO, route: "/agenda/config",
    ready: async (p) => { await expect(p.getByText("Folga F4 Toque").first()).toBeVisible({ timeout: 15_000 }); },
    action: (p) => p.locator("main div.group", { hasText: "Folga F4 Toque" }).first().getByRole("button", { name: "Remover" }),
  },
  {
    slug: "conteudos-seccoes", user: DONO, route: "/conteudos",
    ready: async (p) => { await expect(p.getByText(SECAO).first()).toBeVisible({ timeout: 15_000 }); },
    action: (p) => p.locator("div.group", { hasText: SECAO }).first().getByRole("button", { name: "Editar secção" }),
    holder: (b) => b.locator(".."),
  },
  {
    slug: "admin-componentes", user: "admin@e2e", route: "/admin/componentes",
    ready: async (p) => { await expect(p.locator("main").getByRole("button", { name: "Eliminar", exact: true }).first()).toBeAttached({ timeout: 15_000 }); },
    action: (p) => p.locator("main").getByRole("button", { name: "Eliminar", exact: true }).first(),
    holder: (b) => b.locator(".."),
  },
];

test.describe("EQ-03 · acções de linha visíveis em toque (390 e 834)", () => {
  for (const vp of [WIDTHS[1], WIDTHS[2]]) {
    test.describe(`toque ${vp.w}px`, () => {
      test.use({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true });
      for (const r of REVEALS) {
        test(`${r.slug}: as acções estão visíveis sem hover`, async ({ page, context }) => {
          if (r.slug === "conteudos-seccoes" && vp.w < 768) test.info().annotations.push({ type: "nota", description: "390: árvore substituída pelo seletor mobile (coberto em alturas)" });
          if (r.slug === "conteudos-seccoes" && vp.w < 768) return;
          await loginAs(context, r.user);
          await open(page, context, r.user, r.route, () => r.ready(page));
          if (r.before) await r.before(page);
          expect(await page.evaluate(() => matchMedia("(hover: none)").matches), "o contexto tem de emular (hover:none)").toBe(true);
          const btn = r.action(page);
          await expect(btn).toBeVisible();
          const holder = r.holder ? r.holder(btn) : btn;
          await expect.poll(() => opacityOf(holder), { message: `${r.slug}: opacidade em toque`, timeout: 3_000 }).toBeGreaterThan(0.9);
          await expectNoHScroll(page, `${r.slug}@${vp.w}`);
          await page.screenshot({ path: path.join(SHOTS, `toque-${r.slug}-${vp.w}.png`) });
        });
      }
    });
  }
});

test.describe("EQ-03 · computador: escondidas em repouso, reveladas pelo foco (Tab)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  for (const r of REVEALS.filter((x) => x.slug !== "loja-produto")) {
    test(`${r.slug}: opacidade 0 em repouso e 1 com o foco no botão`, async ({ page, context }) => {
      await loginAs(context, r.user);
      await open(page, context, r.user, r.route, () => r.ready(page));
      if (r.before) await r.before(page);
      await page.mouse.move(2, 2);
      const btn = r.action(page);
      const holder = r.holder ? r.holder(btn) : btn;
      await expect(btn).toBeAttached();
      await expect.poll(() => opacityOf(holder), { timeout: 3_000 }).toBeLessThan(0.1);
      await btn.focus();
      await expect.poll(() => opacityOf(holder), { message: `${r.slug}: o foco revela`, timeout: 3_000 }).toBeGreaterThan(0.9);
    });
  }

  test("loja-produto: o botão de eliminar revela-se com o foco (Tab) no cartão", async ({ page, context }) => {
    await loginAs(context, DONO);
    await open(page, context, DONO, "/loja", async () => { await expect(page.getByText("Produto Ametista").first()).toBeVisible({ timeout: 15_000 }); });
    await page.mouse.move(2, 2);
    const btn = page.locator("main button[title='Eliminar']").first();
    await expect.poll(() => opacityOf(btn), { timeout: 3_000 }).toBeLessThan(0.1);
    await btn.focus();
    await expect.poll(() => opacityOf(btn), { timeout: 3_000 }).toBeGreaterThan(0.9);
  });
});

// ═══════════════ 3 · sem scroll duplo ═══════════════

test.describe("Alturas por flex — Mensagens (1440 e 834, com e sem BillingBanner)", () => {
  const CASES: Array<{ slug: string; user: string; route: string }> = [
    { slug: "mensagens-clientes", user: DONO, route: "/mensagens" },
    { slug: "mensagens-backoffice", user: DONO, route: "/mensagens/backoffice" },
    { slug: "admin-mensagens", user: "admin@e2e", route: "/mensagens" },
  ];
  for (const vp of [WIDTHS[0], WIDTHS[1]]) {
    for (const banner of [false, true]) {
      for (const c of CASES) {
        test(`${c.slug} @${vp.w} ${banner ? "com" : "sem"} BillingBanner: sem scroll duplo`, async ({ page, context }) => {
          await page.setViewportSize({ width: vp.w, height: vp.h });
          await loginAs(context, c.user);
          if (banner) await withBanner(page);
          await open(page, context, c.user, c.route);
          if (banner) await expect(page.getByText(/Pagamento em atraso/)).toBeVisible({ timeout: 10_000 });
          await expectFits(page, `${c.slug}@${vp.w}${banner ? "+banner" : ""}`);
          await page.screenshot({ path: path.join(SHOTS, `${c.slug}-${vp.w}${banner ? "-banner" : ""}.png`) });
        });
      }
    }
  }

  test("Mensagens @390 continua imersiva (sem scroll duplo nem horizontal)", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(context, DONO);
    await open(page, context, DONO, "/mensagens");
    await expectFits(page, "mensagens@390");
    await page.screenshot({ path: path.join(SHOTS, "mensagens-390.png") });
  });
});

test.describe("Alturas por flex — Agenda", () => {
  for (const route of ["/agenda", "/agenda/marcacoes"]) {
    for (const vp of [{ w: 1440, h: 900 }, { w: 1280, h: 720 }]) {
      test(`${route} @${vp.w}x${vp.h}: a página cabe na janela e o <main> não faz scroll`, async ({ page, context }) => {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        await loginAs(context, DONO);
        await open(page, context, DONO, route);
        await expectFits(page, `${route}@${vp.w}x${vp.h}`);
        await page.screenshot({ path: path.join(SHOTS, `agenda${route.replace(/\W/g, "-")}-${vp.w}.png`) });
      });
    }
    for (const vp of [WIDTHS[1], WIDTHS[2]]) {
      test(`${route} @${vp.w}: a página faz scroll no <main>, sem scroll horizontal${route === "/agenda" ? " e o calendário tem 560px" : ""}`, async ({ page, context }) => {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        await loginAs(context, DONO);
        await open(page, context, DONO, route);
        await expectNoHScroll(page, `${route}@${vp.w}`);
        if (route === "/agenda") {
          const box = await page.locator("main .h-\\[560px\\]").first().boundingBox();
          expect(box?.height, "altura do calendário abaixo de xl").toBeGreaterThanOrEqual(559);
          expect(box?.height).toBeLessThanOrEqual(561);
        }
        expect(await page.evaluate(() => getComputedStyle(document.querySelector("main")!).overflowY), "<main> com scroll abaixo de xl").toMatch(/auto|scroll/);
        await page.screenshot({ path: path.join(SHOTS, `agenda${route.replace(/\W/g, "-")}-${vp.w}.png`) });
      });
    }
  }
});

test.describe("Alturas por flex — Conteúdos", () => {
  for (const route of ["/conteudos", "/conteudos/produtos"]) {
    for (const vp of [WIDTHS[0], WIDTHS[1]]) {
      test(`${route} @${vp.w}: sem scroll duplo`, async ({ page, context }) => {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        await loginAs(context, DONO);
        await open(page, context, DONO, route);
        await expectFits(page, `${route}@${vp.w}`);
        await page.screenshot({ path: path.join(SHOTS, `conteudos${route.replace(/\W/g, "-")}-${vp.w}.png`) });
      });
    }
    test(`${route} @390: o seletor mobile de secções abre e fecha, sem scroll horizontal`, async ({ page, context }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await loginAs(context, DONO);
      await open(page, context, DONO, route);
      await expectNoHScroll(page, `${route}@390`);
      await page.getByRole("button", { name: /Todas as secções/ }).click();
      // F6c2: a folha de secções é a `Modal` partilhada (role=dialog «Secções»), ancorada em baixo no telemóvel.
      const folha = page.getByRole("dialog", { name: "Secções", exact: true });
      await expect(folha).toBeVisible();
      await expect(folha.getByRole("button", { name: "Nova secção" })).toBeVisible();
      // As secções do contexto «website» só existem em /conteudos; em /conteudos/produtos a folha tem as dos produtos (aqui nenhuma).
      if (route === "/conteudos") await expect(folha.getByText(SECAO)).toBeVisible();
      else await expect(folha.getByText("Todas as entradas")).toBeVisible();
      await expectNoHScroll(page, `${route}@390 (seletor aberto)`);
      await page.screenshot({ path: path.join(SHOTS, `conteudos${route.replace(/\W/g, "-")}-390.png`) });
      await page.keyboard.press("Escape");
      await expect(folha).toHaveCount(0);
    });
  }
});

// ═══════════════ 4 · Equipa a 390: cartões e abrir pelo toque ═══════════════

test.describe("Equipa @390", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("mostra cartões (não a tabela) e abre a ficha de um membro pelo toque", async ({ page, context }) => {
    const dono = "equipa@e2e.local";
    await loginAs(context, dono);
    await open(page, context, dono, "/equipa", async () => {
      await expect(page.getByText("Ana Membro").first()).toBeVisible({ timeout: 15_000 });
    });
    await expect(page.getByRole("table")).toHaveCount(0);
    const card = page.getByRole("button", { name: "Abrir Ana Membro", exact: true });
    await expect(card).toBeVisible();
    await expectNoHScroll(page, "equipa@390");
    await card.tap();
    await expect(page.getByRole("dialog", { name: "Ana Membro" })).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, "equipa-ficha-390.png") });
  });
});

/*
 * 5 · Rota sem folha = só-leitura para membro (EQ-03/EQ-04): NÃO há rota estável no e2e para o provar — todas as rotas do
 * `App.tsx` têm folha ou isenção (é exactamente o que o `routesLeaves.test.ts` exige), por isso um membro nunca chega a uma
 * rota «não mapeada» pela UI. O unitário `tests/unit/routesLeaves.test.ts` (rotas ↔ folhas) + `writeGuardTeam.test.tsx`
 * (viewOnly numa rota sem folha) cobrem-no. No e2e prova-se o seu efeito visível: `/equipa` é isenta e os botões passam
 * `leaf="equipa"` (testes de Equipa acima).
 */
