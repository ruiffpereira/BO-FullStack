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
 *    CORE_PATHS (Clientes, Mensagens, Financeiro, Conteúdos, Faturação —
 *    acessíveis a QUALQUER tenant, sem permissão) +
 *    (/admin + /estatisticas + /website só para VIEW_ADMIN — Estatísticas e
 *    Website estão atrás de um gate TEMPORÁRIO de produto desde 2026-07-08,
 *    `ADMIN_GATED_PATHS` no Shell; a API continua tenant-open);
 *  - o guard (useEffect) redireciona qualquer rota NÃO acessível para
 *    accessiblePaths[0] — que é sempre /dashboard (sempre acessível).
 *
 * NOTA: as páginas CORE não têm guard de rota — renderizam para todos; a proteção
 * dos DADOS é feita na API (isolamento). Por isso a matriz testa o que o Shell
 * garante: quais ITENS de módulo aparecem e quais ROTAS de módulo redirecionam.
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
const CORE_ITEMS = ["Clientes", "Mensagens", "Financeiro", "Conteúdos"];
// Estatísticas e Website deixaram de ser core a 2026-07-08 (gate TEMPORÁRIO de
// produto — `ADMIN_GATED_PATHS` no Shell.tsx): só visíveis/acessíveis com
// VIEW_ADMIN, como o Admin. Reverter o gate = devolvê-los a CORE_ITEMS aqui.
const ADMIN_GATED_ITEMS = ["Estatísticas", "Website"];
const ADMIN_GATED_ROUTES = ["/estatisticas", "/website"];
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

      // (3) NÃO vê os módulos que não são seus, nem o Admin, nem os itens do
      // gate temporário de VIEW_ADMIN (Estatísticas/Website, 2026-07-08).
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
      // VIEW_ADMIN (Estatísticas/Website) → o guard redireciona (não fica lá).
      const bloqueadas = ALL_MODULE_ROUTES.filter((r) => r !== m.moduloPath);
      for (const route of [...bloqueadas, "/admin", ...ADMIN_GATED_ROUTES]) {
        await expectBlockedRedirect(page, context, m.user, route);
      }
    });

    test(`${m.user}: as páginas CORE são acessíveis (não redirecionam)`, async ({ page, context }) => {
      await loginAs(context, m.user);
      // Core é acessível a todos os tenants — nenhuma destas rotas deve redirecionar
      // para /dashboard. (/despesas é deep-link do Financeiro, também permitido.
      // /estatisticas e /website saíram daqui a 2026-07-08 — gate temporário
      // VIEW_ADMIN, ver ADMIN_GATED_ROUTES acima.)
      for (const route of ["/clientes", "/financeiro", "/conteudos", "/despesas"]) {
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
    // Nenhum módulo, nenhum Admin, nem os itens do gate temporário de
    // VIEW_ADMIN (Estatísticas/Website, 2026-07-08).
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

  // Gate temporário 2026-07-08 (ADMIN_GATED_PATHS no Shell.tsx): /website e
  // /estatisticas deixaram de ser core — sem VIEW_ADMIN o guard redireciona
  // para /dashboard, incluindo os SUBPATHS de /website (deep-link ao submenu),
  // pelo mesmo mecanismo de prefixo do /admin/tokens acima.
  test("gate temporário: /website, /website/paginas e /estatisticas redirecionam para /dashboard", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    for (const route of [...ADMIN_GATED_ROUTES, "/website/paginas"]) {
      await expectBlockedRedirect(page, context, "noaccess@e2e", route);
    }
  });
});

test.describe("RBAC matriz — admin@e2e (acesso total)", () => {
  test("sidebar mostra TODOS os módulos + Admin + Estatísticas/Website (gate VIEW_ADMIN)", async ({ page, context }) => {
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
