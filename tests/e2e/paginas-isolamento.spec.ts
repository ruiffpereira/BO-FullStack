import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { API, E2E_PASSWORD, nextClientIp } from "./fixtures/login";
import { PaginasPage, VIEWPORTS, uniq } from "./pages/PaginasPage";

/**
 * Isolamento multi-tenant do construtor de páginas (B38): o tenant A (`pages@e2e`) nunca vê páginas,
 * blocos nem textos do tenant B (`pagesB@e2e`) — e vice-versa — na lista, nas paletas, no «SEO do site»
 * e na resposta da API; e na fronteira da API A não consegue apagar, usar nem reescrever recursos do B
 * (404/422, sem 5xx), ficando o B intacto. Os dados do B criam-se pela API (rápido); o que se prova é a
 * UI do A (e do B) e a fronteira.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const B_USER = "pagesB@e2e";

async function tokenOf(request: APIRequestContext, username: string): Promise<string> {
  const res = await request.post(`${API}/users/login`, {
    data: { username, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${username}`).toBeTruthy();
  return (await res.json()).accessToken as string;
}

interface Seeded {
  tag: string;
  pageId: string;
  blockId: string;
  pageTitle: string;
  blockName: string;
  secret: string;
}

/** Cria no tenant B (pela API, com o token do B) uma página, um bloco com texto e o item que os liga. */
async function seedTenantB(request: APIRequestContext): Promise<Seeded & { headers: { Authorization: string } }> {
  const headers = { Authorization: `Bearer ${await tokenOf(request, B_USER)}` };
  const state = await (await request.get(`${API}/cms/site-builder`, { headers })).json();
  const tag = uniq();
  const s: Seeded = {
    tag,
    pageId: randomUUID(),
    blockId: randomUUID(),
    pageTitle: `PaginaB-${tag}`,
    blockName: `BlocoB-${tag}`,
    secret: `Segredo-${tag}`,
  };
  const noHome = (state.pages as unknown[]).length === 0;
  const homeId = randomUUID();
  const page = (id: string, home: boolean, slug: string, title: string) => ({
    id, parentId: null, isHome: home, slug, slugs: null, title: { pt: title, en: title }, status: "draft", seo: null,
  });
  const res = await request.post(`${API}/cms/site-builder/save`, {
    headers,
    data: {
      baseRevision: state.revision,
      pages: { upsert: [...(noHome ? [page(homeId, true, "", "Início B")] : []), page(s.pageId, false, `pb-${tag}`, s.pageTitle)] },
      blocks: {
        upsert: [
          {
            id: s.blockId, name: s.blockName, folderId: null, layout: 1, bg: "claro", anchor: null,
            comps: [{ id: `c_${tag}`, type: "titulo", style: "destaque", col: "all", v: { text: { pt: s.secret, en: s.secret }, level: "h2", align: "left" } }],
          },
        ],
      },
      items: { [s.pageId]: [{ id: randomUUID(), kind: "block", blockId: s.blockId, specialType: null, specialData: null, hidden: false }] },
    },
  });
  expect(res.status(), `gravar os dados do B: ${await res.text()}`).toBe(200);
  return { ...s, headers };
}

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · isolamento — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("o tenant A não vê páginas, blocos nem textos do B (lista, paletas, SEO do site) — e o B não vê os do A", async ({ page, context, browser, request }) => {
      const b = await seedTenantB(request);
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const [pgA, blA] = [`IsoA-${u}`, `BlIsoA-${u}`];
      await p.createPage(pgA, `isoa-${u}`);
      await p.addStarter("Em branco");
      await p.openItem("Bloco novo");
      await p.renameBlock(blA);
      await p.backToPage();
      await p.save();
      await p.reload();

      // Lista: as páginas e os blocos do A estão lá; nada do B.
      await p.showList();
      await expect(p.pageRow(pgA)).toBeVisible();
      await expect(p.blockRow(blA)).toBeVisible();
      await expect(p.pageRow(b.pageTitle)).toHaveCount(0);
      await expect(p.blockRow(b.blockName)).toHaveCount(0);
      await expect(p.list).not.toContainText(b.tag);

      // Paletas: nem «Usar» nem «Copiar» oferecem o bloco do B; a procura de componentes não acha o texto dele.
      await p.openPage(pgA);
      await p.openBlockPalette();
      await p.paletteTab("Copiar um que já existe");
      await expect(p.dialog.getByRole("button", { name: new RegExp(blA) })).toBeVisible();
      await expect(p.dialog).not.toContainText(b.tag);
      await p.paletteTab("Usar um que já existe");
      await expect(p.dialog).not.toContainText(b.tag);
      await page.keyboard.press("Escape");
      await expect(p.dialog).toHaveCount(0);
      await p.openItem(blA);
      await page.getByRole("main").getByRole("button", { name: "Adicionar componente" }).click();
      await p.dialog.getByRole("tab", { name: "Copiar um que já existe" }).click();
      await p.dialog.getByRole("textbox", { name: "Procurar componente" }).fill(b.secret);
      await expect(p.dialog.getByText("Nenhum componente encontrado.")).toBeVisible();
      await expect(p.dialog).not.toContainText(b.tag);
      await page.keyboard.press("Escape");

      // «SEO do site»: só as páginas do A.
      await p.seoSiteBtn.click();
      await expect(p.dialog.getByRole("button", { name: new RegExp(pgA) })).toBeVisible();
      await expect(p.dialog).not.toContainText(b.tag);
      await page.keyboard.press("Escape");
      await expect(page.locator("body")).not.toContainText(b.tag);

      // Vice-versa: o B (outro browser, outra sessão) vê as suas páginas e nada do A.
      const ctxB = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      try {
        const pb = new PaginasPage(await ctxB.newPage(), ctxB, B_USER);
        await pb.open();
        await pb.showList();
        await expect(pb.pageRow(b.pageTitle)).toBeVisible();
        await expect(pb.blockRow(b.blockName)).toBeVisible();
        await expect(pb.pageRow(pgA)).toHaveCount(0);
        await expect(pb.blockRow(blA)).toHaveCount(0);
        await expect(pb.list).not.toContainText(u);
      } finally {
        await ctxB.close();
      }
    });
  });
}

test("fronteira da API: o A não lê, apaga, usa nem reescreve recursos do B (404/422) e o B fica intacto", async ({ request }) => {
  const b = await seedTenantB(request);
  const headersA = { Authorization: `Bearer ${await tokenOf(request, "pages@e2e")}` };
  const stateA = await (await request.get(`${API}/cms/site-builder`, { headers: headersA })).json();
  // O pedido do A nunca leva nada do B (nem o nome, nem o texto, nem os ids).
  const raw = JSON.stringify(stateA);
  for (const leak of [b.tag, b.pageId, b.blockId, b.secret]) expect(raw, `a resposta do A não pode conter "${leak}"`).not.toContain(leak);

  const save = (data: Record<string, unknown>) =>
    request.post(`${API}/cms/site-builder/save`, { headers: headersA, data: { baseRevision: stateA.revision, ...data } });
  const homeId = randomUUID();
  const attempts: [string, Record<string, unknown>][] = [
    ["apagar a página do B", { pages: { delete: [b.pageId] } }],
    ["apagar o bloco do B", { blocks: { delete: [b.blockId] } }],
    [
      "usar o bloco do B numa página do A",
      {
        pages: { upsert: [{ id: homeId, parentId: null, isHome: false, slug: `x-${b.tag}`, slugs: null, title: { pt: "x", en: "x" }, status: "draft", seo: null }] },
        items: { [homeId]: [{ id: randomUUID(), kind: "block", blockId: b.blockId, specialType: null, specialData: null, hidden: false }] },
      },
    ],
    ["reescrever o bloco do B (mesmo id)", { blocks: { upsert: [{ id: b.blockId, name: "HackA", folderId: null, layout: 1, bg: "claro", anchor: null, comps: [] }] } }],
    ["pôr itens na página do B", { items: { [b.pageId]: [] } }],
    [
      "reescrever a página do B (mesmo id)",
      { pages: { upsert: [{ id: b.pageId, parentId: null, isHome: false, slug: "hack", slugs: null, title: { pt: "HackA", en: "HackA" }, status: "draft", seo: null }] } },
    ],
  ];
  for (const [what, data] of attempts) {
    const res = await save(data);
    expect([404, 422], `A a tentar ${what} → ${res.status()} ${await res.text()}`).toContain(res.status());
  }

  // O B continua com tudo como estava.
  const headersB = b.headers;
  const stateB = await (await request.get(`${API}/cms/site-builder`, { headers: headersB })).json();
  const blockB = (stateB.blocks as { id: string; name: string }[]).find((x) => x.id === b.blockId);
  expect(blockB?.name).toBe(b.blockName);
  const pageB = (stateB.pages as { id: string; title: { pt: string } }[]).find((x) => x.id === b.pageId);
  expect(pageB?.title.pt).toBe(b.pageTitle);
  expect(JSON.stringify(stateB)).not.toContain("HackA");
});

test.describe("Páginas · tenant sem manifest", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("sem manifest o BO avisa e não deixa criar blocos (nada de 422); as páginas sem blocos gravam", async ({ page, context }) => {
    // Sem manifest a API devolve backgrounds: [] e recusa qualquer bloco com 422 BAD_BG. O BO trata «sem fundos»
    // como «site ainda não configurado»: aviso claro, tudo o que criaria blocos/componentes fica desligado, e uma
    // página sem blocos (que não precisa de fundo) continua a poder criar-se e gravar.
    const bad: string[] = [];
    page.on("response", (r) => { if (r.status() === 422) bad.push(r.url()); });
    const p = new PaginasPage(page, context, "pagesbare@e2e");
    await p.open();
    const u = uniq();
    await p.createPage(`Bare-`, `bare-`);
    await expect(page.getByRole("status").filter({ hasText: "ainda não está configurado para o construtor" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "fale com o suporte" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("button", { name: "Adicionar bloco", exact: true })).toBeDisabled();
    await p.showList();
    await expect(page.getByRole("button", { name: "Novo bloco" })).toBeDisabled();
    // A página sem blocos grava.
    await expect(p.saveBtn).toBeEnabled();
    await p.save();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(bad, "nenhum pedido 422").toEqual([]);
  });
});
