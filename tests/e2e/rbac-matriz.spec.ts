import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./fixtures/login";
import { expectBlockedRedirect, withSessionRetry } from "./fixtures/session";

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
 *    dentro dela: o botão Publicar e a edição estrutural de páginas/blocos
 *    (`canEditStructure`) são gate DENTRO da página (`Website.tsx`), cobertos
 *    em `tests/unit/Website.test.tsx`, não aqui.
 *
 * NOTA: as páginas CORE não têm guard de rota — renderizam para todos; a proteção
 * dos DADOS é feita na API (isolamento). Por isso a matriz testa o que o Shell
 * garante: quais ITENS de módulo aparecem e quais ROTAS de módulo redirecionam.
 *
 */

// Cada teste autentica o seu próprio tenant — começa sem sessão.
test.use({ storageState: { cookies: [], origins: [] } });

const nav = (page: Page) => page.locator("nav").first();

/**
 * Locator de um item da sidebar por nome — tolerante ao badge de não-lidas de
 * "Mensagens" (achado a 2026-09-21, ao validar o fix do B11: `chat.spec.ts`
 * corre antes deste ficheiro e deixa `limited@e2e` com mensagens por ler; o
 * `NavItem`, Shell.tsx, muda o `aria-label` para "Mensagens, N não lida(s)"
 * quando `unread > 0` — o nome acessível deixa de ser exactamente "Mensagens").
 * Nenhum outro item da sidebar recebe badge (`SidebarContent` só passa `badge`
 * a `/mensagens`), por isso só este precisa do prefixo tolerante — os
 * restantes continuam `exact: true`, sem perder precisão.
 */
function navItem(page: Page, name: string) {
  if (name === "Mensagens") {
    return nav(page).getByRole("button", { name: /^Mensagens(,.*)?$/ });
  }
  return nav(page).getByRole("button", { name, exact: true });
}

// `expectBlockedRedirect`/`withSessionRetry` (importados de `./fixtures/session`)
// mitigam a corrida diagnosticada no `AuthContext.doRefresh` (três chamadas em
// série, 5s de timeout cada — ver docs/ARMADILHAS.md → "Testes e2e"): sob
// carga, a app pode cair no ecrã de Login em vez de mostrar a rota pedida.
// Re-autentica e repete, sem nunca enfraquecer o assert em si.

// Itens CORE que TODOS os tenants (mesmo sem módulos) devem ver na sidebar.
// "Website" voltou a core a 2026-07-14 (T3.8, un-gate seletivo): a página é
// sempre acessível a todos; o gating de conteúdo (botão Publicar, editar
// estrutura) é verificado em `tests/unit/Website.test.tsx`.
const CORE_ITEMS = ["Clientes", "Mensagens", "Financeiro", "Conteúdos", "Website"];
// Estatísticas continua atrás do gate TEMPORÁRIO de produto (2026-07-08,
// `ADMIN_GATED_PATHS` no Shell.tsx): só visível/acessível com VIEW_ADMIN, como
// o Admin. Reverter o gate = devolvê-la a CORE_ITEMS aqui.
const ADMIN_GATED_ITEMS = ["Estatísticas"];
const ADMIN_GATED_ROUTES = ["/estatisticas"];
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
      await withSessionRetry(
        page,
        context,
        m.user,
        () => page.goto("/dashboard"),
        async () => {
          await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

          // (1) Vê todos os itens CORE.
          for (const item of CORE_ITEMS) {
            await expect(
              navItem(page, item),
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
        },
      );
    });

    if (m.moduloPath) {
      test(`${m.user}: acede à SUA página de módulo (${m.moduloPath})`, async ({ page, context }) => {
        await loginAs(context, m.user);
        await withSessionRetry(
          page,
          context,
          m.user,
          () => page.goto(m.moduloPath!),
          async () => {
            await expect(page).toHaveURL(new RegExp(m.moduloPath!.replace("/", "\\/")), { timeout: 15_000 });
            // Confirma que a sidebar carregou (sessão + permissões ok) — não caiu no login.
            await expect(nav(page).getByRole("button", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 10_000 });
          },
        );
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
      // /website é core desde T3.8 (2026-07-14) — a raiz ("O meu site") é sempre
      // acessível. "Páginas" e "Marca" estão ESCONDIDAS dos clientes (2026-08-12,
      // VIEW_ADMIN) — ainda não prontas; testadas no redirect abaixo.
      // /estatisticas continua fora daqui — gate temporário VIEW_ADMIN, ver
      // ADMIN_GATED_ROUTES acima.)
      for (const route of ["/clientes", "/financeiro", "/conteudos", "/despesas", "/website"]) {
        await withSessionRetry(
          page,
          context,
          m.user,
          () => page.goto(route),
          () =>
            expect(page, `${m.user} devia poder ficar em ${route}`).toHaveURL(
              new RegExp(route.replace("/", "\\/")),
              { timeout: 15_000 },
            ),
        );
      }
    });
  }
});

test.describe("RBAC matriz — noaccess@e2e (sem componentes)", () => {
  test("sidebar: só vê core + Dashboard; sem módulos, sem Admin", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await withSessionRetry(
      page,
      context,
      "noaccess@e2e",
      () => page.goto("/dashboard"),
      async () => {
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

        // Core visível.
        for (const item of CORE_ITEMS) {
          await expect(navItem(page, item)).toBeVisible({ timeout: 10_000 });
        }
        // Nenhum módulo, nenhum Admin, nem o item do gate temporário de VIEW_ADMIN
        // (Estatísticas, 2026-07-08). "Website" NÃO entra aqui — é core desde T3.8.
        for (const item of [...ALL_MODULE_ITEMS, "Admin", ...ADMIN_GATED_ITEMS]) {
          await expect(
            nav(page).getByRole("button", { name: item, exact: true }),
            `noaccess NÃO devia ver "${item}"`,
          ).toHaveCount(0);
        }
      },
    );
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
    await withSessionRetry(
      page,
      context,
      "noaccess@e2e",
      () => page.goto("/clientes"),
      async () => {
        await expect(page).toHaveURL(/\/clientes/, { timeout: 15_000 });
        // Título só existe no topbar (h2, Shell.tsx) — a página já não tem h1 próprio.
        await expect(page.getByRole("heading", { name: "Clientes", level: 2 })).toBeVisible({ timeout: 10_000 });
      },
    );
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

  // T3.8 (2026-07-14): /website voltou a core — a raiz já NÃO redireciona para
  // /dashboard, ao contrário do gate temporário acima.
  // NOTA (2026-09-21, ao aplicar o `withSessionRetry` do B11): este teste tinha
  // "/website/paginas" na lista, e a asserção era **vazia**. `toHaveURL` faz
  // polling e acertava logo no primeiro tick — na URL que o browser tem a
  // seguir ao `goto`, ANTES de o guard de submenu do `Shell.tsx` correr. Passava
  // sempre, com ou sem guard, e por isso não provava nada. O `withSessionRetry`
  // espera que a sessão assente antes de asserir, e foi essa espera que
  // destapou o buraco: com o redirect já feito, a asserção deixou de acertar.
  //
  // O comportamento REAL — sem `VIEW_ADMIN`, "/website/paginas" redireciona
  // para "/website" — está correctamente coberto no describe "Website: Páginas
  // + Marca escondidas dos clientes", mais abaixo, que espera pelo estado
  // ASSENTE. A rota sai daqui por duplicar essa cobertura mal; não se perde
  // nada.
  //
  // ⚠ A mesma armadilha vive em qualquer `goto(x)` + `toHaveURL(x)` deste
  // ficheiro: afirmam que a navegação não foi bloqueada, mas medem antes de o
  // guard poder bloquear. Só valem alguma coisa depois de a sessão assentar.
  test("/website é acessível mesmo sem VIEW_SITE_BUILDER/VIEW_ADMIN (core)", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    for (const route of ["/website"]) {
      await withSessionRetry(
        page,
        context,
        "noaccess@e2e",
        () => page.goto(route),
        () =>
          expect(page, `noaccess devia poder ficar em ${route}`).toHaveURL(
            new RegExp(route.replace("/", "\\/")),
            { timeout: 15_000 },
          ),
      );
    }
  });
});

// Backward compatibility: paths antigos de /website redirecionam para /website
// (o editor de site foi reorganizado: só ficam "O meu site", "Páginas" e "Marca").
test.describe("RBAC matriz — Website: backward compatibility (paths antigos redirecionam)", () => {
  test("paths antigos de /website redirecionam para /website", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    const legacyRoutes = ["/website/template", "/website/rodape-nav", "/website/dominio", "/website/definicoes"];
    for (const route of legacyRoutes) {
      await withSessionRetry(
        page,
        context,
        "admin@e2e",
        () => page.goto(route),
        () =>
          expect(page, `${route} devia redirecionar para /website`).toHaveURL(/\/website$/, { timeout: 15_000 }),
      );
    }
  });
});

// Gating de /website: "Páginas" e "Marca" estão escondidas dos clientes (2026-08-12,
// VIEW_ADMIN) — ainda não prontas. Sem VIEW_ADMIN o guard redireciona-as para
// /website ("O meu site"), e o Website mostra-se como link simples (1 subitem).
test.describe("RBAC matriz — Website: Páginas + Marca escondidas dos clientes", () => {
  test("noaccess@e2e: sidebar do Website não mostra 'Páginas' nem 'Marca'", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await withSessionRetry(
      page,
      context,
      "noaccess@e2e",
      () => page.goto("/website"),
      async () => {
        await expect(page).toHaveURL(/\/website$/, { timeout: 15_000 });
        await expect(page.getByRole("button", { name: "Páginas", exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Marca", exact: true })).toHaveCount(0);
      },
    );
  });

  for (const route of ["/website/paginas", "/website/marca"]) {
    test(`noaccess@e2e: ${route} está ESCONDIDA (redireciona para /website)`, async ({ page, context }) => {
      await loginAs(context, "noaccess@e2e");
      // Sem VIEW_ADMIN o subitem não existe → o guard cai no 1.º permitido (/website).
      await withSessionRetry(
        page,
        context,
        "noaccess@e2e",
        () => page.goto(route),
        () => expect(page).toHaveURL(/\/website$/, { timeout: 15_000 }),
      );
    });
  }

  test("noaccess@e2e: /website não mostra secção de Domínio (Subdomínio) sem VIEW_SITE_BUILDER", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await withSessionRetry(
      page,
      context,
      "noaccess@e2e",
      () => page.goto("/website"),
      async () => {
        await expect(page).toHaveURL(/\/website$/, { timeout: 15_000 });
        // A secção de Subdomínio/Domínio (DomainSection, Website.tsx) não deve
        // aparecer sem VIEW_SITE_BUILDER. Heading exacto (o <h2> do
        // `<SectionTitle>Subdomínio</SectionTitle>` da secção gated) — NÃO
        // `getByText(/Subdomínio/i)`: essa regex também casa com texto do
        // checklist de publicação, sempre visível a todos ("Reclamar um
        // subdomínio", "Reclama um subdomínio primeiro." — `setupSteps`/
        // `publishReason` em Website.tsx), que é ungated de propósito e dava
        // um falso positivo determinístico (achado a 2026-09-21, ao validar
        // o fix do B11 — não é flakiness de sessão).
        await expect(page.getByRole("heading", { name: "Subdomínio", exact: true })).toHaveCount(0);
      },
    );
  });
});

test.describe("RBAC matriz — admin@e2e (acesso total)", () => {
  test("sidebar mostra TODOS os módulos + Admin + core (Website incl.) + Estatísticas (gate VIEW_ADMIN)", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    await withSessionRetry(
      page,
      context,
      "admin@e2e",
      () => page.goto("/dashboard"),
      async () => {
        for (const name of [...CORE_ITEMS, ...ADMIN_GATED_ITEMS, ...ALL_MODULE_ITEMS, "Admin"]) {
          await expect(
            navItem(page, name),
            `admin devia ver "${name}"`,
          ).toBeVisible({ timeout: 10_000 });
        }
      },
    );
  });

  test("acede a todas as rotas de módulo + /admin + gate VIEW_ADMIN sem redirect", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    // /website/paginas confirma que o guard de submenu continua a servir os
    // subpaths de /website a quem tem VIEW_ADMIN (deep-link não expulsa).
    for (const route of ["/loja", "/agenda", "/ginasio", "/admin", "/estatisticas", "/website", "/website/paginas"]) {
      await withSessionRetry(
        page,
        context,
        "admin@e2e",
        () => page.goto(route),
        () =>
          expect(page, `admin devia aceder a ${route}`).toHaveURL(
            new RegExp(route.replace("/", "\\/")),
            { timeout: 15_000 },
          ),
      );
    }
  });

  test("/admin mostra a tabela de utilizadores", async ({ page, context }) => {
    // Login fresco + navegação directa (evita a rotação de refresh token de várias
    // navegações seguidas — ver comentário no playwright.config.ts).
    await loginAs(context, "admin@e2e");
    await withSessionRetry(
      page,
      context,
      "admin@e2e",
      () => page.goto("/admin"),
      async () => {
        await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
        await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10_000 });
      },
    );
  });
});
