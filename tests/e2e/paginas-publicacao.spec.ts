import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { API, loginAs } from "./fixtures/login";
import { ADMIN, apiLogin, grantSupportAccess, openSupportTab } from "./fixtures/support";
import { patchSiteBuilder } from "./fixtures/siteBuilderRoute";
import { PaginasPage, VIEWPORTS } from "./pages/PaginasPage";
import { randomUUID } from "node:crypto";

/**
 * B38 · P2 — publicação pelo Coolify.
 *
 * 1. «Publicação (Coolify)» nas Definições do site, numa sessão de suporte (API REAL): webhook inválido → mensagem da
 *    API; webhook válido → «App configurada: <uuid>» (+ «build sem cache» com force=true); «Testar» sem o token
 *    COOLIFY_DEPLOY_TOKEN na API de e2e dá a verificação «Token» a falhar (nunca chega ao Coolify); «Desligar» volta a
 *    «Por configurar». A API de e2e não tem o token → o aviso `publish-no-token` aparece.
 * 2. A barra `publish-bar` (Em fila… / A construir o site… / A confirmar… com percentagem, «Falhou: …», «Site
 *    actualizado · hh:mm»). O Coolify não existe em e2e e o job de 10 s não corre com ENVIRONMENT=TEST, por isso o estado
 *    de publicação é forçado interceptando o `GET /cms/site-builder` (campo `publish` da resposta real é substituído).
 *    O estado vem sempre do servidor: «sobrevive ao refresh» recarrega a página com o mesmo estado forjado.
 * 3. Equipa: um membro só com «ver» ou só com «editar rascunho» (sem `paginas.publicar`) vê a barra mas não tem
 *    Definições do site nem «Publicar agora», e a API recusa-lhe settings/publish (403).
 */

test.use({ storageState: { cookies: [], origins: [] } });

const SUPPORT_TENANT = "pagesB@e2e";
const OWNER = "pages@e2e";
const OWNER_A = "arvore-a@e2e.local"; // dono do site a que os membros pertencem
const MEMBER_VER = "av-paginasver@e2e.local";
const MEMBER_RASCUNHO = "av-paginasrascunho@e2e.local";
const MEMBER_PUBLICA = "av-paginaspublica@e2e.local";
const WEBHOOK = (uuid: string, force = false) => `https://coolify.exemplo.pt/api/v1/deploy?uuid=${uuid}&force=${force}`;

type Pub = Record<string, unknown>;
const base = (over: Pub): Pub => ({ mode: "coolify", status: "idle", phase: null, startedAt: null, estimatedMs: null, liveRevision: null, requestedAt: null, liveAt: null, error: null, ...over });

/** Força o campo `publish` do `GET /cms/site-builder` (`forced.pub` muda-se a meio do teste). */
async function forcePublish(page: Page): Promise<{ pub: Pub | null }> {
  const state = await patchSiteBuilder(page);
  return {
    get pub() {
      return (state.patch?.publish as Pub | undefined) ?? null;
    },
    set pub(v: Pub | null) {
      state.patch = v ? { publish: v } : null;
    },
  };
}

/** Os membros só lêem: garante que o site do dono tem uma página inicial (senão o page-object tentava criá-la). */
async function ensureOwnerHome(request: APIRequestContext): Promise<void> {
  const { headers } = await apiLogin(request, OWNER_A);
  const state = await (await request.get(`${API}/cms/site-builder`, { headers })).json();
  if (((state.pages ?? []) as unknown[]).length > 0) return;
  const res = await request.post(`${API}/cms/site-builder/save`, {
    headers,
    data: { baseRevision: state.revision, pages: { upsert: [{ id: randomUUID(), slug: "", isHome: true, title: { pt: "Início", en: "Home" } }] } },
  });
  expect(res.status(), await res.text()).toBe(200);
}

const bar = (page: Page) => page.getByTestId("publish-bar");

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · publicação (Coolify) — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("sessão de suporte: webhook inválido, guardar, testar sem token, trocar e desligar", async ({ context, request }) => {
      const { userId } = await grantSupportAccess(request, SUPPORT_TENANT);
      await loginAs(context, ADMIN);
      const support = await openSupportTab(context, userId);
      const sp = new PaginasPage(support, context, ADMIN);
      let headers: Record<string, string> | null = null;
      support.on("request", (r) => {
        if (r.url().includes("/cms/site-builder/support") && r.headers()["authorization"]) headers = { Authorization: r.headers()["authorization"] };
      });
      try {
        await sp.gotoInSession();
        let dialog = await sp.openSettings();
        const pub = dialog.getByTestId("publish-section");
        await expect(pub).toBeVisible({ timeout: 10_000 });
        const webhook = dialog.getByTestId("publish-webhook");
        const save = dialog.getByTestId("publish-save");
        const test_ = dialog.getByTestId("publish-test");
        const off = dialog.getByTestId("publish-off");

        // Estado limpo (uma corrida anterior pode ter deixado o tenant ligado).
        if (await off.count()) {
          await off.click();
          await expect(support.getByText("Publicação desligada")).toBeVisible();
          await expect(off).toHaveCount(0);
        }
        await expect(pub).toContainText("Publicação (Coolify)");
        await expect(pub).toContainText("Por configurar");
        await expect(webhook).toHaveValue("");
        await expect(save).toBeDisabled();
        await expect(test_).toBeDisabled(); // sem app configurada
        await expect(dialog.getByTestId("publish-current")).toHaveCount(0);
        // A API de e2e não tem COOLIFY_DEPLOY_TOKEN.
        await expect(dialog.getByTestId("publish-no-token")).toContainText("COOLIFY_DEPLOY_TOKEN");

        // Inválido: a mensagem da API (não uma genérica) e nada fica configurado.
        await webhook.fill("https://example.com/isto-nao-e-um-webhook");
        await expect(save).toBeEnabled();
        await save.click();
        const err = dialog.getByRole("alert").filter({ hasText: "webhook de deploy do Coolify" });
        await expect(err).toBeVisible();
        await expect(err).toContainText("/api/v1/deploy?uuid=");
        await expect(dialog.getByTestId("publish-current")).toHaveCount(0);
        await expect(pub).toContainText("Por configurar");
        // Parâmetro estranho: outra mensagem da API.
        await webhook.fill(`${WEBHOOK("abcd1234")}&token=segredo`);
        await save.click();
        await expect(dialog.getByRole("alert").filter({ hasText: 'parâmetro que não esperamos ("token")' })).toBeVisible();
        // Escrever limpa o erro.
        await webhook.fill(WEBHOOK("abcd1234", true));
        await expect(dialog.getByRole("alert").filter({ hasText: "parâmetro" })).toHaveCount(0);

        // Válido: guarda só a app e o force; o campo esvazia e passa a «Trocar o webhook».
        await save.click();
        await expect(support.getByText("Webhook guardado")).toBeVisible();
        const current = dialog.getByTestId("publish-current");
        await expect(current).toContainText("abcd1234");
        await expect(current).toContainText("build sem cache");
        await expect(webhook).toHaveValue("");
        await expect(dialog.getByLabel("Trocar o webhook do Coolify")).toBeVisible();
        await expect(save).toBeDisabled();
        await expect(test_).toBeEnabled();
        await expect(off).toBeVisible();
        // O webhook (com o uuid completo e o endereço) nunca volta no ecrã além do uuid.
        await expect(dialog).not.toContainText("coolify.exemplo.pt");

        // Persiste ao reabrir.
        await sp.closeSettings();
        dialog = await sp.openSettings();
        await expect(dialog.getByTestId("publish-current")).toContainText("abcd1234");

        // Trocar (force=false → sem «build sem cache»).
        await dialog.getByTestId("publish-webhook").fill(WEBHOOK("zzzz9999"));
        await expect(dialog.getByTestId("publish-test")).toBeDisabled(); // «Guarda o webhook antes de testar.»
        await dialog.getByTestId("publish-save").click();
        await expect(dialog.getByTestId("publish-current")).toContainText("zzzz9999");
        await expect(dialog.getByTestId("publish-current")).not.toContainText("build sem cache");

        // Testar: sem token na API a verificação «Token» falha e nada mais corre (nunca toca no Coolify).
        await dialog.getByTestId("publish-test").click();
        const result = dialog.getByTestId("publish-test-result");
        await expect(result).toContainText("A ligação não está completa.");
        await expect(result).toContainText("Token:");
        await expect(result).toContainText("✗");
        await expect(result).not.toContainText("Coolify:");
        // Sem scroll horizontal.
        expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);

        // Desligar volta a «Por configurar».
        await dialog.getByTestId("publish-off").click();
        await expect(support.getByText("Publicação desligada")).toBeVisible();
        await expect(dialog.getByTestId("publish-current")).toHaveCount(0);
        await expect(dialog.getByTestId("publish-off")).toHaveCount(0);
        await expect(dialog.getByTestId("publish-test")).toBeDisabled();
        await expect(dialog.getByTestId("publish-section")).toContainText("Por configurar");
        await expect(dialog.getByTestId("publish-test-result")).toHaveCount(0);
      } finally {
        // Repõe «por configurar» mesmo se o teste falhou a meio.
        if (headers) {
          const res = await request.put(`${API}/cms/site-builder/support/publish`, { headers, data: { webhookUrl: null } });
          expect(res.ok(), `repor a publicação: ${res.status()}`).toBeTruthy();
        }
        await support.close();
      }
    });

    test("barra de publicação: em fila, a construir, a confirmar (com %), falhou, no ar — e sobrevive ao refresh", async ({ page, context }) => {
      const p = new PaginasPage(page, context, OWNER);
      await p.open();
      const forced = await forcePublish(page);
      const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
      const progress = bar(page).getByRole("progressbar", { name: "Progresso da publicação" });

      // Sem deploy (modo coolify, parado e no ar): nenhuma barra ao abrir.
      forced.pub = base({ status: "live", liveAt: ago(60_000) });
      await p.reload();
      await expect(p.status).toContainText(/No ar/);
      await expect(bar(page)).toHaveCount(0);

      // Em fila (pending): barra indeterminada, sem percentagem.
      forced.pub = base({ status: "pending" });
      await p.reload();
      await expect(bar(page)).toHaveAttribute("data-kind", "progress");
      await expect(bar(page)).toContainText("Em fila…");
      await expect(bar(page)).not.toContainText("%");
      await expect(progress).toBeVisible();
      await expect(progress).not.toHaveAttribute("aria-valuenow", /.*/);
      await expect(p.status).toContainText("A publicar no site…");
      // «Publicar agora» está lá (dono) mas desligado enquanto há deploy.
      await expect(page.getByRole("button", { name: "Publicar agora" })).toBeDisabled();

      // A construir, com percentagem estimada (30 s de 60 s ≈ 50 %).
      forced.pub = base({ status: "running", phase: "building", startedAt: ago(30_000), estimatedMs: 60_000 });
      await p.reload();
      await expect(bar(page)).toContainText("A construir o site…");
      const pct = bar(page).locator("span.tabular-nums");
      await expect(pct).toHaveText(/^(4[5-9]|5\d|6\d)%$/);
      const now = Number(await progress.getAttribute("aria-valuenow"));
      expect(now).toBeGreaterThanOrEqual(45);
      expect(now).toBeLessThanOrEqual(69);

      // Fila dentro de um deploy (running/queued) e a confirmar; a percentagem nunca passa de 95 %.
      forced.pub = base({ status: "running", phase: "queued", startedAt: ago(5_000), estimatedMs: 60_000 });
      await p.reload();
      await expect(bar(page)).toContainText("Em fila…");
      forced.pub = base({ status: "running", phase: "confirming", startedAt: ago(10 * 60_000), estimatedMs: 60_000 });
      await p.reload();
      await expect(bar(page)).toContainText("A confirmar…");
      await expect(bar(page).locator("span.tabular-nums")).toHaveText("95%");
      // Largura: o texto e a % cabem sem scroll horizontal da página.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

      // Passa a «No ar» enquanto a página está aberta (o editor repete a leitura a cada 5 s): «Site actualizado · hh:mm».
      forced.pub = base({ status: "live", liveAt: new Date().toISOString() });
      await expect(bar(page)).toHaveAttribute("data-kind", "live", { timeout: 20_000 });
      await expect(bar(page)).toContainText(/Site actualizado · \d{2}:\d{2}/);
      await expect(p.status).toContainText(/No ar · \d{2}:\d{2}/);
      // Fecha-se no ×.
      await bar(page).getByRole("button", { name: "Fechar" }).click();
      await expect(bar(page)).toHaveCount(0);

      // Falhou: motivo em alerta na barra (a linha de estado só diz "Falhou a publicação"); sobrevive ao refresh e não tem ×.
      forced.pub = base({ status: "failed", error: "O build falhou: npm ERR! exit code 1" });
      await p.reload();
      await expect(bar(page)).toHaveAttribute("data-kind", "failed");
      await expect(bar(page)).toHaveAttribute("role", "alert");
      await expect(bar(page)).toContainText("Falhou: O build falhou: npm ERR! exit code 1");
      await expect(bar(page).getByRole("progressbar")).toHaveCount(0);
      await expect(bar(page).getByRole("button", { name: "Fechar" })).toHaveCount(0);
      await expect(p.status).toContainText("Falhou a publicação");
      await p.reload();
      await expect(bar(page)).toContainText("Falhou: O build falhou: npm ERR! exit code 1");
      // «Publicar agora» fica activo para repetir.
      await expect(page.getByRole("button", { name: "Publicar agora" })).toBeEnabled();

      // Modo runtime: não há deploy, logo não há barra nem «Publicar agora».
      forced.pub = base({ mode: "runtime", status: "idle" });
      await p.reload();
      await expect(bar(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Publicar agora" })).toHaveCount(0);
    });

    for (const [label, email] of [
      ["só «ver»", MEMBER_VER],
      ["«editar rascunho» sem publicar", MEMBER_RASCUNHO],
    ] as const) {
      test(`membro ${label}: vê a barra, sem Definições do site nem «Publicar agora»; a API recusa-lhe settings e publish`, async ({ page, context, request }) => {
        await ensureOwnerHome(request);
        const p = new PaginasPage(page, context, email);
        await p.open();
        const forced = await forcePublish(page);
        forced.pub = base({ status: "running", phase: "building", startedAt: new Date(Date.now() - 20_000).toISOString(), estimatedMs: 60_000 });
        await p.reload();
        await expect(bar(page)).toContainText("A construir o site…");
        await expect(page.getByRole("button", { name: "Definições do site" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Publicar agora" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /^Importar$/ })).toHaveCount(0);

        const { headers } = await apiLogin(request, email);
        const settings = await request.put(`${API}/cms/site-builder/settings`, { headers, data: { siteName: "Não devia gravar" } });
        expect(settings.status(), "PUT /settings sem paginas.publicar").toBe(403);
        const publish = await request.post(`${API}/cms/site-builder/publish`, { headers });
        expect(publish.status(), "POST /publish sem paginas.publicar").toBe(403);
        const cfg = await request.put(`${API}/cms/site-builder/support/publish`, { headers, data: { webhookUrl: WEBHOOK("abcd1234") } });
        expect(cfg.status(), "PUT /support/publish de um membro").toBe(403);
      });
    }

    test("membro com «Publicar e definições»: tem Definições do site e «Publicar agora» (no modo Coolify), mas não as secções de suporte", async ({ page, context, request }) => {
      await ensureOwnerHome(request);
      const p = new PaginasPage(page, context, MEMBER_PUBLICA);
      await p.open();
      const forced = await forcePublish(page);
      forced.pub = base({ status: "failed", error: "Falhou de propósito" });
      await p.reload();
      await expect(bar(page)).toContainText("Falhou: Falhou de propósito");
      await expect(page.getByRole("button", { name: "Publicar agora" })).toBeEnabled();
      const dialog = await p.openSettings();
      await expect(dialog.getByTestId("share-image-section")).toBeVisible();
      await expect(dialog.getByTestId("import-section")).toHaveCount(0);
      await expect(dialog.getByTestId("publish-section")).toHaveCount(0);
      await expect(dialog.getByTestId("share-image-save")).toBeDisabled(); // sem alterações
    });
  });
}


