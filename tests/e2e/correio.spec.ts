import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { loginAs, nextClientIp, API, E2E_PASSWORD } from "./fixtures/login";

/**
 * Correio → Caixa (B42 · fases 5 e 6), nas 3 larguras (1440 / 834 / 390).
 *
 * A API do e2e corre com `ENVIRONMENT=TEST`: o fornecedor da caixa é o SIMULADOR em memória
 * (`API-FullStack/src/mail/index.ts` → `MemoryMailbox` quando `config.isTest`) e o dos domínios também — nada fala com o
 * Stalwart nem com o Resend. Um email enviado para fora aparece na pasta Enviados da própria caixa, por isso o fluxo
 * (escrever → abrir → responder) não precisa de correio de entrada.
 *
 * ⚠ DEPENDE DO SEED (`API-FullStack/scripts/seedE2e.ts`), que hoje NÃO tem o módulo Correio. Para este spec correr:
 *   1. acrescentar `"VIEW_EMAIL"` ao array `COMPONENTS` (a role Admin liga-se-lhe sozinha);
 *   2. um tenant `correio@e2e` (Users.name) / `correio@e2e.local`, não-admin, com a permissão {VIEW_EMAIL, VIEW_CUSTOMERS},
 *      um `Customer` de nome "Cliente Correio" com email `cliente.correio@example.com`;
 *   3. um membro activo desse tenant, `correio.ver@e2e.local` (password E2ePass123!), com os grants
 *      `correio.caixa` view + `clientes.lista` view (e NADA de edit).
 * O resto (domínio de email + caixa do negócio) provisiona-se aqui por API, como o Admin faria.
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const DONO = "correio@e2e.local";
const RUN = Date.now().toString(36);
const MEMBRO_VER = "correio.ver@e2e.local";
const SEM_MODULO = "limited@e2e";
const ADMIN = "admin@e2e.local";
const CLIENTE_NOME = "Cliente Correio";
const CLIENTE_EMAIL = "cliente.correio@example.com";

const SIZES = [
  { w: 1440, h: 900 },
  { w: 834, h: 1112 },
  { w: 390, h: 844 },
];

type Login = { userId: string; accessToken: string };

async function apiLogin(username: string): Promise<Login> {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/users/login`, {
    data: { username, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${username} (${res.status()})`).toBeTruthy();
  const body = await res.json();
  await ctx.dispose();
  return { userId: body.userId, accessToken: body.accessToken };
}

/** O que o Admin faria: domínio de email do negócio + caixa do negócio (ambos idempotentes). */
test.beforeAll(async () => {
  const admin = await apiLogin(ADMIN);
  const dono = await apiLogin(DONO);
  const ctx = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${admin.accessToken}` } });
  const dom = await ctx.put(`${API}/admin/users/${dono.userId}/email-domain`, { data: { domain: "correio-e2e.example.pt" } });
  expect([200, 201, 409]).toContain(dom.status());
  const box = await ctx.post(`${API}/admin/users/${dono.userId}/mailboxes/business`, { data: {} });
  expect([200, 201], `caixa do negócio (${box.status()})`).toContain(box.status());
  await ctx.dispose();
});

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const { w, h } of SIZES) {
  test.describe(`Correio — Caixa (${w}px)`, () => {
    test.use({ viewport: { width: w, height: h } });
    // Único por corrida: a caixa (Stalwart) não é reposta pelo seed, e um assunto repetido deixaria duas linhas («Re: …» da corrida anterior).
    const assunto = `Horários de verão ${w} ${RUN}`;

    test("sem o módulo não há «Correio» na sidebar e o URL directo redirecciona", async ({ page, context }) => {
      await loginAs(context, SEM_MODULO);
      await page.goto("/correio");
      await expect(page).not.toHaveURL(/\/correio/, { timeout: 10_000 });
      await expect(page.locator("nav").getByRole("button", { name: /^Correio/ })).toHaveCount(0);
    });

    test("o dono abre a Caixa, escreve um email e vê-o nos Enviados", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/correio");
      await expect(page.getByTestId("mail-split")).toBeVisible({ timeout: 15_000 });
      for (const pasta of ["Entrada", "Arquivo", "Enviados"]) {
        await expect(page.getByRole("tab", { name: new RegExp(pasta) })).toBeVisible();
      }

      await page.getByRole("button", { name: "Novo email" }).click();
      const dialog = page.getByRole("dialog", { name: "Novo email" });
      // Destinatário obrigatório: sem ele não segue e diz porquê.
      await dialog.getByLabel("Mensagem").fill("Olá!");
      await dialog.getByRole("button", { name: "Enviar" }).click();
      await expect(dialog.getByRole("alert")).toContainText("destinatário");

      await dialog.getByLabel("Para").fill(CLIENTE_EMAIL);
      await dialog.getByLabel("Assunto").fill(assunto);
      await dialog.getByLabel("Mensagem").fill("Abrimos das 9h às 20h durante o verão.");
      await dialog.getByRole("button", { name: "Enviar" }).click();
      await expect(page.getByText("Email enviado.")).toBeVisible({ timeout: 15_000 });

      await page.getByRole("tab", { name: "Enviados" }).click();
      const linha = page.getByTestId("mail-thread-row").filter({ hasText: assunto });
      await expect(linha).toBeVisible({ timeout: 10_000 });
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("abrir a conversa e responder (no telemóvel: lista → conversa em ecrãs separados)", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/correio?pasta=sent");
      const linha = page.getByTestId("mail-thread-row").filter({ hasText: assunto });
      await expect(linha).toBeVisible({ timeout: 15_000 });
      await linha.click();

      await expect(page.getByTestId("mail-thread-subject")).toHaveText(assunto);
      await expect(page.getByTestId("mail-message").first()).toContainText("Abrimos das 9h");
      // O HTML recebido (se houver) nunca corre scripts.
      for (const frame of await page.getByTestId("mail-html-frame").all()) {
        expect((await frame.getAttribute("sandbox")) ?? "").not.toContain("allow-scripts");
      }
      if (w < 1024) {
        // Ecrãs separados: a lista some enquanto a conversa está aberta, e «Voltar» traz a lista de volta.
        await expect(page.getByTestId("mail-thread-row").first()).toBeHidden();
        await page.getByRole("button", { name: "Voltar" }).click();
        await expect(page.getByTestId("mail-thread-row").first()).toBeVisible();
        await page.getByTestId("mail-thread-row").filter({ hasText: assunto }).click();
      }

      await page.getByRole("button", { name: "Responder", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Responder" });
      await dialog.getByLabel("Mensagem").fill("Obrigado, até breve!");
      await dialog.getByRole("button", { name: "Enviar" }).click();
      await expect(page.getByText("Email enviado.")).toBeVisible({ timeout: 15_000 });
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("ficha do cliente → separador Emails leva à conversa na Caixa", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.goto("/clientes");
      await page.getByText(CLIENTE_NOME, { exact: false }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("tab", { name: "Emails" }).click();
      const linha = dialog.getByTestId("mail-thread-row").filter({ hasText: assunto });
      await expect(linha).toBeVisible({ timeout: 10_000 });
      await linha.click();
      await expect(page).toHaveURL(/\/correio\?.*conversa=/);
      await expect(page.getByTestId("mail-thread-subject")).toHaveText(assunto, { timeout: 10_000 });
    });

    test("membro só com «Ver»: lê a conversa mas não responde, não arquiva nem marca", async ({ page, context }) => {
      await loginAs(context, MEMBRO_VER);
      await page.goto("/correio?pasta=sent");
      await expect(page.getByTestId("mail-split")).toBeVisible({ timeout: 15_000 });
      // B55: se a reconciliação já deu a este membro a caixa pessoal (que abre primeiro e é sempre dele), este teste é do `suporte@`
      // (correio.caixa só Ver): escolhe-se essa caixa. A caixa pessoal tem o seu spec em `correio-caixas.spec.ts`.
      const selector = page.getByRole("combobox", { name: "Caixa" });
      if (await selector.count()) {
        const suporte = (await selector.locator("option").allTextContents()).find((t) => t.startsWith("Suporte · "));
        expect(suporte, "o selector tem a caixa «Suporte · …»").toBeTruthy();
        await selector.selectOption({ label: suporte! });
      }
      const linha = page.getByTestId("mail-thread-row").filter({ hasText: assunto });
      await expect(linha).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Novo email" })).toBeDisabled();
      await linha.click();

      await expect(page.getByTestId("mail-message").first()).toContainText("Abrimos das 9h");
      for (const name of ["Responder", "Responder a todos", "Encaminhar", "Arquivar", "Fixar", "Marcar como não lido"]) {
        const btn = page.getByRole("button", { name, exact: true });
        await expect(btn).toBeDisabled();
        await expect(btn.locator("xpath=..")).toHaveAttribute("title", "Só tens permissão para ver");
      }
    });
  });
}

/**
 * B56 — Entrada única, filtro Todas / Por ler / Lidas, conversas fixadas (CR-26), ler limpa o aviso do sino (CR-27), nas 3 larguras.
 *
 * Dados: a caixa do admin envia três emails para a `suporte@` do dono (entrega entre caixas do simulador): «Alfa» e
 * «Beta» ficam por ler, «Gama» (o mais recente) é lido por API. Cada largura tem os seus assuntos (únicos por corrida).
 *
 * CR-27 (o sino): NÃO está aqui. O aviso `type: email` nasce no `mailPoll` (cron JMAP a cada minuto, `startMailPollJob`), que só
 * arranca com o Stalwart configurado — no e2e (simulador) nunca corre — e o `data.mailboxId`/`threadId` do aviso são dinâmicos
 * (o simulador vive no processo da API), por isso o seed não o consegue criar de forma fiável. Fica provado em `mailInbox.test.ts`
 * (API); o efeito no Backoffice (invalidação do sino depois de ler) só se vê com um aviso real.
 */
type Row = { threadId: string; subject: string; unread: boolean; pinned?: boolean };

async function donoApi() {
  const { accessToken } = await apiLogin(DONO);
  const api = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` } });
  const boxes = ((await (await api.get(`${API}/mail/mailboxes`)).json()).mailboxes ?? []) as { mailboxId: string; address: string; kind: string }[];
  const suporte = boxes.find((b) => b.kind === "business");
  expect(suporte, "o dono tem a caixa suporte@").toBeTruthy();
  const threads = async (folder: string, q: string): Promise<Row[]> => {
    const r = await api.get(`${API}/mail/mailboxes/${suporte!.mailboxId}/threads`, { params: { folder, q, limit: 50 } });
    expect(r.ok(), `GET threads (${r.status()})`).toBeTruthy();
    return (await r.json()).items as Row[];
  };
  const act = async (threadId: string, op: "read" | "pin" | "unpin" | "unarchive") => {
    const r = await api.post(`${API}/mail/mailboxes/${suporte!.mailboxId}/threads/${threadId}/${op}`, { data: {} });
    expect(r.ok(), `${op} (${r.status()})`).toBeTruthy();
  };
  return { api, suporte: suporte!, threads, act };
}

for (const { w, h } of SIZES) {
  test.describe(`Correio — Entrada, filtro e fixadas (${w}px)`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: w < 1440 });
    const ALFA = `Alfa ${w} ${RUN}`;
    const BETA = `Beta ${w} ${RUN}`;
    const GAMA = `Gama ${w} ${RUN}`;
    const tag = `${w} ${RUN}`;

    test.beforeAll(async () => {
      test.setTimeout(90_000);
      const d = await donoApi();
      // Enviar para a própria caixa não entrega (o remetente sai dos destinatários): escreve a caixa do admin (a pessoal
      // `primeiro.último@`, que nasce a pedido — como em `correio-caixas.spec.ts`) para o endereço `suporte@` do dono.
      const adminLogin = await apiLogin(ADMIN);
      const admin = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${adminLogin.accessToken}` } });
      const me = await admin.put(`${API}/users/me`, { data: { ownerName: "Ada Mestre" } });
      expect(me.ok(), `PUT /users/me ownerName (${me.status()})`).toBeTruthy();
      let adminBox: { mailboxId: string } | undefined;
      const tb = Date.now();
      while (!adminBox) {
        const l = ((await (await admin.get(`${API}/mail/mailboxes`)).json()).mailboxes ?? []) as { mailboxId: string }[];
        adminBox = l[0];
        if (!adminBox) {
          if (Date.now() - tb > 30_000) throw new Error("a caixa do admin não nasceu");
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      for (const subject of [ALFA, BETA, GAMA]) {
        const r = await admin.post(`${API}/mail/mailboxes/${adminBox.mailboxId}/send`, {
          data: { mode: "new", to: [d.suporte.address], subject, text: `Corpo de ${subject}` },
        });
        expect(r.status(), `enviar «${subject}» (${await r.text()})`).toBe(201);
      }
      await admin.dispose();
      const t0 = Date.now();
      let gama: Row | undefined;
      for (;;) {
        const rows = await d.threads("all", tag);
        gama = rows.find((x) => x.subject === GAMA);
        if (rows.length >= 3 && gama) break;
        if (Date.now() - t0 > 30_000) throw new Error("os 3 emails não chegaram à Entrada");
        await new Promise((r) => setTimeout(r, 500));
      }
      await d.act(gama.threadId, "read");
      await d.api.dispose();
    });

    /** Abre a Caixa `suporte@` do dono (escolhe-a no selector se a pessoal também existir). */
    async function abrir(page: Page, qs = "") {
      await page.goto(`/correio${qs}`);
      await expect(page.getByTestId("mail-split")).toBeVisible({ timeout: 15_000 });
      const selector = page.getByRole("combobox", { name: "Caixa" });
      if (await selector.count()) {
        const label = (await selector.locator("option").allTextContents()).find((t) => t.startsWith("Suporte · "))!;
        await selector.selectOption({ label });
      }
    }
    const li = (page: Page, subject: string) => page.locator("li[data-pinned]").filter({ hasText: subject });
    const filtro = (page: Page) => page.getByRole("combobox", { name: "Filtrar conversas" });
    /** Ordem (de cima para baixo) das nossas conversas desta largura na lista. */
    const ordem = async (page: Page) => {
      const texts = await page.locator("li[data-pinned]").allTextContents();
      return [ALFA, BETA, GAMA]
        .map((s) => ({ s, i: texts.findIndex((t) => t.includes(s)) }))
        .filter((x) => x.i >= 0)
        .sort((a, b) => a.i - b.i)
        .map((x) => x.s);
    };

    test("CR-26: três pastas (sem «Por ler») e o filtro só na Entrada e no Arquivo", async ({ page, context }) => {
      await loginAs(context, DONO);
      await abrir(page);
      for (const pasta of ["Entrada", "Arquivo", "Enviados"]) await expect(page.getByRole("tab", { name: new RegExp(pasta) })).toBeVisible();
      await expect(page.getByRole("tab")).toHaveCount(3);
      await expect(page.getByRole("tab", { name: /Por ler/ })).toHaveCount(0);

      await expect(filtro(page)).toBeVisible();
      await expect(filtro(page)).toHaveValue("all");
      await expect(filtro(page).locator("option")).toHaveText(["Todas", "Por ler", "Lidas"]);
      await page.getByRole("tab", { name: /Arquivo/ }).click();
      await expect(filtro(page)).toBeVisible();
      await page.getByRole("tab", { name: "Enviados" }).click();
      await expect(filtro(page)).toHaveCount(0);
      await page.getByRole("tab", { name: /Entrada/ }).click();
      await expect(filtro(page)).toBeVisible();
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("CR-26: filtro Todas / Por ler / Lidas na Entrada (por ler = alguma mensagem por ler)", async ({ page, context }) => {
      await loginAs(context, DONO);
      await abrir(page);
      await expect(li(page, GAMA)).toBeVisible({ timeout: 15_000 });
      for (const s of [ALFA, BETA, GAMA]) await expect(li(page, s)).toBeVisible();

      await filtro(page).selectOption("unread");
      await expect(page).toHaveURL(/filtro=por-ler/);
      await expect(li(page, ALFA)).toBeVisible();
      await expect(li(page, BETA)).toBeVisible();
      await expect(li(page, GAMA)).toHaveCount(0);
      for (const row of await page.getByTestId("mail-thread-row").all()) await expect(row).toHaveAttribute("data-unread", "true");

      await filtro(page).selectOption("read");
      await expect(page).toHaveURL(/filtro=lidas/);
      await expect(li(page, GAMA)).toBeVisible();
      await expect(li(page, ALFA)).toHaveCount(0);
      await expect(li(page, BETA)).toHaveCount(0);

      await filtro(page).selectOption("all");
      await expect(li(page, ALFA)).toBeVisible();
      await expect(li(page, GAMA)).toBeVisible();

      // Combina com a pesquisa.
      await filtro(page).selectOption("unread");
      await page.getByRole("textbox", { name: "Pesquisar no correio" }).fill(ALFA);
      await expect(li(page, ALFA)).toBeVisible();
      await expect(li(page, BETA)).toHaveCount(0);
      // Trocar para Enviados deixa o filtro de lado (nos Enviados não há «por ler»).
      await page.getByRole("tab", { name: "Enviados" }).click();
      await expect(page).not.toHaveURL(/filtro=/);
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("CR-26: ?pasta=unread (link antigo) abre a Entrada com «Por ler»", async ({ page, context }) => {
      await loginAs(context, DONO);
      await abrir(page, "?pasta=unread");
      await expect(page.getByRole("tab", { name: /Entrada/ })).toHaveAttribute("aria-selected", "true");
      await expect(filtro(page)).toHaveValue("unread");
      await expect(li(page, ALFA)).toBeVisible({ timeout: 15_000 });
      await expect(li(page, GAMA)).toHaveCount(0);
    });

    test("CR-26: o pin está sempre visível no táctil e a 390; no computador só aparece no hover/foco", async ({ page, context }) => {
      await loginAs(context, DONO);
      await abrir(page);
      const row = li(page, BETA);
      const pin = row.getByTestId("mail-pin");
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(pin).toHaveAttribute("aria-label", "Fixar conversa");
      await expect(pin).toHaveAttribute("aria-pressed", "false");
      if (w === 1440) {
        await page.mouse.move(0, 0);
        await expect(pin).toHaveCSS("opacity", "0");
        await row.hover();
        await expect(pin).toHaveCSS("opacity", "1");
        await page.mouse.move(0, 0);
        await expect(pin).toHaveCSS("opacity", "0");
        await row.getByTestId("mail-thread-row").focus();
        await expect(pin).toHaveCSS("opacity", "1"); // foco dentro da linha também mostra
      } else {
        await expect(pin).toHaveCSS("opacity", "1");
        const box = await pin.boundingBox();
        expect(box && box.width >= 28 && box.height >= 28, "o pin é alcançável (≥ 28px)").toBeTruthy();
        expect(box!.x + box!.width).toBeLessThanOrEqual(w);
      }
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("CR-26: fixar na linha sobe ao topo (pin preenchido) e desafixar volta à ordem; não abre a conversa", async ({ page, context }) => {
      await loginAs(context, DONO);
      await abrir(page);
      await expect(li(page, GAMA)).toBeVisible({ timeout: 15_000 });
      // Mais recente primeiro: Gama, Beta, Alfa.
      expect(await ordem(page)).toEqual([GAMA, BETA, ALFA]);

      const pin = li(page, ALFA).getByTestId("mail-pin");
      await pin.click();
      await expect(li(page, ALFA)).toHaveAttribute("data-pinned", "true");
      await expect(pin).toHaveAttribute("aria-pressed", "true");
      await expect(pin).toHaveAttribute("aria-label", "Desafixar conversa");
      await expect(pin.locator("svg")).toHaveClass(/fill-current/); // pin preenchido
      await expect(page.locator("li[data-pinned]").first()).toContainText(ALFA);
      await expect.poll(() => ordem(page)).toEqual([ALFA, GAMA, BETA]);
      // Clicar no pin nunca abre a conversa.
      await expect(page).not.toHaveURL(/conversa=/);
      await expect(page.getByTestId("mail-thread")).toHaveCount(0);

      // O pin sobrevive ao recarregar (vem do servidor).
      await abrir(page);
      await expect(li(page, ALFA)).toHaveAttribute("data-pinned", "true", { timeout: 15_000 });
      expect(await ordem(page)).toEqual([ALFA, GAMA, BETA]);

      await li(page, ALFA).getByTestId("mail-pin").click();
      await expect(li(page, ALFA)).toHaveAttribute("data-pinned", "false");
      await expect.poll(() => ordem(page)).toEqual([GAMA, BETA, ALFA]);
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("CR-26: fixar dentro da conversa (Fixar ↔ Desafixar) e a lista acompanha", async ({ page, context }) => {
      await loginAs(context, DONO);
      await abrir(page);
      await li(page, BETA).getByTestId("mail-thread-row").click();
      await expect(page.getByTestId("mail-thread-subject")).toHaveText(BETA);
      const pinBtn = page.getByTestId("mail-thread-pin");
      await expect(pinBtn).toHaveText("Fixar");
      await expect(pinBtn).toBeEnabled();
      await pinBtn.click();
      await expect(pinBtn).toHaveText("Desafixar");
      await expect(pinBtn).toHaveAttribute("aria-pressed", "true");
      if (w < 1024) {
        await page.getByRole("button", { name: "Voltar" }).click();
        await expect(page.getByTestId("mail-thread-row").first()).toBeVisible();
      }
      await expect(li(page, BETA)).toHaveAttribute("data-pinned", "true");
      await expect(page.locator("li[data-pinned]").first()).toContainText(BETA);

      // Desafixar também dentro da conversa.
      if (w < 1024) await li(page, BETA).getByTestId("mail-thread-row").click();
      await expect(page.getByTestId("mail-thread-pin")).toHaveText("Desafixar");
      await page.getByTestId("mail-thread-pin").click();
      await expect(page.getByTestId("mail-thread-pin")).toHaveText("Fixar");
      if (w < 1024) await page.getByRole("button", { name: "Voltar" }).click();
      await expect(li(page, BETA)).toHaveAttribute("data-pinned", "false");
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("CR-26: arquivar uma conversa fixada não a desafixa", async ({ page, context }) => {
      await loginAs(context, DONO);
      await abrir(page);
      await li(page, BETA).getByTestId("mail-pin").click();
      await expect(li(page, BETA)).toHaveAttribute("data-pinned", "true");
      await li(page, BETA).getByTestId("mail-thread-row").click();
      await expect(li(page, BETA).getByTestId("mail-thread-row")).toHaveAttribute("data-unread", "false", { timeout: 10_000 }); // lida ao abrir
      await page.getByRole("button", { name: "Arquivar", exact: true }).click();
      await expect(page.getByText("Conversa arquivada.")).toBeVisible({ timeout: 10_000 });
      await expect(li(page, BETA)).toHaveCount(0); // saiu da Entrada

      await page.getByRole("tab", { name: /Arquivo/ }).click();
      await expect(li(page, BETA)).toBeVisible({ timeout: 10_000 });
      await expect(li(page, BETA)).toHaveAttribute("data-pinned", "true");
      await expect(li(page, BETA).getByTestId("mail-pin")).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("li[data-pinned]").first()).toContainText(BETA); // fixadas primeiro, também no Arquivo
      // O filtro vale no Arquivo. Abrir a conversa no Entrada leu-a (o dono responde): sai de «Por ler» e fica em «Lidas».
      await filtro(page).selectOption("unread");
      await expect(li(page, BETA)).toHaveCount(0);
      await filtro(page).selectOption("read");
      await expect(li(page, BETA)).toBeVisible();
      await expect(li(page, BETA)).toHaveAttribute("data-pinned", "true");

      // Limpeza: desafixa e devolve à Entrada.
      await filtro(page).selectOption("all");
      await li(page, BETA).getByTestId("mail-pin").click();
      await expect(li(page, BETA)).toHaveAttribute("data-pinned", "false");
      await li(page, BETA).getByTestId("mail-thread-row").click();
      await page.getByRole("button", { name: "Desarquivar", exact: true }).click();
      await expect(page.getByText(/desarquivada/i)).toBeVisible({ timeout: 10_000 });
    });

    test("CR-26/EQ-03: membro só com «Ver» vê as fixadas mas o pin está desactivado com o motivo", async ({ page, context }) => {
      const d = await donoApi();
      const alfa = (await d.threads("all", ALFA)).find((x) => x.subject === ALFA)!;
      await d.act(alfa.threadId, "pin");
      try {
        await loginAs(context, MEMBRO_VER);
        await page.goto("/correio");
        await expect(page.getByTestId("mail-split")).toBeVisible({ timeout: 15_000 });
        const selector = page.getByRole("combobox", { name: "Caixa" });
        if (await selector.count()) {
          const label = (await selector.locator("option").allTextContents()).find((t) => t.startsWith("Suporte · "))!;
          await selector.selectOption({ label });
        }
        await expect(li(page, ALFA)).toBeVisible({ timeout: 15_000 });
        await expect(li(page, ALFA)).toHaveAttribute("data-pinned", "true");
        await expect(page.locator("li[data-pinned]").first()).toContainText(ALFA); // vê as fixadas no topo
        const pin = li(page, ALFA).getByTestId("mail-pin");
        await expect(pin).toBeDisabled();
        await expect(pin).toHaveAttribute("title", "Só tens permissão para ver");
        await expect(pin).toHaveAttribute("aria-pressed", "true");
        await expect(li(page, BETA).getByTestId("mail-pin")).toBeDisabled();

        await li(page, ALFA).getByTestId("mail-thread-row").click();
        const inside = page.getByTestId("mail-thread-pin");
        await expect(inside).toHaveText("Desafixar");
        await expect(inside).toBeDisabled();
        await expect(inside.locator("xpath=..")).toHaveAttribute("title", "Só tens permissão para ver");
        // Só Ver não marca lida ao abrir (CR-07): Alfa continua por ler.
        if (w < 1024) await page.getByRole("button", { name: "Voltar" }).click();
        await expect(li(page, ALFA).getByTestId("mail-thread-row")).toHaveAttribute("data-unread", "true");
        expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      } finally {
        await d.act(alfa.threadId, "unpin");
        await d.api.dispose();
      }
    });

    test("CR-26: «Tudo lido» quando já não há por ler; captura", async ({ page, context }) => {
      const d = await donoApi();
      // Lê tudo o que ainda está por ler (as de outras larguras também), para o filtro ficar vazio.
      for (let guard = 0; guard < 10; guard++) {
        const r = await d.api.get(`${API}/mail/mailboxes/${d.suporte.mailboxId}/threads`, { params: { folder: "all", status: "unread", limit: 50 } });
        const items = ((await r.json()).items ?? []) as Row[];
        if (!items.length) break;
        for (const it of items) await d.act(it.threadId, "read");
      }
      await d.api.dispose();

      await loginAs(context, DONO);
      await abrir(page, "?filtro=por-ler");
      await expect(filtro(page)).toHaveValue("unread");
      await expect(page.getByTestId("mail-empty")).toContainText("Tudo lido", { timeout: 15_000 });
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);

      await filtro(page).selectOption("all");
      await expect(li(page, GAMA)).toBeVisible();
      await li(page, ALFA).getByTestId("mail-pin").click();
      await expect(li(page, ALFA)).toHaveAttribute("data-pinned", "true");
      await page.mouse.move(0, 0);
      await page.screenshot({ path: path.join(SHOTS, `b56-entrada-fixadas-${w}.png`) });
      await li(page, ALFA).getByTestId("mail-pin").click(); // limpeza
      await expect(li(page, ALFA)).toHaveAttribute("data-pinned", "false");
    });
  });
}

const SHOTS = path.resolve(".design", "email", "capturas");
fs.mkdirSync(SHOTS, { recursive: true });
