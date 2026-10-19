import { test, expect, type Page, type BrowserContext, type APIRequestContext, request as pwRequest } from "@playwright/test";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { ADMIN, grantSupportAccess, openSupportTab } from "./fixtures/support";

/**
 * Ronda grande (R6.3) — MATRIZ DE ACTORES em TODAS as páginas, a 1440.
 *
 * Actores (seed `API-FullStack/scripts/seedE2e.ts`):
 *   dono            arvore-a@e2e.local        (todos os módulos menos Correio/Admin)
 *   só-ver          av-sover@e2e.local        (TODAS as folhas do A, nível Ver)
 *   parte da árvore av-semvalores@e2e.local   (agenda.marcacoes Editar · agenda.servicos e clientes.lista Ver)
 *   «só os meus»    meus@e2e.local            (equipa@e2e.local: agenda.marcacoes Ver, âmbito meus)
 *   suporte         admin@e2e → suporte-sim@e2e.local (Agenda + Clientes)
 *   Correio         correio@e2e.local (dono) e correio.ver@e2e.local (caixa Ver + clientes.lista Ver)
 *   plataforma      admin@e2e
 *
 * Por actor, em CADA rota da app: o que lhe cabe abre sem erro; o resto redirecciona (nunca fica na página).
 * Depois: escritas desactivadas com o motivo (só-ver e suporte), «Só os meus» sem «Global» nem dados de colegas.
 * Regras provadas: EQ-03 (Ver = botões desactivados com o motivo), EQ-04 (default-deny por folha), PRO-* (Só os meus).
 */
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial", retries: 0 });

const VIEW_ONLY = "Só tens permissão para ver";
const SUPPORT_NOTE = "Indisponível numa sessão de suporte";

// ── todas as rotas da app (App.tsx) ─────────────────────────────────────────────

const ADMIN_ROUTES = [
  "/admin", "/admin/permissoes", "/admin/componentes", "/admin/tokens", "/admin/dominios",
  "/admin/faturacao", "/admin/integracoes", "/admin/atividade", "/admin/sistema",
];
const CORREIO_ROUTES = ["/correio", "/correio/campanhas", "/correio/contactos"];
const FINANCEIRO = ["/financeiro", "/financeiro/agenda", "/financeiro/loja", "/financeiro/ginasio", "/financeiro/despesas"];
const LOJA = ["/loja", "/loja/encomendas", "/loja/categorias"];
const AGENDA = ["/agenda", "/agenda/marcacoes", "/agenda/servicos", "/agenda/profissionais", "/agenda/config"];
const GINASIO = ["/ginasio", "/ginasio/treinos", "/ginasio/planos", "/ginasio/clientes"];
const CONTEUDOS = [
  "/conteudos", "/conteudos/produtos", "/conteudos/servicos", "/conteudos/ginasio",
  "/conteudos/linguas", "/conteudos/emails", "/conteudos/notificacoes",
];
const CLIENTES = ["/clientes", "/clientes/leads"];
const MENSAGENS = ["/mensagens", "/mensagens/backoffice"];
const TOPO = ["/dashboard", "/estatisticas", "/paginas", "/faturacao", "/perfil", "/equipa"];

const ALL_ROUTES = [
  ...TOPO, ...FINANCEIRO, ...CLIENTES, ...CORREIO_ROUTES, ...MENSAGENS, ...LOJA, ...AGENDA, ...GINASIO, ...CONTEUDOS, ...ADMIN_ROUTES,
];

const without = (list: string[], ...out: string[]) => list.filter((r) => !out.includes(r));

// ── actores: o que cada um PODE abrir (tudo o resto tem de redireccionar) ───────

interface Actor {
  label: string;
  user: string;
  allowed: string[];
  /** Itens de topo da sidebar (nomes exactos). */
  sidebar: string[];
}

/** O dono do `arvoreA`: todos os módulos (menos Correio e Admin). */
const DONO_ALLOWED = [
  ...TOPO, ...FINANCEIRO, ...CLIENTES, ...MENSAGENS, ...LOJA, ...AGENDA, ...GINASIO, ...CONTEUDOS,
];

const ACTORS: Actor[] = [
  {
    label: "dono (Salão Ametista)",
    user: "arvore-a@e2e.local",
    allowed: DONO_ALLOWED,
    sidebar: ["Dashboard", "Clientes", "Mensagens", "Conteúdos", "Páginas", "Estatísticas", "Loja", "Agenda", "Ginásio", "Financeiro", "Faturação"],
  },
  {
    // «Acesso total» em Ver: sem Faturação (do dono), sem Equipa (nó fechado) e sem Profissionais (folha que nasce fechada).
    label: "membro só-ver em todas as folhas",
    user: "av-sover@e2e.local",
    allowed: without(DONO_ALLOWED, "/faturacao", "/equipa", "/agenda/profissionais"),
    sidebar: ["Dashboard", "Clientes", "Mensagens", "Conteúdos", "Páginas", "Estatísticas", "Loja", "Agenda", "Ginásio", "Financeiro"],
  },
  {
    label: "membro com parte da árvore",
    user: "av-semvalores@e2e.local",
    allowed: ["/agenda", "/agenda/marcacoes", "/agenda/servicos", "/clientes", "/perfil"],
    sidebar: ["Clientes", "Agenda"],
  },
  {
    label: "membro «Só os meus»",
    user: "meus@e2e.local",
    allowed: ["/agenda", "/agenda/marcacoes", "/perfil"],
    sidebar: ["Agenda"],
  },
  {
    label: "dono do Correio (Papelaria Selo)",
    user: "correio@e2e.local",
    allowed: [
      "/dashboard", "/estatisticas", "/faturacao", "/perfil", "/equipa",
      "/financeiro", "/clientes", "/clientes/leads", ...CORREIO_ROUTES, ...MENSAGENS,
      "/conteudos/linguas", "/conteudos/emails", "/conteudos/notificacoes",
    ],
    sidebar: ["Dashboard", "Clientes", "Mensagens", "Correio", "Conteúdos", "Estatísticas", "Financeiro", "Faturação"],
  },
  {
    label: "membro só-ver do Correio",
    user: "correio.ver@e2e.local",
    allowed: ["/clientes", "/correio", "/perfil"],
    sidebar: ["Clientes", "Correio"],
  },
  {
    label: "admin da plataforma",
    user: ADMIN,
    allowed: [...TOPO.filter((r) => r !== "/equipa"), ...FINANCEIRO, ...CLIENTES, ...CORREIO_ROUTES, ...MENSAGENS, ...LOJA, ...AGENDA, ...GINASIO, ...CONTEUDOS, ...ADMIN_ROUTES],
    sidebar: ["Dashboard", "Admin", "Clientes", "Mensagens", "Correio", "Conteúdos", "Páginas", "Estatísticas", "Loja", "Agenda", "Ginásio", "Financeiro", "Faturação"],
  },
];

// ── helpers ─────────────────────────────────────────────────────────────────────

const sidebarNav = (page: Page) => page.locator("aside:visible nav").first();
const pathOf = (page: Page) => new URL(page.url()).pathname;

/** Espera que a página deixe de mostrar estados de carregamento e devolve o texto do <main>. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator("main")).toBeVisible();
  await expect.poll(async () => /A carregar/.test(await page.locator("main").innerText()), { timeout: 15_000 }).toBe(false);
}

/** Abre `route` e confirma que FICA nela, sem erro de carregamento nem excepção na página. */
async function expectOpens(page: Page, context: BrowserContext, user: string, route: string, errors: string[]): Promise<void> {
  await withSessionRetry(page, context, user, () => page.goto(route), async () => {
    await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => pathOf(page), { timeout: 10_000 }).toBe(route);
    await settled(page);
  });
  const text = await page.locator("main").innerText();
  expect.soft(text, `${user}: ${route} mostra erro de carregamento`).not.toMatch(/Erro ao carregar|Não foi possível carregar/);
  expect.soft(errors, `${user}: ${route} lançou excepção no browser`).toEqual([]);
  errors.length = 0;
}

/** Abre `route` e confirma o redirect (o guard do Shell nunca deixa o actor na página). */
async function expectRedirected(page: Page, context: BrowserContext, user: string, route: string): Promise<void> {
  await withSessionRetry(page, context, user, () => page.goto(route), async () => {
    await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => pathOf(page), { message: `${user} não devia poder ficar em ${route}`, timeout: 15_000 }).not.toBe(route);
  });
  // Rotas sob um pai acessível caem num subitem do MESMO pai: nunca podem ficar na página pedida.
  expect(pathOf(page), `${user} ficou em ${route}`).not.toBe(route);
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const WRITE_RE = /^(\+\s*)?(Novo|Nova|Adicionar|Criar|Convidar|Guardar|Apagar|Eliminar|Remover|Importar|Duplicar|Publicar|Bloquear|Registar)\b/i;

/** Botões de escrita VISÍVEIS e activos na página (o que um «só ver» nunca pode ter). */
async function enabledWriteButtons(page: Page): Promise<string[]> {
  const buttons = page.locator("main button:visible");
  const out: string[] = [];
  const n = await buttons.count();
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    const name = ((await b.innerText()) || (await b.getAttribute("aria-label")) || "").replace(/\s+/g, " ").trim();
    // As linhas das listas de modelos (Conteúdos → Notificações) chamam-se «Novo plano … PT EN»: abrem-se para ler.
    const hit = WRITE_RE.test(name) && !/PT/.test(name);
    if (hit && (await b.isEnabled())) out.push(name);
  }
  return out;
}

async function tokenOf(api: APIRequestContext, username: string): Promise<Record<string, string>> {
  const res = await api.post(`${API}/users/login`, {
    data: { username, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${username} (${res.status()})`).toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).accessToken as string}` };
}

// ═══════════════════════ 1 · menu + rotas, actor a actor ═══════════════════════

for (const actor of ACTORS) {
  test.describe(`Matriz — ${actor.label}`, () => {
    test(`o menu mostra só o que lhe cabe e cada rota abre ou redirecciona`, async ({ page, context }) => {
      test.setTimeout(900_000);
      const errors = watchErrors(page);
      await loginAs(context, actor.user);

      // Menu (EQ-04: default-deny por folha; módulos só com o tecto do tenant).
      await withSessionRetry(page, context, actor.user, () => page.goto(actor.allowed[0]), async () => {
        await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
      });
      for (const item of actor.sidebar) {
        await expect(sidebarNav(page).getByRole("button", { name: item, exact: true }).or(sidebarNav(page).getByRole("button", { name: new RegExp(`^${item}(,.*)?$`) })).first(), `${actor.user}: falta "${item}" no menu`).toBeVisible();
      }
      for (const nope of ["Admin", "Correio", "Faturação", "Loja", "Agenda", "Ginásio", "Páginas", "Mensagens", "Dashboard", "Clientes", "Conteúdos", "Estatísticas", "Financeiro"].filter((n) => !actor.sidebar.includes(n))) {
        await expect(
          sidebarNav(page).getByRole("button", { name: new RegExp(`^${nope}(,.*)?$`) }),
          `${actor.user}: "${nope}" não devia estar no menu`,
        ).toHaveCount(0);
      }

      for (const route of ALL_ROUTES) {
        if (actor.allowed.includes(route)) await expectOpens(page, context, actor.user, route, errors);
        else await expectRedirected(page, context, actor.user, route);
      }
    });
  });
}

// ═══════════════════ 2 · «só ver»: escritas desactivadas com o motivo ═══════════════════

test.describe("Matriz — membro só-ver: nenhuma escrita activa, com o motivo", () => {
  const SO_VER = "av-sover@e2e.local";
  /** Páginas com botão de criar que têm de estar desactivado COM o motivo (EQ-03). */
  const WITH_REASON: Array<{ route: string; button: RegExp }> = [
    { route: "/agenda/servicos", button: /^(\+\s*)?Novo serviço/i },
    { route: "/loja", button: /^(\+\s*)?Novo produto/i },
    { route: "/loja/categorias", button: /^(\+\s*)?Nova categoria/i },
    { route: "/clientes", button: /^(\+\s*)?Novo cliente/i },
    { route: "/financeiro/despesas", button: /^(\+\s*)?Nova despesa/i },
    { route: "/conteudos/linguas", button: /Adicionar|Nova|Novo/i },
  ];
  const PAGES = [
    "/agenda", "/agenda/marcacoes", "/agenda/servicos", "/agenda/config", "/loja", "/loja/encomendas", "/loja/categorias",
    "/ginasio", "/ginasio/treinos", "/ginasio/planos", "/ginasio/clientes", "/clientes", "/clientes/leads",
    "/financeiro/despesas", "/financeiro/ginasio", "/conteudos", "/conteudos/produtos", "/conteudos/servicos",
    "/conteudos/ginasio", "/conteudos/linguas", "/conteudos/emails", "/conteudos/notificacoes", "/paginas",
  ];

  test("nenhuma página mostra um botão de escrita activo", async ({ page, context }) => {
    test.setTimeout(600_000);
    await loginAs(context, SO_VER);
    for (const route of PAGES) {
      await withSessionRetry(page, context, SO_VER, () => page.goto(route), async () => {
        await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
        await expect.poll(() => pathOf(page), { timeout: 10_000 }).toBe(route);
        await settled(page);
      });
      expect.soft(await enabledWriteButtons(page), `${SO_VER}: botões de escrita activos em ${route}`).toEqual([]);
    }
  });

  test("EQ-03: os botões de criar vêm desactivados com «Só tens permissão para ver»", async ({ page, context }) => {
    test.setTimeout(300_000);
    await loginAs(context, SO_VER);
    for (const { route, button } of WITH_REASON) {
      await withSessionRetry(page, context, SO_VER, () => page.goto(route), async () => {
        await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
        await expect.poll(() => pathOf(page), { timeout: 10_000 }).toBe(route);
        await settled(page);
      });
      const btn = page.locator("main").getByRole("button", { name: button }).first();
      await expect(btn, `${route}: botão de criar`).toBeVisible();
      await expect(btn, `${route}: tem de vir desactivado`).toBeDisabled();
      const withTitle = page.locator(`main [title="${VIEW_ONLY}"]`);
      expect(await withTitle.count(), `${route}: o motivo "${VIEW_ONLY}" tem de estar no tooltip`).toBeGreaterThan(0);
    }
  });

  test("o dono, no mesmo tenant, tem os mesmos botões activos (o bloqueio é do membro, não da página)", async ({ page, context }) => {
    await loginAs(context, "arvore-a@e2e.local");
    await withSessionRetry(page, context, "arvore-a@e2e.local", () => page.goto("/loja"), async () => {
      await expect(page.locator("main").getByRole("button", { name: /^(\+\s*)?Novo produto/i }).first()).toBeEnabled({ timeout: 15_000 });
    });
  });
});

// ═══════════════════ 3 · membro só-ver do Correio ═══════════════════

test.describe("Matriz — membro só-ver do Correio", () => {
  const USER = "correio.ver@e2e.local";
  test("a Caixa abre mas não responde; Campanhas e Contactos redireccionam", async ({ page, context }) => {
    await loginAs(context, USER);
    await withSessionRetry(page, context, USER, () => page.goto("/correio"), async () => {
      await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
      await settled(page);
    });
    expect(await enabledWriteButtons(page), "sem botões de escrita activos na Caixa").toEqual([]);
    for (const r of ["/correio/campanhas", "/correio/contactos"]) await expectRedirected(page, context, USER, r);
  });
});

// ═══════════════════ 4 · «Só os meus»: sem Global nem colegas ═══════════════════

test.describe("Matriz — membro «Só os meus»", () => {
  const OWNER = "equipa@e2e.local";
  const MEUS = "meus@e2e.local";
  const COLEGA = "Colega Matriz";
  const CLIENTE_COLEGA = "Cliente Do Colega Matriz";
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date();
  const TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let api: APIRequestContext;
  let staffId = "";
  let apptId = "";

  test.beforeAll(async () => {
    api = await pwRequest.newContext();
    const h = await tokenOf(api, OWNER);
    const services = await (await api.get(`${API}/schedule/services`, { headers: h })).json();
    const serviceId = (Array.isArray(services) ? services : (services.rows ?? services.services ?? []))[0]?.serviceId;
    expect(serviceId, "o tenant tem um serviço").toBeTruthy();
    const s = await api.post(`${API}/schedule/staff`, { headers: h, data: { name: COLEGA } });
    expect(s.ok(), `criar colega (${s.status()} ${await s.text()})`).toBeTruthy();
    staffId = (await s.json()).staffId;
    const a = await api.post(`${API}/schedule/appointments`, {
      headers: h,
      data: { date: TODAY, time: "11:30", serviceId, staffId, clientName: CLIENTE_COLEGA, clientEmail: "", clientPhone: "" },
    });
    expect(a.ok(), `marcação do colega (${a.status()} ${await a.text()})`).toBeTruthy();
    apptId = (await a.json()).appointmentId;
  });

  test.afterAll(async () => {
    const h = await tokenOf(api, OWNER);
    if (apptId) await api.delete(`${API}/schedule/appointments/${apptId}`, { headers: h });
    if (staffId) await api.delete(`${API}/schedule/staff/${staffId}`, { headers: h });
    await api.dispose();
  });

  test("PRO: o calendário e as marcações não têm «Global» nem dados do colega", async ({ page, context }) => {
    await loginAs(context, MEUS);
    const bodies: string[] = [];
    page.on("response", async (res) => {
      if (res.url().startsWith(API) && /\/schedule\/(appointments|staff)/.test(res.url())) {
        try { bodies.push(await res.text()); } catch { /* corpo descartado */ }
      }
    });
    for (const route of ["/agenda", "/agenda/marcacoes"]) {
      await withSessionRetry(page, context, MEUS, () => page.goto(route), async () => {
        await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
        await settled(page);
      });
      const dom = await page.evaluate(() => document.body.textContent ?? "");
      expect(dom, `${route}: nome do colega no DOM`).not.toContain(COLEGA);
      expect(dom, `${route}: cliente do colega no DOM`).not.toContain(CLIENTE_COLEGA);
      await expect(page.getByRole("button", { name: /^Global$/ }), `${route}: «Global»`).toHaveCount(0);
      await expect(page.getByRole("option", { name: /Global|Sem profissional/ })).toHaveCount(0);
    }
    const all = bodies.join("\n");
    // EQ-15: marcações de colegas nunca viajam. (A lista de profissionais traz os nomes — é o que o selector usa — mas a UI não os mostra.)
    expect(all, "a API não devolve a marcação do colega").not.toContain(CLIENTE_COLEGA);
  });

  test("PRO: nas páginas que não são suas (Dashboard, Financeiro, Perfil) não há dados do colega nem Global", async ({ page, context }) => {
    await loginAs(context, MEUS);
    await withSessionRetry(page, context, MEUS, () => page.goto("/perfil"), async () => {
      await expect(sidebarNav(page)).toBeVisible({ timeout: 15_000 });
      await settled(page);
    });
    const dom = await page.evaluate(() => document.body.textContent ?? "");
    expect(dom).not.toContain(COLEGA);
    await expect(page.getByRole("button", { name: /^Global$/ })).toHaveCount(0);
  });
});

// ═══════════════════ 5 · sessão de suporte ═══════════════════

test.describe("Matriz — sessão de suporte (admin como Cliente Suporte)", () => {
  const TENANT = "suporte-sim@e2e.local";
  /** Rotas que o tenant (Agenda + Clientes) tem: o suporte vê o que o dono vê. */
  const OPEN = [
    "/dashboard", "/estatisticas", "/faturacao", "/perfil", "/equipa", "/mensagens", "/clientes", "/clientes/leads",
    "/agenda", "/agenda/marcacoes", "/agenda/servicos", "/agenda/config", "/financeiro", "/financeiro/agenda",
    "/conteudos/linguas", "/conteudos/emails", "/conteudos/notificacoes",
  ];
  const BLOCKED = [...ADMIN_ROUTES, ...CORREIO_ROUTES, ...LOJA, ...GINASIO, "/paginas", "/financeiro/loja", "/financeiro/ginasio", "/financeiro/despesas", "/conteudos/produtos", "/conteudos/ginasio"];

  test("o suporte só abre o que o dono tem; Admin, Correio e módulos alheios redireccionam", async ({ context }) => {
    test.setTimeout(600_000);
    await loginAs(context, ADMIN);
    const { userId } = await grantSupportAccess(await pwRequest.newContext(), TENANT);
    const page = await openSupportTab(context, userId);
    const errors = watchErrors(page);
    const nav = sidebarNav(page);
    await expect(page.getByRole("region", { name: "Sessão de suporte" })).toBeVisible();
    for (const nope of ["Admin", "Correio", "Loja", "Ginásio", "Páginas"]) {
      await expect(nav.getByRole("button", { name: nope, exact: true }), `"${nope}" no menu do suporte`).toHaveCount(0);
    }
    for (const route of OPEN) {
      // navegação dentro do separador (a sessão de suporte vive no sessionStorage do separador)
      await page.evaluate((r) => { window.history.pushState({}, "", r); window.dispatchEvent(new PopStateEvent("popstate")); }, route);
      await expect.poll(() => pathOf(page), { message: `suporte: ${route}`, timeout: 10_000 }).toBe(route);
      await settled(page);
      const text = await page.locator("main").innerText();
      expect.soft(text, `suporte: ${route} mostra erro`).not.toMatch(/Erro ao carregar|Não foi possível carregar/);
    }
    expect.soft(errors, "excepções no browser do suporte").toEqual([]);
    for (const route of BLOCKED) {
      await page.evaluate((r) => { window.history.pushState({}, "", r); window.dispatchEvent(new PopStateEvent("popstate")); }, route);
      await expect.poll(() => pathOf(page), { message: `suporte não devia ficar em ${route}`, timeout: 10_000 }).not.toBe(route);
    }
  });

  test("o que é do dono fica desactivado com «Indisponível numa sessão de suporte» (Equipa, Faturação, Perfil)", async ({ context }) => {
    await loginAs(context, ADMIN);
    const { userId } = await grantSupportAccess(await pwRequest.newContext(), TENANT);
    const page = await openSupportTab(context, userId);
    const go = async (r: string) => {
      await page.evaluate((x) => { window.history.pushState({}, "", x); window.dispatchEvent(new PopStateEvent("popstate")); }, r);
      await expect.poll(() => pathOf(page), { timeout: 10_000 }).toBe(r);
      await settled(page);
    };

    await go("/equipa");
    const invite = page.getByRole("button", { name: /Convidar/i }).first();
    await expect(invite).toBeDisabled();
    await expect(page.locator(`[title="${SUPPORT_NOTE}"]`).first()).toBeAttached();

    await go("/faturacao");
    // Este tenant não tem subscrição: não há portal de pagamento para desactivar — e nada que o suporte possa accionar.
    await expect(page.locator("main").getByText("Sem subscrição ativa")).toBeVisible();
    expect(await page.locator("main button:visible:enabled").count(), "Faturação não oferece acções ao suporte").toBe(0);

    await go("/perfil");
    await expect(page.locator("main").getByText(SUPPORT_NOTE).first()).toBeVisible();
  });
});
