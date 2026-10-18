import { test, expect, type Page, type Route } from "@playwright/test";
import { API } from "./fixtures/login";
import { apiLogin } from "./fixtures/support";
import { patchSiteBuilder } from "./fixtures/siteBuilderRoute";
import { solidPng } from "./fixtures/png";
import { PaginasPage, VIEWPORTS, uniq } from "./pages/PaginasPage";

/**
 * B38 · P3 — SEO social: imagem de partilha do site e cartão «Ao partilhar» de cada página.
 *
 * Honestidade sobre o que é real: a API de e2e não tem armazenamento de ficheiros (`SEAWEEDFS_*` vazio), logo recusa
 * qualquer `shareImage` (não é «do tenant») e `POST /uploads` dá 503. Por isso:
 *  - o upload (`POST /uploads`) devolve um URL falso (`https://e2e-media.test/…`) cujo conteúdo é um PNG gerado aqui,
 *    com a dimensão que o teste quer (o aviso de tamanho mede-se no browser);
 *  - o `PUT /cms/site-builder/settings` da imagem é simulado (o corpo que a UI envia é verificado à letra);
 *  - o `GET /cms/site-builder` leva por cima `shareImage`/`shareImageAlt` forjados (resto real).
 * A validação a sério (só media do tenant, línguas do site, 403 sem `paginas.publicar`) está nos testes da API; a
 * recusa de um membro sem essa acção está em `paginas-publicacao.spec.ts`.
 */

test.use({ storageState: { cookies: [], origins: [] } });

const OWNER = "pages@e2e";
const MEDIA = "https://e2e-media.test";

const SIZES: Record<string, [number, number]> = {
  "ideal.png": [1200, 630],
  "pequena.png": [300, 200],
  "quadrada.png": [900, 900],
};

/** Simula `POST /uploads` (devolve `fileUrl` com o nome do ficheiro) e serve os PNG de `e2e-media.test`. */
async function mockMedia(page: Page, opts: { uploadStatus?: number } = {}): Promise<void> {
  await page.route(/\/uploads$/, async (route: Route) => {
    if (route.request().method() !== "POST") return route.continue();
    if (opts.uploadStatus) return route.fulfill({ status: opts.uploadStatus, contentType: "application/json", body: JSON.stringify({ error: "Armazenamento indisponível" }) });
    const body = route.request().postDataBuffer()?.toString("latin1") ?? "";
    const name = /filename="([^"]+)"/.exec(body)?.[1] ?? "imagem.png";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ fileUrl: `${MEDIA}/tenant/${name}`, key: `tenant/${name}` }) });
  });
  await page.route(`${MEDIA}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    const [w, h] = SIZES[name] ?? SIZES["ideal.png"];
    return route.fulfill({ status: 200, contentType: "image/png", body: solidPng(w, h) });
  });
}

const file = (name: keyof typeof SIZES) => ({ name, mimeType: "image/png", buffer: solidPng(...SIZES[name]) });

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · SEO social — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("imagem de partilha do site: escolher sobe-a, avisos de tamanho, alt por língua, Facebook/X e Guardar", async ({ page, context, request }) => {
      await mockMedia(page);
      const p = new PaginasPage(page, context, OWNER);
      await p.open();
      const forced = await patchSiteBuilder(page);
      const saved: Record<string, unknown>[] = [];
      const { headers } = await apiLogin(request, OWNER);
      const revision = ((await (await request.get(`${API}/cms/site-builder`, { headers })).json()) as { revision: number }).revision;
      await page.route(/\/cms\/site-builder\/settings$/, async (route) => {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        saved.push(body);
        forced.patch = { shareImage: body.shareImage ?? null, shareImageAlt: body.shareImageAlt ?? null };
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ siteName: null, ...forced.patch, revision }) });
      });

      const dialog = await p.openSettings();
      const section = dialog.getByTestId("share-image-section");
      const save = dialog.getByTestId("share-image-save");
      const preview = section.getByTestId("share-preview");
      await expect(section).toBeVisible();
      await expect(section).toContainText("Ideal: 1200×630");
      await expect(preview).toContainText("Sem imagem: o cartão sai pequeno, só com texto.");
      await expect(section.getByRole("button", { name: "Escolher imagem" })).toBeVisible();
      await expect(section.getByRole("button", { name: "Tirar imagem" })).toHaveCount(0);
      await expect(save).toBeDisabled();
      const altPt = section.getByRole("textbox", { name: "Descrição da imagem (alt) · PT" });
      const altEn = section.getByRole("textbox", { name: "Descrição da imagem (alt) · EN" });
      await expect(altPt).toBeVisible();
      await expect(altEn).toBeVisible();

      // Escolher a imagem ideal: sobe, aparece no cartão e diz que o tamanho está bem.
      await section.getByTestId("share-image-file").setInputFiles(file("ideal.png"));
      await expect(section.getByRole("button", { name: "Trocar imagem" })).toBeVisible();
      const fb = preview.getByTestId("share-card-facebook");
      await expect(fb.locator("img")).toHaveAttribute("src", `${MEDIA}/tenant/ideal.png`);
      await expect(preview).toContainText("Imagem 1200×630 — bom tamanho para partilhar.");
      await expect(preview.getByTestId("share-size-warning")).toHaveCount(0);
      await expect(save).toBeEnabled();

      // Facebook ↔ X.
      await preview.getByRole("button", { name: "X", exact: true }).click();
      await expect(preview.getByTestId("share-card-x")).toBeVisible();
      await expect(preview.getByTestId("share-card-facebook")).toHaveCount(0);
      await expect(preview.getByTestId("share-card-x").locator("img")).toHaveAttribute("src", `${MEDIA}/tenant/ideal.png`);
      await preview.getByRole("button", { name: "Facebook" }).click();
      await expect(preview.getByTestId("share-card-facebook")).toBeVisible();

      // Pequena demais e fora do formato: aviso (nunca bloqueio).
      await section.getByTestId("share-image-file").setInputFiles(file("pequena.png"));
      await expect(preview.getByTestId("share-size-warning")).toContainText("300×200: é pequena demais para o cartão grande. Usa 1200×630.");
      await expect(save).toBeEnabled();
      await section.getByTestId("share-image-file").setInputFiles(file("quadrada.png"));
      await expect(preview.getByTestId("share-size-warning")).toContainText("900×900: vai ser cortada no cartão");
      await section.getByTestId("share-image-file").setInputFiles(file("ideal.png"));
      await expect(preview.getByTestId("share-size-warning")).toHaveCount(0);

      // Texto alternativo por língua (aparado) e Guardar: o corpo exacto que segue para a API.
      await altPt.fill("  Fachada do edifício  ");
      await altEn.fill("Building facade");
      await expect(preview.locator("img")).toHaveAttribute("alt", "  Fachada do edifício  ");
      await save.click();
      await expect(page.getByText("Imagem de partilha guardada")).toBeVisible();
      expect(saved).toHaveLength(1);
      expect(saved[0]).toEqual({
        shareImage: `${MEDIA}/tenant/ideal.png`,
        shareImageAlt: { pt: "Fachada do edifício", en: "Building facade" },
      });
      await expect(save).toBeDisabled(); // sem alterações depois de guardar
      await expect(altPt).toHaveValue("Fachada do edifício");

      // Persiste ao reabrir (vem do servidor).
      await p.closeSettings();
      const again = await p.openSettings();
      await expect(again.getByTestId("share-image-section").getByTestId("share-card-facebook").locator("img")).toHaveAttribute("src", `${MEDIA}/tenant/ideal.png`);
      await expect(again.getByRole("textbox", { name: "Descrição da imagem (alt) · EN" })).toHaveValue("Building facade");

      // Tirar a imagem: o cartão fica sem imagem e Guardar envia null.
      await again.getByRole("button", { name: "Tirar imagem" }).click();
      await expect(again.getByTestId("share-preview")).toContainText("Sem imagem: o cartão sai pequeno, só com texto.");
      await again.getByTestId("share-image-save").click();
      await expect(page.getByText("Imagem de partilha guardada").last()).toBeVisible();
      expect(saved[1]).toMatchObject({ shareImage: null });
      // Sem scroll horizontal no modal.
      expect(await again.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    });

    test("imagem de partilha do site: ficheiro que não é imagem e falha do upload mostram o erro", async ({ page, context }) => {
      await mockMedia(page);
      const p = new PaginasPage(page, context, OWNER);
      await p.open();
      const dialog = await p.openSettings();
      const section = dialog.getByTestId("share-image-section");

      await section.getByTestId("share-image-file").setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("olá") });
      await expect(section.getByRole("alert")).toContainText("Ficheiro não aceite. JPEG, PNG ou WebP.");
      await expect(dialog.getByTestId("share-image-save")).toBeDisabled();

      await page.unroute(/\/uploads$/);
      await mockMedia(page, { uploadStatus: 503 });
      await section.getByTestId("share-image-file").setInputFiles(file("ideal.png"));
      await expect(section.getByRole("alert")).toBeVisible();
      await expect(section.getByRole("alert")).not.toContainText("Ficheiro não aceite");
      await expect(section.getByRole("button", { name: "Escolher imagem" })).toBeVisible(); // nada ficou escolhido
      await expect(dialog.getByTestId("share-image-save")).toBeDisabled();
    });

    test("página: «Descrição da imagem (alt)» e «Ao partilhar» — imagem do site, imagem própria (aviso de tamanho) e sem imagem", async ({ page, context }) => {
      await mockMedia(page);
      const p = new PaginasPage(page, context, OWNER);
      await p.open();
      const forced = await patchSiteBuilder(page);
      forced.patch = { shareImage: `${MEDIA}/tenant/ideal.png`, shareImageAlt: { pt: "Alt do site", en: "Site alt" } };
      await p.reload();

      const title = `Social-${uniq()}`;
      await p.createPage(title);
      await p.openTab("Definições e SEO");
      const alt = page.getByRole("textbox", { name: /Descrição da imagem \(alt\)/ });
      await expect(alt.first()).toBeVisible();
      await expect(page.getByText("Descreve a imagem para quem não a vê (leitores de ecrã).")).toBeVisible();
      await expect(page.getByText("Ideal: 1200×630. Sem imagem, usa a imagem de partilha do site (Definições do site).")).toBeVisible();

      // Sem imagem própria → a do site, com o alt do site na língua do cartão.
      const preview = page.getByTestId("share-preview");
      await preview.scrollIntoViewIfNeeded();
      await expect(preview).toContainText("Esta página não tem imagem própria: usa a imagem de partilha do site.");
      await expect(preview.getByTestId("share-card-facebook").locator("img")).toHaveAttribute("src", `${MEDIA}/tenant/ideal.png`);
      await expect(preview.locator("img")).toHaveAttribute("alt", "Alt do site");
      await expect(preview).toContainText("Imagem 1200×630 — bom tamanho para partilhar.");
      await expect(preview.getByTestId("share-size-warning")).toHaveCount(0);
      // Língua da pré-visualização: EN → alt do site em inglês.
      await page.getByRole("group", { name: "Língua da pré-visualização" }).getByRole("button", { name: "EN", exact: true }).click();
      await expect(preview.locator("img")).toHaveAttribute("alt", "Site alt");
      await page.getByRole("group", { name: "Língua da pré-visualização" }).getByRole("button", { name: "PT", exact: true }).click();

      // Imagem própria pequena: substitui a do site, o aviso aparece e o alt é o da página.
      await page.getByRole("group", { name: "Imagem ao partilhar" }).getByLabel("Ficheiro de Imagem ao partilhar").setInputFiles(file("pequena.png"));
      await expect(preview).not.toContainText("usa a imagem de partilha do site");
      await expect(preview.getByTestId("share-size-warning")).toContainText("300×200: é pequena demais");
      await alt.first().fill("Alt desta página");
      await expect(preview.locator("img")).toHaveAttribute("alt", "Alt desta página");
      await expect(preview.getByTestId("share-card-facebook").locator("img")).toHaveAttribute("src", /^blob:/);
      await preview.getByRole("button", { name: "X", exact: true }).click();
      await expect(preview.getByTestId("share-card-x")).toBeVisible();

      // Remover a própria volta à do site.
      await page.getByRole("button", { name: "Remover imagem" }).click();
      await expect(preview).toContainText("usa a imagem de partilha do site");
      await expect(preview.getByTestId("share-size-warning")).toHaveCount(0);

      // O site deixa de ter imagem → cartão sem imagem (a página grava-se e recarrega-se, as definições vêm do servidor).
      await alt.first().fill("");
      await p.save();
      forced.patch = { shareImage: null, shareImageAlt: null };
      await p.reload();
      await p.openPage(title);
      await p.openTab("Definições e SEO");
      await expect(preview).toContainText("Sem imagem: o cartão sai pequeno, só com texto.");
      await expect(preview).not.toContainText("usa a imagem de partilha do site");
      // Sem scroll horizontal da página.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  });
}
