import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { loginAs } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";

/**
 * Ronda grande (R6.3) — RESPONSIVO.
 *
 *  A) as páginas que mudaram na ronda, nas 3 larguras (1440 / 834 / 390): abrem sem erro, sem scroll horizontal da
 *     página nem do <main>, com captura em `.capturas/ronda-grande/capturas/` (para OLHAR);
 *  B) smoke a 834 e 390 em TODAS as páginas antigas: abre sem erro e sem scroll horizontal.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ retries: 0 });

const SHOTS = path.resolve(".capturas", "ronda-grande", "capturas");
fs.mkdirSync(SHOTS, { recursive: true });

const WIDTHS = [
  { w: 1440, h: 900 },
  { w: 834, h: 1112 },
  { w: 390, h: 844 },
] as const;

const sidebarOrDrawer = (page: Page) => page.locator("header").first();

async function settled(page: Page): Promise<void> {
  await expect(page.locator("main")).toBeVisible();
  await expect.poll(async () => /A carregar/.test(await page.locator("main").innerText()), { timeout: 15_000 }).toBe(false);
}

/** Largura a mais (px) do documento e do <main> — a página nunca pode fazer scroll horizontal. */
async function overflowX(page: Page): Promise<{ doc: number; main: number }> {
  return page.evaluate(() => {
    const de = document.documentElement;
    const m = document.querySelector("main");
    return { doc: de.scrollWidth - de.clientWidth, main: m ? m.scrollWidth - m.clientWidth : 0 };
  });
}

async function open(page: Page, context: BrowserContext, user: string, route: string, ready?: () => Promise<void>): Promise<void> {
  await withSessionRetry(page, context, user, () => page.goto(route), async () => {
    await expect(sidebarOrDrawer(page)).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe(route.split("?")[0]);
    await settled(page);
    if (ready) await ready();
  });
}

async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const o = await overflowX(page);
  expect.soft(o.doc, `${label}: a página tem scroll horizontal (${o.doc}px)`).toBeLessThanOrEqual(1);
  expect.soft(o.main, `${label}: o <main> tem scroll horizontal (${o.main}px)`).toBeLessThanOrEqual(1);
}

async function expectNoError(page: Page, label: string): Promise<void> {
  const t = await page.locator("main").innerText();
  expect.soft(t, `${label}: erro de carregamento`).not.toMatch(/Erro ao carregar|Não foi possível carregar/);
}

// ═══════════════════ A · páginas que mudaram na ronda, nas 3 larguras ═══════════════════

interface Mudou {
  slug: string;
  user: string;
  route: string;
  /** Algo visível que prova que a página carregou com conteúdo. */
  ready: (page: Page) => Promise<void>;
  /** Passo extra (abrir ficha, modal…) a capturar e a verificar. */
  extra?: (page: Page) => Promise<void>;
}

const MUDARAM: Mudou[] = [
  { slug: "agenda-calendario", user: "arvore-a@e2e.local", route: "/agenda", ready: async (p) => { await expect(p.locator("main")).toContainText(/Ametista|\d{1,2}/); } },
  { slug: "agenda-marcacoes", user: "arvore-a@e2e.local", route: "/agenda/marcacoes", ready: async (p) => { await expect(p.getByText("Marc Ametista Paga").first()).toBeVisible(); } },
  { slug: "agenda-profissionais", user: "equipa@e2e.local", route: "/agenda/profissionais", ready: async (p) => { await expect(p.getByText("Pedro Tesoura").first()).toBeVisible(); } },
  { slug: "financeiro-negocio", user: "arvore-a@e2e.local", route: "/financeiro", ready: async (p) => { await expect(p.locator("main")).toContainText(/Receita|Negócio|€/); } },
  { slug: "financeiro-agenda", user: "arvore-a@e2e.local", route: "/financeiro/agenda", ready: async (p) => { await expect(p.getByRole("button", { name: "Este mês" })).toBeVisible(); } },
  { slug: "financeiro-loja", user: "arvore-a@e2e.local", route: "/financeiro/loja", ready: async (p) => { await expect(p.getByRole("button", { name: "Este mês" })).toBeVisible(); } },
  { slug: "financeiro-despesas", user: "arvore-a@e2e.local", route: "/financeiro/despesas", ready: async (p) => { await expect(p.locator("main")).toContainText(/Despesa|despesa/); } },
  { slug: "dashboard", user: "arvore-a@e2e.local", route: "/dashboard", ready: async (p) => { await expect(p.locator("main")).toContainText(/€|Marcações|Resumo|Hoje/); } },
  { slug: "loja-encomendas", user: "arvore-a@e2e.local", route: "/loja/encomendas", ready: async (p) => { await expect(p.locator("main")).toContainText(/123,45/); } },
  { slug: "equipa", user: "equipa@e2e.local", route: "/equipa", ready: async (p) => { await expect(p.getByText("Ana Membro").first()).toBeVisible(); } },
  { slug: "mensagens-clientes", user: "arvore-a@e2e.local", route: "/mensagens", ready: async (p) => { await expect(p.locator("main")).toBeVisible(); } },
  { slug: "mensagens-backoffice", user: "arvore-a@e2e.local", route: "/mensagens/backoffice", ready: async (p) => { await expect(p.locator("main")).toBeVisible(); } },
  { slug: "correio-caixa", user: "correio@e2e.local", route: "/correio", ready: async (p) => { await expect(p.locator("main")).toBeVisible(); } },
  { slug: "correio-contactos", user: "correio@e2e.local", route: "/correio/contactos", ready: async (p) => { await expect(p.locator("main")).toContainText(/Contacto|contacto/); } },
  { slug: "correio-campanhas", user: "correio@e2e.local", route: "/correio/campanhas", ready: async (p) => { await expect(p.locator("main")).toContainText(/Campanha|campanha/); } },
  {
    slug: "clientes-ficha", user: "correio@e2e.local", route: "/clientes",
    ready: async (p) => { await expect(p.getByText("Cliente Correio").first()).toBeVisible(); },
    extra: async (p) => {
      await p.getByText("Cliente Correio").first().click();
      await expect(p.getByRole("dialog").or(p.getByText(/Aceita novidades/i)).first()).toBeVisible({ timeout: 10_000 });
    },
  },
  { slug: "admin-utilizadores", user: "admin@e2e", route: "/admin", ready: async (p) => { await expect(p.locator("main")).toContainText(/@e2e/); } },
  { slug: "admin-sistema", user: "admin@e2e", route: "/admin/sistema", ready: async (p) => { await expect(p.locator("main")).toContainText(/Email|Sistema/); } },
  { slug: "perfil-suporte", user: "suporte-perfil@e2e.local", route: "/perfil", ready: async (p) => { await expect(p.locator("main")).toContainText(/suporte/i); } },
];

for (const vp of WIDTHS) {
  test.describe(`Páginas da ronda — ${vp.w}px`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });
    for (const pg of MUDARAM) {
      test(`${pg.slug}: abre, sem scroll horizontal, com captura`, async ({ page, context }) => {
        test.skip(pg.slug === "correio-campanhas", "FEATURES.campaigns = false (dono 2026-10-24)");
        await loginAs(context, pg.user);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await open(page, context, pg.user, pg.route, () => pg.ready(page));
        await expectNoError(page, `${pg.slug}@${vp.w}`);
        await expectNoHorizontalScroll(page, `${pg.slug}@${vp.w}`);
        await page.screenshot({ path: path.join(SHOTS, `${pg.slug}-${vp.w}.png`) });
        if (pg.extra) {
          await pg.extra(page);
          await expectNoHorizontalScroll(page, `${pg.slug} (aberto)@${vp.w}`);
          await page.screenshot({ path: path.join(SHOTS, `${pg.slug}-aberto-${vp.w}.png`) });
          // O painel/modal aberto cabe no ecrã.
          const dlg = page.getByRole("dialog").first();
          if (await dlg.count()) {
            const box = await dlg.boundingBox();
            if (box) {
              expect.soft(box.x, `${pg.slug}: painel começa fora do ecrã`).toBeGreaterThanOrEqual(-1);
              expect.soft(box.x + box.width, `${pg.slug}: painel passa a largura do ecrã`).toBeLessThanOrEqual(vp.w + 1);
            }
          }
        }
        expect.soft(errors, `${pg.slug}@${vp.w}: excepções no browser`).toEqual([]);
      });
    }
  });
}

// ═══════════════════ B · smoke a 834 e 390 em todas as páginas ═══════════════════

const SMOKE_DONO = [
  "/dashboard", "/estatisticas", "/paginas", "/faturacao", "/perfil", "/equipa",
  "/financeiro", "/financeiro/agenda", "/financeiro/loja", "/financeiro/ginasio", "/financeiro/despesas",
  "/clientes", "/clientes/leads", "/mensagens", "/mensagens/backoffice",
  "/loja", "/loja/encomendas", "/loja/categorias",
  "/agenda", "/agenda/marcacoes", "/agenda/servicos", "/agenda/profissionais", "/agenda/config",
  "/ginasio", "/ginasio/treinos", "/ginasio/planos", "/ginasio/clientes",
  "/conteudos", "/conteudos/produtos", "/conteudos/servicos", "/conteudos/ginasio", "/conteudos/linguas", "/conteudos/emails", "/conteudos/notificacoes",
];
const SMOKE_ADMIN = [
  "/admin", "/admin/permissoes", "/admin/componentes", "/admin/tokens", "/admin/dominios", "/admin/faturacao",
  "/admin/integracoes", "/admin/atividade", "/admin/sistema",
];

for (const vp of WIDTHS.filter((v) => v.w < 1000)) {
  test.describe(`Smoke de todas as páginas — ${vp.w}px`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });
    for (const [user, routes] of [["arvore-a@e2e.local", SMOKE_DONO], ["admin@e2e", SMOKE_ADMIN]] as const) {
      test(`${user}: ${routes.length} páginas abrem sem erro nem scroll horizontal`, async ({ page, context }) => {
        test.setTimeout(900_000);
        await loginAs(context, user);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        for (const route of routes) {
          await open(page, context, user, route);
          await expectNoError(page, `${route}@${vp.w}`);
          await expectNoHorizontalScroll(page, `${route}@${vp.w}`);
        }
        expect.soft(errors, `excepções no browser @${vp.w}`).toEqual([]);
      });
    }
  });
}

// ═══════════════════ C · o botão flutuante das mensagens não tapa o fim da página ═══════════════════

test.describe("Fim da página livre do botão flutuante — 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const route of ["/perfil", "/agenda/config", "/loja/categorias"]) {
    test(`${route}: o último botão, com a página no fim, não fica por baixo do botão de mensagens`, async ({ page, context }) => {
      const user = "arvore-a@e2e.local";
      await loginAs(context, user);
      await open(page, context, user, route);
      await page.evaluate(() => { const m = document.querySelector("main"); if (m) m.scrollTop = m.scrollHeight; });
      const fab = await page.getByRole("button", { name: /^Mensagens/ }).last().boundingBox();
      expect(fab, "botão flutuante de mensagens").toBeTruthy();
      const buttons = page.locator("main button:visible");
      const n = await buttons.count();
      for (let i = 0; i < n; i++) {
        const box = await buttons.nth(i).boundingBox();
        if (!box || box.y + box.height < 0 || box.y > 844) continue;
        const overlap = box.x < fab!.x + fab!.width && box.x + box.width > fab!.x && box.y < fab!.y + fab!.height && box.y + box.height > fab!.y;
        expect(overlap, `${route}: o botão #${i} (${(await buttons.nth(i).innerText()).slice(0, 30)}) está por baixo do botão de mensagens`).toBe(false);
      }
    });
  }
});
