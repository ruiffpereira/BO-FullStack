import { test, expect, request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { loginAs, nextClientIp, API, E2E_PASSWORD } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { openSupportTab, ADMIN } from "./fixtures/support";
import { AdminPage } from "./pages/AdminPage";

/**
 * Caixas automáticas do Correio (B55), nas 3 larguras (1440 / 834 / 390).
 *
 * O `.env.e2e` da API define `EMAIL_PLATFORM_DOMAIN=e2e.test` e a caixa é o simulador em memória (`MemoryMailbox`): nada fala com
 * o Stalwart nem com o Resend. As caixas vivem no processo da API (não no seed), por isso nascem aqui, como nascem em produção:
 * o admin dá o «Nome do dono» (`PUT /users` → caixa pessoal do dono, `suporte@` e uma por membro) e o admin dá o seu (`PUT /users/me`).
 * Os emails de teste entregam-se entre caixas do simulador (a entrega local simulada).
 *
 * Tenant `caixas@e2e.local` (Mercearia Tília, código `tilia`, ver `E2E_CAIXAS` do seed): dono + 3 membros:
 *   caixas.ver@e2e.local    «Rui Leitor»     correio.caixa Ver        → pessoal + suporte@ (só leitura)
 *   caixas.edita@e2e.local  «Eva Editora»    correio.caixa Responder  → pessoal + suporte@ (escreve)
 *   caixas.sem@e2e.local    «Vera Contactos» sem correio.caixa        → só a pessoal, sem selector
 *
 * Regras provadas (docs/0 - Regras de negocio/0.00 - indice.md): CR-09 (a caixa do membro cria-se sozinha no convite; só ele a lê), CR-24 (endereços
 * `<pessoa>.<código>@` e `suporte.<código>@`), CR-25 (as caixas nascem sozinhas; a pessoal aparece primeiro e é sempre de quem a
 * abre), EQ-03 (Ver = botões desactivados com o motivo).
 */
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const DONO = "caixas@e2e.local";
const VER = "caixas.ver@e2e.local";
const EDITA = "caixas.edita@e2e.local";
const SEM = "caixas.sem@e2e.local";
const OUTRO_NEGOCIO = "correio@e2e.local";
const CODIGO = "tilia";
const PLATAFORMA = "e2e.test";
const RUN = Date.now().toString(36);
const ASSUNTO_SUPORTE = `Pedido para o suporte ${RUN}`;
const ASSUNTO_DONO = `Resposta ao dono ${RUN}`;
const ASSUNTO_VER = `Olá Rui ${RUN}`;
const ASSUNTO_SEM = `Olá Vera ${RUN}`;
const OWNER_NAME = "Tânia Tília";
const ADMIN_OWNER_NAME = "Ada Mestre";

const SIZES = [
  { w: 1440, h: 900 },
  { w: 834, h: 1112 },
  { w: 390, h: 844 },
];

const SHOTS = path.resolve(".design", "email", "capturas"); // relativo ao Backoffice (cwd do Playwright)
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: path.join(SHOTS, `b55-${name}-${w}.png`), fullPage: false });

type Authed = { api: APIRequestContext; userId: string };
const loose: APIRequestContext[] = [];

/** Sessão de API (sem browser) como `email`; o `api` leva o Bearer. */
async function authed(email: string): Promise<Authed> {
  const anon = await pwRequest.newContext();
  const res = await anon.post(`${API}/users/login`, {
    data: { username: email, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${email} (${res.status()})`).toBeTruthy();
  const body = await res.json();
  await anon.dispose();
  const api = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${body.accessToken as string}` } });
  loose.push(api);
  return { api, userId: body.userId as string };
}

type Box = { mailboxId: string; address: string; kind: string; own?: boolean; unread: number | null };
async function myBoxes(a: Authed): Promise<Box[]> {
  const res = await a.api.get(`${API}/mail/mailboxes`);
  expect(res.ok(), `GET /mail/mailboxes (${res.status()})`).toBeTruthy();
  return (await res.json()).mailboxes as Box[];
}

async function until<T>(what: string, fn: () => Promise<T | null | undefined | false>, ms = 40_000): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`Tempo esgotado: ${what}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

const addrOf = (boxes: { address: string; kind: string }[], first: string) =>
  boxes.find((b) => b.address.startsWith(`${first}.`) && !b.address.startsWith("suporte."))?.address ?? "";

let suporteAddr = "";
let donoPessoalAddr = "";
let donoSuporteId = "";
let memberAddr: Record<string, string> = {};
let tenantId = "";

/** O que o Admin faz: «Nome do dono» (dono + `suporte@` + membros) e o nome do próprio admin (caixa `primeiro.último@`). */
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const admin = await authed(ADMIN);
  const dono = await authed(DONO);
  tenantId = dono.userId;

  const put = await admin.api.put(`${API}/users`, { data: { userId: dono.userId, ownerName: OWNER_NAME } });
  expect(put.ok(), `PUT /users ownerName (${put.status()} ${await put.text()})`).toBeTruthy();
  const adminBoxes = await until("5 caixas do negócio (suporte, dono, 3 membros)", async () => {
    const r = await admin.api.get(`${API}/admin/users/${dono.userId}/mailboxes`);
    const rows = ((await r.json()).mailboxes ?? []) as { address: string; kind: string; status: string }[];
    return rows.filter((b) => b.status === "active").length >= 5 ? rows : null;
  });
  suporteAddr = adminBoxes.find((b) => b.kind === "business")?.address ?? "";
  expect(suporteAddr).toBe(`suporte.${CODIGO}@${PLATAFORMA}`);
  memberAddr = { ver: addrOf(adminBoxes, "rui"), edita: addrOf(adminBoxes, "eva"), sem: addrOf(adminBoxes, "vera") };
  for (const [k, a] of Object.entries(memberAddr)) expect(a, `caixa pessoal do membro ${k}`).toMatch(new RegExp(`\\.${CODIGO}@${PLATAFORMA.replace(".", "\\.")}$`));

  // O admin dá o seu nome: nasce a caixa dele (só dele).
  const me = await admin.api.put(`${API}/users/me`, { data: { ownerName: ADMIN_OWNER_NAME } });
  expect(me.ok(), `PUT /users/me ownerName (${me.status()} ${await me.text()})`).toBeTruthy();
  await until("caixa do admin", async () => ((await myBoxes(admin)).length > 0 ? true : null));

  // Emails entregues entre caixas do simulador, para haver não lidos em cada uma.
  const boxes = await myBoxes(dono);
  const pessoal = boxes.find((b) => b.own)!;
  const suporte = boxes.find((b) => b.kind === "business")!;
  donoPessoalAddr = pessoal.address;
  donoSuporteId = suporte.mailboxId;
  const send = async (from: Box, to: string, subject: string) => {
    const r = await dono.api.post(`${API}/mail/mailboxes/${from.mailboxId}/send`, { data: { mode: "new", to: [to], subject, text: "Mensagem de teste (e2e)." } });
    expect(r.status(), `enviar «${subject}» (${await r.text()})`).toBe(201);
  };
  await send(pessoal, suporte.address, ASSUNTO_SUPORTE);
  await send(suporte, pessoal.address, ASSUNTO_DONO);
  await send(suporte, memberAddr.ver, ASSUNTO_VER);
  await send(suporte, memberAddr.sem, ASSUNTO_SEM);
});

test.afterAll(async () => {
  for (const c of loose) await c.dispose().catch(() => {});
});

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const caixa = (page: Page) => page.getByRole("combobox", { name: "Caixa" });
const optionTexts = (page: Page) => caixa(page).locator("option").allTextContents();

async function openCorreio(page: Page, context: Parameters<typeof loginAs>[0], user: string, url = "/correio") {
  await loginAs(context, user);
  await withSessionRetry(page, context, user, () => page.goto(url), async () => {
    await expect(page.getByTestId("mail-split")).toBeVisible({ timeout: 15_000 });
  });
}

for (const { w, h } of SIZES) {
  test.describe(`Correio — caixas automáticas (${w}px)`, () => {
    test.use({ viewport: { width: w, height: h } });

    test("CR-25: o dono vê «Pessoal · …» primeiro e «Suporte · …» depois, com os não lidos", async ({ page, context }) => {
      await openCorreio(page, context, DONO);
      await expect(caixa(page)).toBeVisible();
      const opts = await optionTexts(page);
      expect(opts).toHaveLength(2);
      // Primeiro a pessoal (`<nome>.<código>@…`), depois a do negócio; o número entre parênteses são os não lidos.
      expect(opts[0]).toMatch(new RegExp(`^Pessoal · [a-z0-9.-]+\\.${CODIGO}@${PLATAFORMA.replace(".", "\\.")} \\(\\d+\\)$`));
      expect(opts[1]).toBe(`Suporte · ${suporteAddr} (1)`);
      expect(opts[0]).toContain(donoPessoalAddr);
      // A caixa que abre por omissão é a pessoal.
      await expect(caixa(page)).toHaveValue(await caixa(page).locator("option").first().getAttribute("value") as string);
      // O que está na pessoal: o email que o negócio lhe mandou; o pedido para o suporte NÃO está aqui.
      await expect(page.getByTestId("mail-thread-row").filter({ hasText: ASSUNTO_DONO })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("mail-thread-row").filter({ hasText: ASSUNTO_SUPORTE })).toHaveCount(0);
      // Mudar para o suporte@ mostra o pedido.
      await caixa(page).selectOption({ label: opts[1] });
      await expect(page.getByTestId("mail-thread-row").filter({ hasText: ASSUNTO_SUPORTE })).toBeVisible({ timeout: 15_000 });
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      await shot(page, "dono-caixa", w);
    });

    test("CR-25: a password da app só aparece nas caixas que são minhas (o dono: pessoal e suporte@)", async ({ page, context }) => {
      await openCorreio(page, context, DONO);
      const btn = page.getByRole("button", { name: "Configurar no telemóvel" });
      await expect(btn).toBeVisible();
      const opts = await optionTexts(page);
      await caixa(page).selectOption({ label: opts[1] });
      await expect(page.getByRole("button", { name: "Configurar no telemóvel" })).toBeVisible();
      // O botão abre o modal, e o modal fecha sem gerar nada (nenhuma password fica no ecrã).
      await page.getByRole("button", { name: "Configurar no telemóvel" }).click();
      const dlg = page.getByRole("dialog");
      await expect(dlg).toBeVisible();
      await expect(dlg).toContainText(suporteAddr);
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      await page.keyboard.press("Escape");
    });

    test("CR-25: membro sem «Caixa» vê só a sua caixa — sem selector, escreve, e o suporte@ não existe para ele", async ({ page, context }) => {
      await openCorreio(page, context, SEM);
      await expect(caixa(page)).toHaveCount(0);
      // A caixa pessoal não depende de `correio.caixa`: pode escrever e configurar o telemóvel.
      await expect(page.getByRole("button", { name: "Novo email" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Configurar no telemóvel" })).toBeVisible();
      await expect(page.getByTestId("mail-thread-row").filter({ hasText: ASSUNTO_SEM })).toBeVisible({ timeout: 15_000 });
      // Nada do suporte@ nem das caixas dos colegas.
      for (const s of [ASSUNTO_SUPORTE, ASSUNTO_DONO, ASSUNTO_VER]) await expect(page.getByTestId("mail-thread-row").filter({ hasText: s })).toHaveCount(0);
      // Deep-link para a caixa do suporte: cai na dele (nunca abre a do negócio).
      await page.goto(`/correio?caixa=${donoSuporteId}`);
      await expect(page.getByTestId("mail-split")).toBeVisible({ timeout: 15_000 });
      await expect(caixa(page)).toHaveCount(0);
      await expect(page.getByTestId("mail-thread-row").filter({ hasText: ASSUNTO_SUPORTE })).toHaveCount(0);
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      await shot(page, "membro-sem-caixa", w);
      // E a API recusa-lhe a do negócio, com o id certo na mão.
      const me = await authed(SEM);
      const r = await me.api.get(`${API}/mail/mailboxes/${donoSuporteId}/threads`);
      expect([403, 404], `suporte@ para quem não tem «Caixa» (${r.status()})`).toContain(r.status());
      expect((await myBoxes(me)).map((b) => b.kind)).not.toContain("business");
    });

    test("CR-25/EQ-03: membro só-ver lê o suporte@ mas as escritas ficam desactivadas com o motivo; na pessoal escreve", async ({ page, context }) => {
      await openCorreio(page, context, VER);
      const opts = await optionTexts(page);
      expect(opts).toHaveLength(2);
      expect(opts[0]).toMatch(/^Pessoal · rui\./);
      expect(opts[1]).toBe(`Suporte · ${suporteAddr} (1)`);

      // Na pessoal: escreve (a caixa pessoal é sempre dele) e o email que lhe mandaram está lá.
      await expect(page.getByRole("button", { name: "Novo email" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Configurar no telemóvel" })).toBeVisible();
      await expect(page.getByTestId("mail-thread-row").filter({ hasText: ASSUNTO_VER })).toBeVisible({ timeout: 15_000 });

      // No suporte@: lê, mas só-ver. Sem «Configurar no telemóvel» (não é dele).
      await caixa(page).selectOption({ label: opts[1] });
      const linha = page.getByTestId("mail-thread-row").filter({ hasText: ASSUNTO_SUPORTE });
      await expect(linha).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Configurar no telemóvel" })).toHaveCount(0);
      const novo = page.getByRole("button", { name: "Novo email" });
      await expect(novo).toBeDisabled();
      await expect(novo.locator("xpath=..")).toHaveAttribute("title", "Só tens permissão para ver");
      await linha.click();
      await expect(page.getByTestId("mail-message").first()).toContainText("Mensagem de teste");
      for (const name of ["Responder", "Responder a todos", "Encaminhar", "Arquivar", "Marcar como não lido"]) {
        const b = page.getByRole("button", { name, exact: true });
        await expect(b).toBeDisabled();
        await expect(b.locator("xpath=..")).toHaveAttribute("title", "Só tens permissão para ver");
      }
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      await shot(page, "membro-so-ver-suporte", w);
      // A API recusa a escrita na caixa do negócio a quem só vê.
      const me = await authed(VER);
      const r = await me.api.post(`${API}/mail/mailboxes/${donoSuporteId}/send`, { data: { mode: "new", to: ["x@example.com"], subject: "não deve sair", text: "x" } });
      expect(r.status(), "enviar pelo suporte@ com «Caixa» só Ver").toBe(403);
    });

    test("CR-25: membro com «Responder» escreve no suporte@", async ({ page, context }) => {
      await openCorreio(page, context, EDITA);
      const opts = await optionTexts(page);
      expect(opts).toHaveLength(2);
      expect(opts[0]).toMatch(/^Pessoal · eva\./);
      await caixa(page).selectOption({ label: opts[1] });
      await expect(page.getByTestId("mail-thread-row").filter({ hasText: ASSUNTO_SUPORTE })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Novo email" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Configurar no telemóvel" })).toHaveCount(0);
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("CR-25: o admin só vê a sua caixa (sem selector) e nada dos negócios", async ({ page, context }) => {
      await openCorreio(page, context, ADMIN);
      await expect(caixa(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Configurar no telemóvel" })).toBeVisible();
      for (const s of [ASSUNTO_SUPORTE, ASSUNTO_DONO, ASSUNTO_VER, ASSUNTO_SEM]) await expect(page.getByTestId("mail-thread-row").filter({ hasText: s })).toHaveCount(0);
      const admin = await authed(ADMIN);
      const boxes = await myBoxes(admin);
      expect(boxes.map((b) => b.kind)).toEqual(["admin"]);
      expect(boxes[0].address).toMatch(new RegExp(`^ada\\.mestre@${PLATAFORMA.replace(".", "\\.")}$`));
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    });

    test("isolamento: outro negócio nunca vê as caixas do Tília, nem com o id na mão", async ({ page, context }) => {
      const outro = await authed(OUTRO_NEGOCIO);
      const boxes = await myBoxes(outro);
      for (const b of boxes) expect(b.address, "caixa de outro negócio").not.toContain(`.${CODIGO}@`);
      for (const id of [donoSuporteId]) {
        const r = await outro.api.get(`${API}/mail/mailboxes/${id}/threads`);
        expect(r.status(), `caixa alheia ${id}`).toBe(404);
      }
      // Na UI o deep-link cai na caixa dele e não mostra nada do Tília.
      await loginAs(context, OUTRO_NEGOCIO);
      await withSessionRetry(page, context, OUTRO_NEGOCIO, () => page.goto(`/correio?caixa=${donoSuporteId}`), async () => {
        // Este negócio pode ou não ter caixas (depende da reconciliação): o que importa é que não abre a do Tília.
        await expect(page.getByTestId("mail-split").or(page.getByTestId("mail-no-mailbox"))).toBeVisible({ timeout: 15_000 });
      });
      for (const s of [ASSUNTO_SUPORTE, ASSUNTO_DONO, ASSUNTO_VER, ASSUNTO_SEM]) await expect(page.getByTestId("mail-thread-row").filter({ hasText: s })).toHaveCount(0);
    });

    test("CR-25: sem caixas o estado vazio diz que se criam sozinhas", async ({ page, context }) => {
      await loginAs(context, DONO);
      await page.route("**/api/mail/mailboxes", (route) => route.fulfill({ json: { configured: true, mailboxes: [] } }));
      await withSessionRetry(page, context, DONO, () => page.goto("/correio"), async () => {
        await expect(page.getByTestId("mail-no-mailbox")).toBeVisible({ timeout: 15_000 });
      });
      await expect(page.getByTestId("mail-no-mailbox")).toContainText("Ainda não tens nenhuma caixa");
      await expect(page.getByTestId("mail-no-mailbox")).toContainText("As caixas criam-se sozinhas: a tua aparece aqui daqui a pouco.");
      await expect(page.getByTestId("mail-no-mailbox")).toContainText("fala com a RufVision");
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      await shot(page, "estado-vazio", w);
    });

    test("CR-07: sessão de suporte («Entrar como») não vê o correio", async ({ page, context }) => {
      await loginAs(context, ADMIN);
      await page.goto("/admin");
      const tab = await openSupportTab(context, tenantId);
      // O item «Correio» continua no menu (como o resto do tenant); o que importa é o que a página mostra.
      await tab.goto("/correio");
      await expect(tab.getByRole("region", { name: "Sessão de suporte" })).toBeVisible({ timeout: 15_000 });
      // A API fecha `/mail/*` em sessão de suporte (CR-07): a página diz-o e não mostra caixas, conversas nem o suporte@.
      await expect(tab.getByText("Indisponível numa sessão de suporte.")).toBeVisible({ timeout: 15_000 });
      await expect(tab.getByTestId("mail-thread-row")).toHaveCount(0);
      await expect(tab.getByTestId("mail-split")).toHaveCount(0);
      expect(await noHorizontalScroll(tab)).toBeLessThanOrEqual(0);
      await shot(tab, "suporte-sem-correio", w);
      await tab.close();
    });

    test("CR-09: convidar um membro já não pede o endereço — mostra o que vai ser criado e a caixa nasce sozinha", async ({ page, context }) => {
      const first = { 1440: "Zélia", 834: "Xavier", 390: "Yara" }[w as 1440 | 834 | 390];
      const name = `${first} Nova`;
      const email = `${first.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${RUN}.${w}@e2e.local`;
      await loginAs(context, DONO);
      await withSessionRetry(page, context, DONO, () => page.goto("/equipa"), async () => {
        await expect(page.getByRole("button", { name: "Convidar utilizador" })).toBeVisible({ timeout: 10_000 });
      });
      await page.getByRole("button", { name: "Convidar utilizador" }).click();
      const invite = page.getByRole("dialog", { name: "Convidar utilizador" });
      const notice = invite.getByTestId("member-mailbox-notice");
      await expect(notice).toBeVisible();
      // Nenhum campo para escrever o endereço, nenhuma caixa «Dar-lhe um endereço de email».
      await expect(invite.getByLabel("Parte local do endereço")).toHaveCount(0);
      await expect(invite.getByText("Dar-lhe um endereço de email")).toHaveCount(0);
      await expect(notice).toContainText("Vai receber uma caixa de correio só dele, criada sozinha ao enviar o convite.");
      // A previsão vem da API e acompanha o nome.
      await invite.getByLabel("Nome", { exact: true }).fill(name);
      const preview = invite.getByTestId("member-mailbox-preview");
      await expect(preview).toBeVisible({ timeout: 10_000 });
      const norm = first.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      await expect(preview).toHaveText(new RegExp(`^${norm}[a-z0-9.]*\\.${CODIGO}@${PLATAFORMA.replace(".", "\\.")}$`));
      await expect(notice).toContainText("A caixa pessoal funciona sempre. A caixa do negócio (suporte) só se lhe deres Correio → Caixa.");
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      await shot(page, "convite-membro", w);

      await invite.getByLabel("Email", { exact: true }).fill(email);
      await invite.getByRole("checkbox", { name: "Clientes", exact: true }).check();
      await invite.getByRole("button", { name: "Enviar convite" }).click();
      // A caixa nasce com o convite: o aviso diz o endereço, e a ficha do membro mostra-o.
      const criada = new RegExp(`Caixa criada: ${norm}[a-z0-9.]*\\.${CODIGO}@${PLATAFORMA.replace(".", "\\.")}`);
      await expect(page.getByText(criada).first()).toBeVisible({ timeout: 15_000 });
      await expect(invite).toHaveCount(0, { timeout: 10_000 });
      const row = page.getByRole("row", { name: `Abrir ${name}` }).or(page.getByRole("button", { name: `Abrir ${name}`, exact: true }));
      await expect(row).toBeVisible({ timeout: 10_000 });
      await row.click();
      const ficha = page.getByRole("dialog", { name });
      await expect(ficha.getByTestId("member-mailbox-address")).toHaveText(new RegExp(`^${norm}[a-z0-9.]*\\.${CODIGO}@${PLATAFORMA.replace(".", "\\.")}$`), { timeout: 10_000 });
      await expect(ficha).toContainText("Criada sozinha ao convidar. Só o próprio a lê.");
      // Já não há como «dar» o endereço a posteriori.
      await expect(ficha.getByRole("button", { name: "Criar endereço" })).toHaveCount(0);
      await expect(ficha.getByText("Dar-lhe um endereço de email")).toHaveCount(0);
      await shot(page, "ficha-membro-caixa", w);
    });

    test("CR-25: o «Nome do dono» está em Admin → Utilizadores (novo e editar) e no Perfil do dono e do admin", async ({ page, context }) => {
      // Admin → Utilizadores → Editar (gravar e reabrir).
      await loginAs(context, ADMIN);
      const admin = new AdminPage(page);
      await withSessionRetry(page, context, ADMIN, () => admin.goto(), async () => {
        await expect(page.getByRole("button", { name: "Eliminar" }).first()).toBeVisible({ timeout: 15_000 });
      });
      await admin.openNewUserModal();
      const novo = page.getByRole("dialog");
      await expect(novo.getByLabel("Nome do dono")).toBeVisible();
      await expect(novo.getByText("sem isto a caixa não se cria")).toBeVisible();
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      await novo.getByRole("button", { name: "Cancelar" }).click();

      const row = await admin.userRowFromStart("agenda@e2e");
      await row.getByRole("button", { name: "Editar", exact: true }).click();
      const edit = page.getByRole("dialog", { name: "Editar utilizador" });
      await expect(edit.getByLabel("Nome do dono")).toBeVisible();
      const nomeDono = `Aurora Agenda ${w}`;
      await edit.getByLabel("Nome do dono").fill(nomeDono);
      await shot(page, "admin-nome-do-dono", w);
      await edit.getByRole("button", { name: "Guardar" }).click();
      await expect(edit).toHaveCount(0, { timeout: 10_000 });
      const row2 = await admin.userRowFromStart("agenda@e2e");
      await row2.getByRole("button", { name: "Editar", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Editar utilizador" }).getByLabel("Nome do dono")).toHaveValue(nomeDono, { timeout: 10_000 });
      await page.getByRole("dialog", { name: "Editar utilizador" }).getByRole("button", { name: "Cancelar" }).click();

      // Perfil do dono do negócio (preenchido pelo admin em cima) e do admin (preenchido pela API no arranque).
      for (const [user, valor] of [[DONO, OWNER_NAME], [ADMIN, ADMIN_OWNER_NAME]] as const) {
        await loginAs(context, user);
        await withSessionRetry(page, context, user, () => page.goto("/perfil"), async () => {
          await expect(page.getByLabel("O teu nome")).toBeVisible({ timeout: 15_000 });
        });
        await expect(page.getByLabel("O teu nome")).toHaveValue(valor, { timeout: 10_000 });
        await expect(page.getByText("Dá-te uma caixa de correio pessoal")).toBeVisible();
        expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      }
      await shot(page, "perfil-o-teu-nome", w);
    });
  });
}
