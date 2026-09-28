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
 *    Faturação — acessíveis a QUALQUER tenant, sem permissão)
 *    + /admin, só para VIEW_ADMIN.
 *    As **Estatísticas** estiveram atrás de um gate TEMPORÁRIO de produto entre
 *    2026-07-08 e 2026-09-21 (`ADMIN_GATED_PATHS`, já apagado), à espera de o
 *    Umami estar provisionado para todos. A API sempre foi tenant-open — o
 *    gate era só de UI. A 2026-09-24 saíram da sidebar de topo e passaram a
 *    subitem de `/website` (`/website/estatisticas`): continuam core, mas quem
 *    lhes dá acesso é agora o `/website`, que também é core;
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
// "Estatísticas" SAIU desta lista a 2026-09-24: continua core, mas deixou de ser
// item de topo — é subitem de "Website" (`SUBMENU['/website']`). Os subitens só
// existem no DOM com o grupo expandido, e estes testes carregam o /dashboard,
// onde ele está fechado. A acessibilidade passou a ser coberta pelo loop de
// rotas core (`/website/estatisticas`), pelo teste do deep-link antigo, e pela
// visibilidade do subitem no teste dedicado mais abaixo.
// "Clientes" SAIU daqui (B5): os seus dois únicos subitens exigem VIEW_CUSTOMERS,
// e um root sem nenhum subitem permitido sai da sidebar (`accessiblePaths` no
// Shell.tsx) — só o vê quem tem a permissão. Verificado à parte, abaixo.
const CORE_ITEMS = ["Mensagens", "Financeiro", "Conteúdos", "Website"];
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
  /** A ÚNICA permissão deste user single-perm — usada para saber se tem
   * VIEW_CUSTOMERS/VIEW_EXPENSES (subitens gated dentro de páginas CORE,
   * B5) sem duplicar a matriz de novo. */
  perm: string;
}

const MATRIX: Row[] = [
  { user: "limited@e2e", moduloItem: "Loja", moduloPath: "/loja", perm: "VIEW_PRODUCTS" },
  { user: "agenda@e2e", moduloItem: "Agenda", moduloPath: "/agenda", perm: "VIEW_SCHEDULE" },
  { user: "gym@e2e", moduloItem: "Ginásio", moduloPath: "/ginasio", perm: "VIEW_GYM" },
  { user: "customers@e2e", perm: "VIEW_CUSTOMERS" }, // só VIEW_CUSTOMERS → core-only
  { user: "cms@e2e", perm: "VIEW_CMS" }, // só VIEW_CMS → core-only
  { user: "expenses@e2e", perm: "VIEW_EXPENSES" }, // só VIEW_EXPENSES → core-only
  { user: "stats@e2e", perm: "VIEW_STATS" }, // só VIEW_STATS → core-only
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

          // (1b) "Clientes" só com VIEW_CUSTOMERS (B5) — sem ela o item não pode
          // aparecer como link morto que atira para o dashboard.
          await expect(
            navItem(page, "Clientes"),
            `${m.user} ${m.perm === "VIEW_CUSTOMERS" ? "devia" : "NÃO devia"} ver "Clientes"`,
          ).toHaveCount(m.perm === "VIEW_CUSTOMERS" ? 1 : 0, { timeout: 10_000 });

          // (2) Vê o seu módulo (se tiver um).
          if (m.moduloItem) {
            await expect(
              nav(page).getByRole("button", { name: m.moduloItem, exact: true }),
            ).toBeVisible();
          }

          // (3) NÃO vê os módulos que não são seus, nem o Admin. "Website" é
          // core — já coberto por CORE_ITEMS acima, não entra aqui.
          const escondidos = ALL_MODULE_ITEMS.filter((i) => i !== m.moduloItem);
          for (const item of [...escondidos, "Admin"]) {
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
      // Rotas de módulo que não são suas → o guard redireciona (não fica lá).
      const bloqueadas = ALL_MODULE_ROUTES.filter((r) => r !== m.moduloPath);
      for (const route of [...bloqueadas, "/admin"]) {
        await expectBlockedRedirect(page, context, m.user, route);
      }
    });

    test(`${m.user}: as páginas CORE são acessíveis (não redirecionam)`, async ({ page, context }) => {
      await loginAs(context, m.user);
      // Core é acessível a todos os tenants — nenhuma destas rotas deve redirecionar
      // para /dashboard. /website é core desde T3.8 (2026-07-14) — a raiz ("O meu
      // site") é sempre acessível. "Páginas" e "Marca" estão ESCONDIDAS dos
      // clientes (2026-08-12, VIEW_ADMIN) — ainda não prontas; testadas no
      // redirect abaixo. As Estatísticas entraram aqui a 2026-09-21 (deixaram de
      // estar atrás de VIEW_ADMIN) e mudaram de morada a 2026-09-24: passaram de
      // item de topo a subitem do Website, em /website/estatisticas. Continuam
      // core — o /estatisticas antigo redirecciona para cá.
      //
      // NOTA (B5): /clientes e /despesas SAÍRAM desta lista incondicional —
      // "Clientes" e "Financeiro" continuam CORE (item sempre na sidebar), mas os
      // seus ÚNICOS subitens reais (`Lista`/`Leads` em /clientes, `Despesas` em
      // /financeiro/despesas) exigem VIEW_CUSTOMERS/VIEW_EXPENSES na API — quem
      // não as tem é redireccionado (guard do Shell.tsx), testado abaixo por user.
      for (const route of ["/financeiro", "/conteudos", "/website", "/website/estatisticas"]) {
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

    // /clientes exige VIEW_CUSTOMERS nos DOIS subitens (Lista e Leads, os únicos
    // que existem) — sem nenhum permitido, o guard trata a raiz como
    // indisponível e cai no dashboard (mesma semântica de uma rota desconhecida).
    if (m.perm === "VIEW_CUSTOMERS") {
      test(`${m.user}: /clientes é acessível (tem VIEW_CUSTOMERS)`, async ({ page, context }) => {
        await loginAs(context, m.user);
        await withSessionRetry(
          page,
          context,
          m.user,
          () => page.goto("/clientes"),
          () => expect(page, `${m.user} devia poder ficar em /clientes`).toHaveURL(/\/clientes/, { timeout: 15_000 }),
        );
      });
    } else {
      test(`${m.user}: /clientes SEM VIEW_CUSTOMERS redirecciona para /dashboard`, async ({ page, context }) => {
        await loginAs(context, m.user);
        await expectBlockedRedirect(page, context, m.user, "/clientes");
      });
    }

    // /financeiro/despesas exige VIEW_EXPENSES — sem ela, o guard de SUBITEM cai
    // no 1.º subitem permitido do MESMO pai ("O Negócio", /financeiro), não no
    // dashboard: /financeiro continua acessível a todos (tem subitens sem `perm`).
    if (m.perm === "VIEW_EXPENSES") {
      test(`${m.user}: /financeiro/despesas é acessível (tem VIEW_EXPENSES)`, async ({ page, context }) => {
        await loginAs(context, m.user);
        await withSessionRetry(
          page,
          context,
          m.user,
          () => page.goto("/financeiro/despesas"),
          () =>
            expect(page, `${m.user} devia poder ficar em /financeiro/despesas`).toHaveURL(
              /\/financeiro\/despesas/,
              { timeout: 15_000 },
            ),
        );
      });
    } else {
      test(`${m.user}: /financeiro/despesas SEM VIEW_EXPENSES redirecciona para /financeiro`, async ({ page, context }) => {
        await loginAs(context, m.user);
        await withSessionRetry(
          page,
          context,
          m.user,
          () => page.goto("/financeiro/despesas"),
          () =>
            expect(
              page,
              `${m.user} NÃO devia ficar em /financeiro/despesas`,
            ).toHaveURL(/\/financeiro$/, { timeout: 15_000 }),
        );
      });
    }
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
        // Sem VIEW_CUSTOMERS → "Clientes" fora da sidebar (B5).
        await expect(navItem(page, "Clientes")).toHaveCount(0);
        // Nenhum módulo, nenhum Admin. "Website" NÃO entra aqui — é core
        // (T3.8), já coberto acima.
        for (const item of [...ALL_MODULE_ITEMS, "Admin"]) {
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
    // /financeiro (não /clientes, B5): "O Negócio" não tem `perm` nenhuma, é o
    // fallback do próprio grupo — continua acessível a qualquer tenant, ao
    // contrário de /clientes, cujos DOIS únicos subitens agora exigem
    // VIEW_CUSTOMERS (ver testes dedicados abaixo).
    await loginAs(context, "noaccess@e2e");
    await withSessionRetry(
      page,
      context,
      "noaccess@e2e",
      () => page.goto("/financeiro"),
      async () => {
        await expect(page).toHaveURL(/\/financeiro/, { timeout: 15_000 });
        // Título só existe no topbar (h2, Shell.tsx) — a página já não tem h1 próprio.
        await expect(page.getByRole("heading", { name: "Financeiro", level: 2 })).toBeVisible({ timeout: 10_000 });
      },
    );
  });

  // B5: um tenant criado pelo admin sem VIEW_CUSTOMERS via o item "Clientes" na
  // sidebar (continua CORE, sempre visível) mas os seus dois únicos subitens
  // reais (Lista/Leads) exigem essa permissão na API — sem ela, o guard trata a
  // raiz como indisponível (nenhum subitem sobra) e cai no dashboard, em vez de
  // deixar a página renderizar e bater num "Erro ao carregar clientes".
  test("guard: /clientes SEM VIEW_CUSTOMERS redirecciona para /dashboard", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await expectBlockedRedirect(page, context, "noaccess@e2e", "/clientes");
  });

  test("guard: /clientes/leads SEM VIEW_CUSTOMERS também redirecciona para /dashboard", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await expectBlockedRedirect(page, context, "noaccess@e2e", "/clientes/leads");
  });

  // B5: /financeiro/despesas exige VIEW_EXPENSES — sem ela, o guard de SUBITEM
  // (não a raiz inteira, que continua acessível por "O Negócio") cai no 1.º
  // subitem permitido do mesmo grupo: /financeiro.
  test("guard: /financeiro/despesas SEM VIEW_EXPENSES redirecciona para /financeiro", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await withSessionRetry(
      page,
      context,
      "noaccess@e2e",
      () => page.goto("/financeiro/despesas"),
      () =>
        expect(page, "noaccess NÃO devia ficar em /financeiro/despesas").toHaveURL(/\/financeiro$/, {
          timeout: 15_000,
        }),
    );
  });

  // 2026-09-21: as Estatísticas entraram em CORE_PATHS e o gate temporário de
  // 2026-07-08 foi apagado. Este teste era o inverso — afirmava o redirect por
  // falta de permissão — e passa agora a provar o contrário: um tenant SEM
  // permissão nenhuma abre a página e fica lá. A API sempre foi core; era só a
  // UI que fechava.
  //
  // 2026-09-24: mudaram de morada (subitem do Website). A asserção tem de ser
  // ancorada em `/website/estatisticas$` — um `/\/estatisticas/` solto passaria
  // nos DOIS mundos, porque o path novo contém o antigo, e deixaria de provar
  // seja o que for.
  test("/website/estatisticas é acessível sem VIEW_ADMIN (core desde 2026-09-21)", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await withSessionRetry(
      page,
      context,
      "noaccess@e2e",
      () => page.goto("/website/estatisticas"),
      () =>
        expect(page, "noaccess devia poder ficar em /website/estatisticas").toHaveURL(
          /\/website\/estatisticas$/,
          { timeout: 15_000 },
        ),
    );
  });

  // Substitui a asserção que "Estatísticas" tinha em CORE_ITEMS: deixou de ser
  // botão de topo, por isso a prova de que um tenant sem permissões lá chega é
  // vê-lo dentro do grupo Website expandido. Sem isto, tirá-lo do CORE_ITEMS
  // teria removido cobertura em vez de a mudar de sítio.
  test("Estatísticas aparece como subitem do Website (sem permissões)", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await withSessionRetry(
      page,
      context,
      "noaccess@e2e",
      () => page.goto("/website"),
      async () => {
        await expect(page).toHaveURL(/\/website/, { timeout: 15_000 });
        await expect(
          nav(page).getByRole("button", { name: "Estatísticas", exact: true }),
          "o subitem Estatísticas devia estar visível com o grupo Website aberto",
        ).toBeVisible({ timeout: 10_000 });
      },
    );
  });

  // Deep-link antigo: quem tenha /estatisticas guardado nos favoritos tem de
  // continuar a chegar às Estatísticas, não a um 404 nem ao dashboard.
  test("/estatisticas (path antigo) redirecciona para /website/estatisticas", async ({ page, context }) => {
    await loginAs(context, "noaccess@e2e");
    await withSessionRetry(
      page,
      context,
      "noaccess@e2e",
      () => page.goto("/estatisticas"),
      () =>
        expect(page, "o path antigo devia redireccionar").toHaveURL(/\/website\/estatisticas$/, {
          timeout: 15_000,
        }),
    );
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
  test("sidebar mostra TODOS os módulos + Admin + core (Website incl.)", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    await withSessionRetry(
      page,
      context,
      "admin@e2e",
      () => page.goto("/dashboard"),
      async () => {
        for (const name of [...CORE_ITEMS, ...ALL_MODULE_ITEMS, "Admin"]) {
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
    for (const route of ["/loja", "/agenda", "/ginasio", "/admin", "/website", "/website/estatisticas", "/website/paginas"]) {
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
