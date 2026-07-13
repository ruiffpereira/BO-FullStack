import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./fixtures/login";

/**
 * Matriz RBAC EXAUSTIVA na UI.
 *
 * Complementa `rbac.spec.ts` (que cobre limited/agenda/gym): aqui cobre-se TODA a
 * matriz de utilizadores single-perm semeada em `scripts/seedE2e.ts` + o
 * `noaccess@e2e` (sem componentes) e o `admin@e2e` (tudo).
 *
 * O gating de UI é feito 100% pelo `Shell` (`src/components/Shell.tsx`):
 *  - a sidebar mostra `accessiblePaths` = /dashboard + módulos por permissão +
 *    CORE_PATHS (Clientes, Mensagens, Financeiro, Conteúdos, **Website**,
 *    Faturação — acessíveis a QUALQUER tenant, sem permissão) +
 *    (/admin + /estatisticas só para VIEW_ADMIN — Estatísticas está atrás de
 *    um gate TEMPORÁRIO de produto desde 2026-07-08, `ADMIN_GATED_PATHS` no
 *    Shell, à espera do Umami; a API continua tenant-open);
 *  - o guard (useEffect) redireciona qualquer rota NÃO acessível para
 *    accessiblePaths[0] — que é sempre /dashboard (sempre acessível);
 *  - **T3.8 (2026-07-14, un-gate seletivo do `/website`):** `/website` voltou
 *    a CORE_PATHS — todos os tenants acedem à página. O que continua gated
 *    por permissão (`VIEW_SITE_BUILDER` OU `VIEW_ADMIN`) é só a SUPERFÍCIE
 *    dentro dela: os subitens "Template"/"Domínio" (gating por SUBITEM,
 *    `SUBMENU['/website']` em `navigation.ts` — mesmo mecanismo do
 *    Conteúdos) redirecionam para o 1.º subitem permitido ("/website", não
 *    "/dashboard") quando faltam as duas permissões. O botão Publicar e a
 *    edição estrutural de páginas/blocos (`canEditStructure`) são gate DENTRO
 *    da página (`Website.tsx`), cobertos em `tests/unit/Website.test.tsx`,
 *    não aqui.
 *
 * NOTA: as páginas CORE não têm guard de rota — renderizam para todos; a proteção
 * dos DADOS é feita na API (isolamento). Por isso a matriz testa o que o Shell
 * garante: quais ITENS de módulo aparecem e quais ROTAS de módulo redirecionam.
 *
 * ⚠ NOTA HONESTA (T3.8, construído em paralelo com a API): a permissão
 * `VIEW_SITE_BUILDER` é nova — se o `seedE2e.ts` ainda não a atribuir a
 * nenhum dos utilizadores da matriz abaixo, os testes que dependem dela (ver
 * bloco "Website — Template/Domínio atrás de VIEW_SITE_BUILDER") só ficam
 * plenamente cobertos para `noaccess@e2e` (zero permissões, já hoje) e
 * `admin@e2e` (VIEW_ADMIN, já hoje) — os dois não dependem do seed novo.
 * Este ficheiro não foi corrido (precisa da API + BD de teste); confirmar ao
 * correr `pnpm test:e2e` depois do seed atualizado.
 */

// Cada teste autentica o seu próprio tenant — começa sem sessão.
test.use({ storageState: { cookies: [], origins: [] } });

const nav = (page: Page) => page.locator("nav").first();

/**
 * Navega para uma rota bloqueada e confirma que o guard redireciona para
 * /dashboard. Se, por uma corrida de rotação de refresh token (documentada no
 * playwright.config.ts), a sessão cair (aparece o ecrã de login), re-autentica e
 * repete UMA vez — sem enfraquecer o assert (a rota bloqueada tem MESMO de acabar
 * em /dashboard com sessão válida).
 */
async function expectBlockedRedirect(
  page: Page,
  context: import("@playwright/test").BrowserContext,
  user: string,
  route: string,
) {
  const MAX = 4;
  for (let attempt = 0; attempt < MAX; attempt++) {
    await page.goto(route);
    // Espera estabilizar: ou redirecionou (dashboard), ou ficou na rota, ou caiu
    // a sessão (login). Damos tempo ao guard.
    await page.waitForTimeout(1_500);
    const loginVisible = await page
      .getByRole("button", { name: "Entrar" })
      .isVisible()
      .catch(() => false);
    if (loginVisible) {
      // Sessão caiu por corrida de rotação de refresh token → re-autentica e repete.
      await loginAs(context, user);
      continue;
    }
    // Sessão viva: o guard TEM de nos ter tirado da rota bloqueada.
    await expect(page, `${user} não devia poder ficar em ${route}`).toHaveURL(/\/dashboard/, {
      timeout: 15_000,
    });
    return;
  }
  throw new Error(`Sessão de ${user} caiu repetidamente ao verificar ${route} (rotação de token).`);
}

// Itens CORE que TODOS os tenants (mesmo sem módulos) devem ver na sidebar.
// "Website" voltou a core a 2026-07-14 (T3.8, un-gate seletivo — ver
// docstring do ficheiro): a página é sempre acessível, só a SUPERFÍCIE lá
// dentro (Template/Domínio) é que gate por permissão.
const CORE_ITEMS = ["Clientes", "Mensagens", "Financeiro", "Conteúdos", "Website"];
// Estatísticas continua atrás do gate TEMPORÁRIO de produto (2026-07-08,
// `ADMIN_GATED_PATHS` no Shell.tsx): só visível/acessível com VIEW_ADMIN, como
// o Admin. Reverter o gate = devolvê-la a CORE_ITEMS aqui.
const ADMIN_GATED_ITEMS = ["Estatísticas"];
const ADMIN_GATED_ROUTES = ["/estatisticas"];
// Subitens de /website que exigem VIEW_SITE_BUILDER OU VIEW_ADMIN (T3.8,
// gating por SUBITEM — mesmo mecanismo do Conteúdos). Sem nenhuma das duas,
// o guard redireciona para "/website" (1.º subitem permitido), NÃO para
// "/dashboard" — a raiz é core, ao contrário de Estatísticas/Admin.
const SITE_BUILDER_GATED_ROUTES = ["/website/template", "/website/dominio"];
// Todos os itens de módulo (não-core, não-admin) — usados para verificar ocultação.
const ALL_MODULE_ITEMS = ["Loja", "Agenda", "Ginásio"];
// Rotas de módulo protegidas por permissão (o guard redireciona sem a permissão).
const ALL_MODULE_ROUTES = ["/loja", "/agenda", "/ginasio"];

/**
 * Matriz: cada utilizador single-perm → qual item/rota de módulo é o SEU, e quais
 * itens/rotas deve NÃO ter. Os users core-only (customers/cms/expenses/stats) não
 * têm qualquer item de MÓDULO — só veem core + dashboard.
 */
interface Row {
  user: string;
  /** Item de módulo visível (undefined = user core-only, sem módulo). */
  moduloItem?: string;
  /** Rota do seu módulo (undefined = core-only). */
  moduloPath?: string;
}

const MATRIX: Row[] = [
  { user: "limited@e2e", moduloItem: "Loja", moduloPath: "/loja" },
  { user: "agenda@e2e", moduloItem: "Agenda", moduloPath: "/agenda" },
  { user: "gym@e2e", moduloItem: "Ginásio", moduloPath: "/ginasio" },
  { user: "customers@e2e" }, // só VIEW_CUSTOMERS → core-only
  { user: "cms@e2e" }, // só VIEW_CMS → core-only
  { user: "expenses@e2e" }, // só VIEW_EXPENSES → core-only
  { user: "stats@e2e" }, // só VIEW_STATS → core-only
];

test.describe("RBAC matriz — sidebar por permissão (core + módulo próprio)", () => {
  for (const m of MATRIX) {
    const modulos = m.moduloItem ? `+ ${m.moduloItem}` : "(só core)";

    test(`${m.user}: sidebar mostra core ${modulos}, esconde módulos alheios e Admin`, async ({ page, context }) => {
      await loginAs(context, m.user);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

      // (1) Vê todos os itens CORE.
      for (const item of CORE_ITEMS) {
        await expect(
          nav(page).getByRole("button", { name: item, exact: true }),
          `${m.user} devia ver o item core "${item}"`,
        ).toBeVisible({ timeout: 10_000 });
      }

      // (2) Vê o seu módulo (se tiver um).
      if (m.moduloItem) {
        await expect(
          nav(page).getByRole("button", { name: m.moduloItem, exact: true }),
        ).toBeVisible();
      }

      // (3) NÃO vê os módulos que não são seus, nem o Admin, nem o item do
      // gate temporário de VIEW_ADMIN (Estatísticas, 2026-07-08). "Website" é
      // core desde T3.8 — já coberto por CORE_ITEMS acima, não entra aqui.
      const escondidos = ALL_MODULE_ITEMS.filter((i) => i !== m.moduloItem);
      for (const item of [...escondidos, "Admin", ...ADMIN_GATED_ITEMS]) {
        await expect(
          nav(page).getByRole("button", { name: item, exact: true }),
          `${m.user} NÃO devia ver o item "${item}"`,
        ).toHaveCount(0);
      }
    });

    if (m.moduloPath) {
      test(`${m.user}: acede à SUA página de módulo (${m.moduloPath})`, async ({ page, context }) => {
        await loginAs(context, m.user);
        await page.goto(m.moduloPath!);
        await expect(page).toHaveURL(new RegExp(m.moduloPath!.replace("/", "\\/")), { timeout: 15_000 });
        // Confirma que a sidebar carregou (sessão + permissões ok) — não caiu no login.
        await expect(nav(page).getByRole("button", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 10_000 });
      });
    }

    test(`${m.user}: rotas de módulo alheias (URL directo) redirecionam para /dashboard`, async ({ page, context }) => {
      await loginAs(context, m.user);
      // Rotas de módulo que não são suas + as rotas do gate temporário de
      // VIEW_ADMIN (Estatísticas) → o guard redireciona (não fica lá).
      const bloqueadas = ALL_MODULE_ROUTES.filter((r) => r !== m.moduloPath);
      for (const route of [...bloqueadas, "/admin", ...ADMIN_GATED_ROUTES]) {
        await expectBlockedRedirect(page, context, m.user, route);
      }
    });

    test(`${m.user}: as páginas CORE são acessíveis (não redirecionam)`, async ({ page, context }) => {
      await loginAs(context, m.user);
      // Core é acessível a todos os tenants — nenhuma destas rotas deve redirecionar
      // para /dashboard. (/despesas é deep-link do Financeiro, também permitido.
      // /website é core desde T3.8 (2026-07-14) — a raiz e "Páginas" (modo
      // conteúdo) são sempre acessíveis, mesmo sem VIEW_SITE_BUILDER/VIEW_ADMIN;
      // ver o describe "Website — Template/Domínio..." abaixo para o gating por
      // SUBITEM. /estatisticas continua fora daqui — gate temporário VIEW_ADMIN,
      // ver ADMIN_GATED_ROUTES acima.)
      for (const route of ["/clientes", "/financeiro", "/conteudos", "/despesas", "/website", "/website/paginas"]) {
        await page.goto(route);
        await expect(page, `${m.user} devia poder ficar em ${route}`).toHaveURL(
          new RegExp(route.replace("/", "\\/")),
          { timeout: 15_000 },
        );
      }
    });
  }
});

test.describe("RBAC matriz — noaccess@e2e (sem componentes)", () => {
  test("sidebar: só vê core + Dashboard; sem módulos, sem Admin", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Core visível.
    for (const item of CORE_ITEMS) {
      await expect(nav(page).getByRole("button", { name: item, exact: true })).toBeVisible({ timeout: 10_000 });
    }
    // Nenhum módulo, nenhum Admin, nem o item do gate temporário de VIEW_ADMIN
    // (Estatísticas, 2026-07-08). "Website" NÃO entra aqui — é core desde T3.8.
    for (const item of [...ALL_MODULE_ITEMS, "Admin", ...ADMIN_GATED_ITEMS]) {
      await expect(
        nav(page).getByRole("button", { name: item, exact: true }),
        `noaccess NÃO devia ver "${item}"`,
      ).toHaveCount(0);
    }
  });

  test("guard: /admin, /loja, /agenda, /ginasio → redirecionam para /dashboard", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    for (const route of ["/admin", "/loja", "/agenda", "/ginasio"]) {
      await expectBlockedRedirect(page, context, "noaccess@e2e", route);
    }
  });

  // T2.4: o guard de prefixo (findRoot em Shell.tsx) tem de cobrir também os
  // SUBPATHS de /admin — não só a raiz — senão um tenant sem VIEW_ADMIN
  // conseguiria aceder a uma subpágina (ex.: gerar tokens de site) navegando
  // directamente para o path, mesmo sem o item aparecer na sidebar.
  test("guard: /admin/tokens (subpágina) também redireciona para /dashboard", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await expectBlockedRedirect(page, context, "noaccess@e2e", "/admin/tokens");
  });

  test("core permanece acessível (cai em rota mínima, não em erro)", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await page.goto("/clientes");
    await expect(page).toHaveURL(/\/clientes/, { timeout: 15_000 });
    // Título só existe no topbar (h2, Shell.tsx) — a página já não tem h1 próprio.
    await expect(page.getByRole("heading", { name: "Clientes", level: 2 })).toBeVisible({ timeout: 10_000 });
  });

  // Gate temporário 2026-07-08 (ADMIN_GATED_PATHS no Shell.tsx): só
  // /estatisticas continua fora de CORE_PATHS — sem VIEW_ADMIN o guard
  // redireciona para /dashboard, mesmo mecanismo de prefixo do /admin/tokens
  // acima.
  test("gate temporário: /estatisticas redireciona para /dashboard", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    for (const route of ADMIN_GATED_ROUTES) {
      await expectBlockedRedirect(page, context, "noaccess@e2e", route);
    }
  });

  // T3.8 (2026-07-14): /website voltou a core — /website e /website/paginas
  // (mesmo o subpath, deep-link ao submenu) já NÃO redirecionam para
  // /dashboard, ao contrário do gate temporário acima.
  test("/website e /website/paginas são acessíveis mesmo sem VIEW_SITE_BUILDER/VIEW_ADMIN (core)", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    for (const route of ["/website", "/website/paginas"]) {
      await page.goto(route);
      await expect(page, `noaccess devia poder ficar em ${route}`).toHaveURL(
        new RegExp(route.replace("/", "\\/")),
        { timeout: 15_000 },
      );
    }
  });
});

// T3.8 (2026-07-14): gating por SUBITEM de /website — "Template"/"Domínio"
// exigem VIEW_SITE_BUILDER OU VIEW_ADMIN (`SUBMENU['/website']`,
// `navigation.ts`); sem nenhuma das duas o guard redireciona para "/website"
// (1.º subitem permitido), NÃO para "/dashboard" (a raiz é core). Testado só
// com `noaccess@e2e` (zero permissões) e `admin@e2e` (VIEW_ADMIN) — nenhum
// dos dois depende do seed novo de VIEW_SITE_BUILDER (ver nota honesta no
// topo do ficheiro).
test.describe("RBAC matriz — Website: Template/Domínio atrás de VIEW_SITE_BUILDER/VIEW_ADMIN", () => {
  test("noaccess@e2e: /website/template e /website/dominio redirecionam para /website (não /dashboard)", async ({
    page,
    context,
  }) => {
    await loginAs(context, "noaccess@e2e");
    for (const route of SITE_BUILDER_GATED_ROUTES) {
      await page.goto(route);
      await expect(page, `noaccess devia ser redirecionado de ${route} para /website`).toHaveURL(
        /\/website$/,
        { timeout: 15_000 },
      );
    }
  });

  test("noaccess@e2e: submenu de Website esconde Template e Domínio", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await page.goto("/website");
    await expect(page).toHaveURL(/\/website$/, { timeout: 15_000 });
    for (const label of ["O meu site", "Páginas", "Marca", "Rodapé & Nav"]) {
      await expect(nav(page).getByRole("button", { name: label, exact: true })).toBeVisible({ timeout: 10_000 });
    }
    for (const label of ["Template", "Domínio"]) {
      await expect(nav(page).getByRole("button", { name: label, exact: true })).toHaveCount(0);
    }
  });

  test("admin@e2e: acede a /website/template e /website/dominio sem redirect (VIEW_ADMIN cobre a OR)", async ({
    page,
    context,
  }) => {
    await loginAs(context, "admin@e2e");
    for (const route of SITE_BUILDER_GATED_ROUTES) {
      await page.goto(route);
      await expect(page, `admin devia aceder a ${route}`).toHaveURL(new RegExp(route.replace("/", "\\/")), {
        timeout: 15_000,
      });
    }
  });
});

test.describe("RBAC matriz — admin@e2e (acesso total)", () => {
  test("sidebar mostra TODOS os módulos + Admin + core (Website incl.) + Estatísticas (gate VIEW_ADMIN)", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    await page.goto("/dashboard");
    for (const name of [...CORE_ITEMS, ...ADMIN_GATED_ITEMS, ...ALL_MODULE_ITEMS, "Admin"]) {
      await expect(
        nav(page).getByRole("button", { name, exact: true }),
        `admin devia ver "${name}"`,
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("acede a todas as rotas de módulo + /admin + gate VIEW_ADMIN sem redirect", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    // /website/paginas confirma que o guard de submenu continua a servir os
    // subpaths de /website a quem tem VIEW_ADMIN (deep-link não expulsa).
    for (const route of ["/loja", "/agenda", "/ginasio", "/admin", "/estatisticas", "/website", "/website/paginas"]) {
      await page.goto(route);
      await expect(page, `admin devia aceder a ${route}`).toHaveURL(
        new RegExp(route.replace("/", "\\/")),
        { timeout: 15_000 },
      );
    }
  });

  test("/admin mostra a tabela de utilizadores", async ({ page, context }) => {
    // Login fresco + navegação directa (evita a rotação de refresh token de várias
    // navegações seguidas — ver comentário no playwright.config.ts).
    await loginAs(context, "admin@e2e");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10_000 });
  });
});
