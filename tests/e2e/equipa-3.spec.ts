import { test, expect, request as pwRequest, type Page, type BrowserContext } from "@playwright/test";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { EquipaPage } from "./pages/EquipaPage";

/**
 * B41 fase 3 — DELEGAÇÃO na equipa, vista pela UI.
 *
 * Seed (`API-FullStack/scripts/seedE2e.ts`, `E2E_TEAM3_MEMBERS`): tenant `equipa3@e2e.local` ("Oficina Quartzo", Agenda +
 * Clientes + Conteúdos, com consentimento de suporte) e membros activos:
 *   Bruno Gerir (equipa Gerir) · Vítor Equiver (equipa Ver) · Sofia Semequipa (sem o nó)
 *   Carlos Criador → Íris Convidada   (cadeia da cascata)
 *   Duarte Criador → Inês Convidada   (cadeia do "remover um criador")
 *
 * Os testes mudam estado (convites, cascata, remoção) mas cada um só toca no que é seu: correm em série e na ordem.
 */
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial", retries: 0 });

const DONO = "equipa3@e2e.local";
const GERIR = { name: "Bruno Gerir", email: "e3-gerir@e2e.local" };
const VER = { name: "Vítor Equiver", email: "e3-ver@e2e.local" };
const SEM = { name: "Sofia Semequipa", email: "e3-sem@e2e.local" };
const CRIADOR = { name: "Carlos Criador", email: "e3-criador@e2e.local" };
const CONVIDADA = { name: "Íris Convidada", email: "e3-convidada@e2e.local" };
const CRIADOR2 = { name: "Duarte Criador", email: "e3-criador2@e2e.local" };
const CONVIDADA2 = { name: "Inês Convidada", email: "e3-convidada2@e2e.local" };
const ADMIN = "admin@e2e";
const CANNOT_GIVE = "Só podes dar o que tens";

// ── helpers ────────────────────────────────────────────────────────────────────

async function enter(page: Page, context: BrowserContext, user: string, path: string, ready: () => Promise<void>): Promise<void> {
  await loginAs(context, user);
  await withSessionRetry(page, context, user, () => page.goto(path), ready);
}

/** Abre `/equipa` como `user` e espera pela linha de `waitFor`. */
async function openEquipa(page: Page, context: BrowserContext, user: string, waitFor: string): Promise<void> {
  await enter(page, context, user, "/equipa", async () => {
    await expect(page.getByText(waitFor, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
}

/** Todas as linhas (tabela, computador) pelo nome visível — abre ou não (membros só-leitura não têm aria-label). */
const anyRow = (page: Page, name: string) =>
  page.getByRole("row").filter({ has: page.locator("td:first-child", { hasText: new RegExp("^" + name + "\\s*(\\(tu\\))?$") }) });

async function login(request: import("@playwright/test").APIRequestContext, username: string) {
  const res = await request.post(`${API}/users/login`, {
    data: { username, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${username} (${res.status()})`).toBeTruthy();
  return (await res.json()) as { accessToken: string; userId?: string };
}

/** Folhas efectivas de um membro, lidas por ele próprio (`GET /team/me`). */
async function grantsOf(request: import("@playwright/test").APIRequestContext, username: string): Promise<string> {
  const { accessToken } = await login(request, username);
  const res = await request.get(`${API}/team/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  expect(res.ok(), `GET /team/me de ${username} (${res.status()})`).toBeTruthy();
  return JSON.stringify((await res.json()).grants);
}

// ═══════════════════ 1. Dono ═══════════════════

test.describe("Fase 3 — o dono", () => {
  test("a lista tem 'Criado por' ('Tu' / nome do criador) e o convite tem o nó Equipa [Ver | Gerir]", async ({ page, context }) => {
    await openEquipa(page, context, DONO, GERIR.name);
    await expect(page.getByRole("columnheader", { name: "Criado por" })).toBeVisible();
    await expect(anyRow(page, GERIR.name).getByRole("cell").last()).toHaveText("Tu");
    await expect(anyRow(page, CONVIDADA.name).getByRole("cell").last()).toHaveText(CRIADOR.name);
    await expect(anyRow(page, CONVIDADA2.name).getByRole("cell").last()).toHaveText(CRIADOR2.name);

    await page.getByRole("button", { name: "Convidar utilizador" }).click();
    const invite = page.getByRole("dialog", { name: "Convidar utilizador" });
    const equipa = invite.getByRole("checkbox", { name: "Equipa", exact: true });
    await expect(equipa).toBeVisible();
    await expect(equipa).not.toBeChecked();
    await equipa.check();
    // Nível: [Ver | Gerir] (a etiqueta do nível de edição é "Gerir", não "Editar").
    await expect(invite.getByRole("tab", { name: "Equipa: só ver" })).toBeVisible();
    const gerir = invite.getByRole("tab", { name: "Equipa: Gerir" });
    await expect(gerir).toBeVisible();
    await expect(gerir).toBeEnabled();
    await invite.getByRole("tab", { name: "Equipa: só ver" }).click();
    await expect(invite.getByRole("tab", { name: "Equipa: só ver", selected: true })).toBeVisible();
  });

  test("'Acesso total' NÃO marca a Equipa (a ficha do convidado mostra tudo menos a Equipa)", async ({ page, context }) => {
    const nome = "Tiago Totalquartzo";
    await openEquipa(page, context, DONO, GERIR.name);
    await page.getByRole("button", { name: "Convidar utilizador" }).click();
    const invite = page.getByRole("dialog", { name: "Convidar utilizador" });
    await invite.getByRole("radio", { name: /Acesso total/ }).check();
    await invite.getByLabel("Nome").fill(nome);
    await invite.getByLabel("Email").fill("e3-total@e2e.local");
    await invite.getByRole("button", { name: "Enviar convite" }).click();
    await expect(anyRow(page, nome)).toBeVisible({ timeout: 10_000 });

    const ep = new EquipaPage(page, context, DONO);
    const ficha = await ep.openMember(nome);
    // Agenda fica PARCIAL: «Profissionais» (e os preços) nascem fechados e fora do Acesso total (EQ-04/EQ-15); o resto vem marcado.
    await expect(ep.node(ficha, "Agenda")).not.toBeChecked();
    expect(await ep.isPartial(ep.node(ficha, "Agenda")), "Agenda parcial").toBe(true);
    await ep.expand(ficha, "Agenda");
    await expect(ep.node(ficha, "Serviços")).toBeChecked();
    await expect(ep.node(ficha, "Profissionais")).not.toBeChecked();
    // Clientes fica PARCIAL: «Marcar "Aceita novidades"» nasce fechado e fora do Acesso total (EQ-04); o resto vem marcado.
    await expect(ep.node(ficha, "Clientes")).not.toBeChecked();
    expect(await ep.isPartial(ep.node(ficha, "Clientes")), "Clientes parcial").toBe(true);
    await ep.expand(ficha, "Clientes");
    await expect(ep.node(ficha, "Leads")).toBeChecked();
    await ep.expand(ficha, "Lista e ficha");
    await expect(ep.node(ficha, "Exportar dados (RGPD)")).toBeChecked();
    await expect(ep.node(ficha, "Marcar \"Aceita novidades\"")).not.toBeChecked();
    await expect(ep.node(ficha, "Equipa")).not.toBeChecked();
    await expect(await ep.isPartial(ep.node(ficha, "Equipa"))).toBe(false);
  });

  test("a ficha tem o separador Actividade (lista ou 'Ainda sem actividade')", async ({ page, context }) => {
    await openEquipa(page, context, DONO, GERIR.name);
    const ep = new EquipaPage(page, context, DONO);
    const ficha = await ep.openMember(VER.name);
    await ficha.getByRole("tab", { name: "Actividade" }).click();
    await expect(
      ficha.getByText("Ainda sem actividade").or(ficha.getByRole("list", { name: "Actividade do membro" })),
    ).toBeVisible({ timeout: 10_000 });
    // No separador Actividade não se guarda nada.
    await expect(ficha.getByRole("button", { name: "Guardar permissões" })).toBeDisabled();
    // Voltar às permissões.
    await ficha.getByRole("tab", { name: "Permissões" }).click();
    await expect(ficha.getByRole("list", { name: "Permissões" })).toBeVisible();
  });
});

// ═══════════════════ 2. Cascata ═══════════════════

test.describe("Fase 3 — cascata", () => {
  test("tirar uma permissão a quem criou outro avisa 'Também sai a 1 utilizador…'; cancelar não guarda; confirmar corta o convidado", async ({
    page,
    context,
    request,
  }) => {
    expect(await grantsOf(request, CONVIDADA.email)).toContain("agenda.servicos");

    await openEquipa(page, context, DONO, CRIADOR.name);
    const ep = new EquipaPage(page, context, DONO);
    const ficha = await ep.openMember(CRIADOR.name);
    await ep.expand(ficha, "Agenda");
    await ep.node(ficha, "Serviços").uncheck();
    const guardar = ficha.getByRole("button", { name: "Guardar permissões" });
    await expect(guardar).toBeEnabled();
    await guardar.click();

    const aviso = page.getByRole("dialog").filter({ hasText: "Retirar permissões?" });
    await expect(aviso.getByText("Também sai a 1 utilizador criado por este membro.")).toBeVisible({ timeout: 10_000 });

    // Cancelar: nada foi escrito.
    await aviso.getByRole("button", { name: "Cancelar" }).click();
    await expect(aviso.getByText("Também sai a 1 utilizador criado por este membro.")).toHaveCount(0);
    expect(await grantsOf(request, CONVIDADA.email), "cancelar não pode guardar").toContain("agenda.servicos");
    expect(await grantsOf(request, CRIADOR.email), "cancelar não pode guardar").toContain("agenda.servicos");

    // Confirmar: guarda e o convidado perde a permissão (o criador também).
    await guardar.click();
    await expect(aviso.getByText("Também sai a 1 utilizador criado por este membro.")).toBeVisible({ timeout: 10_000 });
    await aviso.getByRole("button", { name: "Guardar e retirar" }).click();
    await expect(aviso.getByText("Também sai a 1 utilizador criado por este membro.")).toHaveCount(0, { timeout: 10_000 });
    await expect(guardar).toBeDisabled({ timeout: 10_000 });

    expect(await grantsOf(request, CRIADOR.email)).not.toContain("agenda.servicos");
    const convidada = await grantsOf(request, CONVIDADA.email);
    expect(convidada, "o convidado perde o que o criador deixou de ter").not.toContain("agenda.servicos");
    expect(convidada, "e mantém o que o criador ainda tem").toContain("agenda.marcacoes");
  });
});

// ═══════════════════ 3. Membro com Gerir ═══════════════════

test.describe("Fase 3 — membro com Gerir", () => {
  test("vê 'Equipa' no menu do avatar, a lista dele e só abre as linhas que criou", async ({ page, context }) => {
    await enter(page, context, GERIR.email, "/perfil", async () => {
      await page.getByRole("button", { name: "Menu da conta" }).click();
      await expect(page.getByRole("menuitem", { name: "Equipa" })).toBeVisible({ timeout: 10_000 });
    });
    await page.getByRole("menuitem", { name: "Equipa" }).click();
    await expect(page).toHaveURL(/\/equipa$/);
    await expect(page.getByRole("button", { name: "Convidar utilizador" })).toBeEnabled({ timeout: 10_000 });
    await expect(anyRow(page, CRIADOR.name)).toBeVisible({ timeout: 10_000 });

    // A própria linha e as de outros: só leitura (sem "Abrir …", clicar não abre a ficha).
    for (const nome of [GERIR.name, CRIADOR.name, CONVIDADA.name, VER.name]) {
      await expect(page.getByRole("row", { name: `Abrir ${nome}` })).toHaveCount(0);
    }
    await anyRow(page, CRIADOR.name).click();
    await anyRow(page, GERIR.name).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Sem email das linhas que não criou.
    await expect(page.getByRole("columnheader", { name: "Email" })).toHaveCount(0);
    await expect(anyRow(page, GERIR.name)).toContainText("(tu)");
    // "Criado por" do dono lê-se com o nome do negócio (o criador é o dono).
    await expect(anyRow(page, CRIADOR.name).getByRole("cell").last()).toHaveText("Oficina Quartzo");
    await expect(anyRow(page, CONVIDADA.name).getByRole("cell").last()).toHaveText(CRIADOR.name);
  });

  test("convida um ajudante só com 'Escolher na árvore': o que não tem fica desactivado; abre e gere a linha que criou", async ({
    page,
    context,
  }) => {
    const ajudante = "Hugo Ajudante";
    await openEquipa(page, context, GERIR.email, CRIADOR.name);
    await page.getByRole("button", { name: "Convidar utilizador" }).click();
    const invite = page.getByRole("dialog", { name: "Convidar utilizador" });

    // Sem "Acesso total"; árvore à vista.
    await expect(invite.getByRole("radio", { name: /Acesso total/ })).toHaveCount(0);
    await expect(invite.getByRole("radio", { name: /Escolher na árvore/ })).toBeChecked();
    await expect(invite.getByRole("list", { name: "Permissões" })).toBeVisible();

    // O que ele não tem (Conteúdos) está desactivado, com a explicação.
    const conteudos = invite.getByRole("checkbox", { name: "Conteúdos", exact: true });
    await expect(conteudos).toBeDisabled();
    await expect(invite.getByText("Conteúdos", { exact: true }).locator("xpath=ancestor::label")).toHaveAttribute("title", CANNOT_GIVE);
    // O que tem, pode dar: Clientes e Agenda activos.
    await expect(invite.getByRole("checkbox", { name: "Clientes", exact: true })).toBeEnabled();
    await expect(invite.getByRole("checkbox", { name: "Agenda", exact: true })).toBeEnabled();

    // Folha com tecto: Serviços só tem "ver" → o nível "editar" fica desactivado.
    const ep = new EquipaPage(page, context, GERIR.email);
    await ep.expand(invite, "Agenda");
    await ep.node(invite, "Serviços").check();
    const editar = ep.level(invite, "Serviços", "editar");
    await expect(editar).toBeDisabled();
    await expect(editar).toHaveAttribute("title", CANNOT_GIVE);
    await expect(ep.level(invite, "Serviços", "só ver")).toHaveAttribute("aria-selected", "true");
    // Marcações ele tem em editar: pode dar editar.
    await ep.node(invite, "Calendário e marcações").check();
    await expect(ep.level(invite, "Calendário e marcações", "editar")).toBeEnabled();

    await invite.getByLabel("Nome").fill(ajudante);
    await invite.getByLabel("Email").fill("e3-ajudante@e2e.local");
    await invite.getByRole("button", { name: "Enviar convite" }).click();

    // A linha nova abre (criou-a) e diz "Tu".
    const nova = page.getByRole("row", { name: `Abrir ${ajudante}` });
    await expect(nova).toBeVisible({ timeout: 10_000 });
    await expect(nova.getByRole("cell").last()).toHaveText("Tu");
    await expect(nova).toContainText("e3-ajudante@e2e.local"); // detalhe completo nos que criou
    await nova.click();
    const ficha = page.getByRole("dialog", { name: ajudante });
    await expect(ficha).toBeVisible();
    await ep.expand(ficha, "Agenda");
    await expect(ep.node(ficha, "Serviços")).toBeChecked();
    await expect(ficha.getByRole("button", { name: "Reenviar convite" })).toBeVisible();
    await ficha.getByRole("tab", { name: "Actividade" }).click();
    await expect(
      ficha.getByText("Ainda sem actividade").or(ficha.getByRole("list", { name: "Actividade do membro" })),
    ).toBeVisible({ timeout: 10_000 });
    await ficha.getByRole("button", { name: "Fechar" }).last().click();

    // As linhas dos outros continuam fechadas.
    await expect(page.getByRole("row", { name: `Abrir ${CRIADOR.name}` })).toHaveCount(0);
  });

  test("o dono vê na Actividade do Bruno o convite que ele acabou de enviar", async ({ page, context }) => {
    await openEquipa(page, context, DONO, GERIR.name);
    const ep = new EquipaPage(page, context, DONO);
    const ficha = await ep.openMember(GERIR.name);
    await ficha.getByRole("tab", { name: "Actividade" }).click();
    const lista = ficha.getByRole("list", { name: "Actividade do membro" });
    await expect(lista).toBeVisible({ timeout: 10_000 });
    expect(await lista.getByRole("listitem").count()).toBeGreaterThan(0);
    await expect(lista.getByText("Ok").first()).toBeVisible();
  });

  test("a API recusa ao delegado a ficha/actividade de um membro que não criou (403/404, sem vazar)", async ({ request }) => {
    const { accessToken } = await login(request, GERIR.email);
    const h = { Authorization: `Bearer ${accessToken}` };
    const list = await request.get(`${API}/team`, { headers: h });
    expect(list.ok()).toBeTruthy();
    const rows = (await list.json()) as { memberId: string; name: string; canManage?: boolean }[];
    const carlos = rows.find((r) => r.name === CRIADOR.name)!;
    expect(carlos.canManage).toBe(false);
    const act = await request.get(`${API}/team/${carlos.memberId}/activity`, { headers: h });
    expect([403, 404]).toContain(act.status());
    const put = await request.put(`${API}/team/${carlos.memberId}`, { headers: h, data: { name: "Hackeado" } });
    expect([403, 404]).toContain(put.status());
  });

  test("escritas do delegado respeitam o billing: um 402 no convite mostra o toast de regularização", async ({ page, context }) => {
    await openEquipa(page, context, GERIR.email, CRIADOR.name);
    await page.route("**/team", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 402,
            contentType: "application/json",
            body: JSON.stringify({ error: "Payment Required", reason: "past_due_locked", graceEndsAt: null }),
          })
        : route.continue(),
    );
    await page.getByRole("button", { name: "Convidar utilizador" }).click();
    const invite = page.getByRole("dialog", { name: "Convidar utilizador" });
    await invite.getByLabel("Nome").fill("Sem Pagamento");
    await invite.getByLabel("Email").fill("e3-402@e2e.local");
    await invite.getByRole("checkbox", { name: "Clientes", exact: true }).check();
    await invite.getByRole("button", { name: "Enviar convite" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /regulariza o pagamento/i })).toBeVisible({ timeout: 8_000 });
    await expect(anyRow(page, "Sem Pagamento")).toHaveCount(0);
  });
});

// ═══════════════════ 4. Só Ver · 5. Sem Equipa ═══════════════════

test.describe("Fase 3 — Ver e sem Equipa", () => {
  test("só com Ver: lista de leitura (sem email, sem Convidar, linhas não abrem ficha)", async ({ page, context }) => {
    await openEquipa(page, context, VER.email, GERIR.name);
    await expect(page.getByRole("button", { name: "Convidar utilizador" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Email" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Criado por" })).toBeVisible();
    for (const nome of [GERIR.name, CRIADOR.name, VER.name]) {
      await expect(page.getByRole("row", { name: `Abrir ${nome}` })).toHaveCount(0);
    }
    await anyRow(page, GERIR.name).click();
    await anyRow(page, VER.name).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => document.body.textContent ?? "")).not.toMatch(/@e2e\.local/);
    await expect(page.getByText(/Só podes ver/)).toBeVisible();
  });

  test("a API não dá email nem permissões a quem só Vê", async ({ request }) => {
    const { accessToken } = await login(request, VER.email);
    const res = await request.get(`${API}/team`, { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).not.toMatch(/e3-gerir@|@e2e\.local/);
    expect(text).not.toContain('"grants"');
    const post = await request.post(`${API}/team`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: "X", email: "e3-x@e2e.local", grants: [{ key: "clientes.lista", level: "view" }] },
    });
    expect(post.status()).toBe(403);
  });

  test("sem o nó Equipa: não há item no menu e /equipa não abre", async ({ page, context }) => {
    await enter(page, context, SEM.email, "/perfil", async () => {
      await page.getByRole("button", { name: "Menu da conta" }).click();
      await expect(page.getByRole("menuitem", { name: "O meu perfil" })).toBeVisible({ timeout: 10_000 });
    });
    await expect(page.getByRole("menuitem", { name: "Equipa" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.goto("/equipa");
    await expect(page).not.toHaveURL(/\/equipa/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Convidar utilizador" })).toHaveCount(0);
  });

  test("a API recusa /team a quem não tem o nó (403)", async ({ request }) => {
    const { accessToken } = await login(request, SEM.email);
    const res = await request.get(`${API}/team`, { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(res.status()).toBe(403);
  });
});

// ═══════════════════ 6. Remover um criador ═══════════════════

// ═══════════════════ 6b. Fecho da fase 3 ═══════════════════

async function ownerToken(request: import("@playwright/test").APIRequestContext): Promise<string> {
  return (await login(request, DONO)).accessToken;
}

test.describe("Fase 3 — desactivado pelo dono", () => {
  test("o dono desactiva o convidado do Duarte: o Duarte não o reactiva (API 403 e UI com o motivo); o dono sim", async ({
    page,
    context,
    request,
  }) => {
    const tk = await ownerToken(request);
    const h = { Authorization: `Bearer ${tk}` };
    const list = (await (await request.get(`${API}/team`, { headers: h })).json()) as Array<{ memberId: string; name: string }>;
    const ines = list.find((m) => m.name === CONVIDADA2.name)!;
    const dis = await request.post(`${API}/team/${ines.memberId}/disable`, { headers: h });
    expect(dis.status()).toBe(200);
    expect((await dis.json()).disabledByOwner).toBe(true);

    // API: o delegado (Duarte) recebe 403 TEAM_OWNER_DISABLED.
    const duarte = await login(request, CRIADOR2.email);
    const en = await request.post(`${API}/team/${ines.memberId}/enable`, {
      headers: { Authorization: `Bearer ${duarte.accessToken}` },
    });
    expect(en.status()).toBe(403);
    expect((await en.json()).code).toBe("TEAM_OWNER_DISABLED");

    // UI: Reactivar desactivado, com o motivo visível.
    await openEquipa(page, context, CRIADOR2.email, CONVIDADA2.name);
    const ep = new EquipaPage(page, context, CRIADOR2.email);
    const ficha = await ep.openMember(CONVIDADA2.name);
    await expect(ficha.getByRole("button", { name: "Reactivar" })).toBeDisabled();
    await expect(ficha.getByTestId("owner-disabled-note")).toContainText("Foi o dono que desactivou este utilizador.");
    await ficha.getByRole("button", { name: "Fechar" }).last().click();

    // O dono reactiva sempre.
    const ok = await request.post(`${API}/team/${ines.memberId}/enable`, { headers: h });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).member.disabledByOwner).toBe(false);
  });
});

test.describe("Fase 3 — mensagens dos códigos novos", () => {
  for (const [label, status, body, text] of [
    ["TEAM_DELEGATE_LIMIT", 409, { error: "x", code: "TEAM_DELEGATE_LIMIT" }, /20 utilizadores/],
    ["429 do limite de convites", 429, { error: "Too many" }, /demasiados convites/],
  ] as const) {
    test(`convidar com ${label} mostra a mensagem em PT`, async ({ page, context }) => {
      await openEquipa(page, context, GERIR.email, CRIADOR.name);
      await page.route("**/team", (route) =>
        route.request().method() === "POST"
          ? route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
          : route.continue(),
      );
      await page.getByRole("button", { name: "Convidar utilizador" }).click();
      const invite = page.getByRole("dialog", { name: "Convidar utilizador" });
      const ep = new EquipaPage(page, context, GERIR.email);
      await ep.expand(invite, "Agenda");
      await ep.node(invite, "Calendário e marcações").check();
      await invite.getByLabel("Nome").fill("Teste Limite");
      await invite.getByLabel("Email").fill("e3-limite@e2e.local");
      await invite.getByRole("button", { name: "Enviar convite" }).click();
      await expect(page.getByText(text)).toBeVisible({ timeout: 10_000 });
    });
  }
});

test.describe("Fase 3 — motivo visível no telemóvel", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("a árvore do delegado diz 'Só podes dar o que tens' como texto, sem transbordar", async ({ page, context }) => {
    await openEquipa(page, context, GERIR.email, CRIADOR.name).catch(async () => {
      // telemóvel: as linhas são cartões — o nome continua visível
    });
    await page.getByRole("button", { name: "Convidar utilizador" }).first().click();
    const invite = page.getByRole("dialog", { name: "Convidar utilizador" });
    const nota = invite.getByTestId("tree-limit-note");
    await expect(nota).toBeVisible();
    await expect(nota).toContainText(CANNOT_GIVE);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "sem scroll horizontal a 390").toBeLessThanOrEqual(0);
    await page.screenshot({ path: "test-results/equipa-fecho-390-nota.png" });
  });
});

test.describe("Fase 3 — remover um criador", () => {
  test("o convidado passa a 'Criado por: Tu' e mantém as permissões", async ({ page, context, request }) => {
    await openEquipa(page, context, DONO, CRIADOR2.name);
    await expect(anyRow(page, CONVIDADA2.name).getByRole("cell").last()).toHaveText(CRIADOR2.name);

    const ep = new EquipaPage(page, context, DONO);
    const ficha = await ep.openMember(CRIADOR2.name);
    await ficha.getByRole("button", { name: "Remover" }).click();
    // O diálogo tem nome acessível (o título) e avisa para onde vai o convidado.
    const confirmar = page.getByRole("dialog", { name: `Remover ${CRIADOR2.name}?` });
    await expect(confirmar).toBeVisible();
    await expect(confirmar.getByTestId("remove-guests-note")).toHaveText(
      "O utilizador que este membro convidou passa para ti, com as permissões que tem.",
    );
    await confirmar.getByRole("button", { name: "Remover" }).click();
    await expect(anyRow(page, CRIADOR2.name)).toHaveCount(0, { timeout: 10_000 });

    const inesRow = anyRow(page, CONVIDADA2.name);
    await expect(inesRow).toBeVisible();
    await expect(inesRow.getByRole("cell").last()).toHaveText("Tu");
    expect(await grantsOf(request, CONVIDADA2.email), "o convidado fica com as permissões que tinha").toContain("agenda.servicos");
  });
});

// ═══════════════════ 7. Sessão de suporte e billing ═══════════════════

test.describe("Fase 3 — escritas bloqueadas", () => {
  test("billing read-only: o dono tem 'Convidar utilizador' desactivado e a ficha sem Guardar/Remover", async ({ page, context }) => {
    await page.route("**/billing/subscription**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "past_due", reason: "past_due_locked", modules: ["agenda"], monthlyTotalEur: 15, readOnly: true,
          trialEnd: null, currentPeriodEnd: null, cancelAt: null, graceEndsAt: null, hasStripeSubscription: true,
        }),
      }),
    );
    await openEquipa(page, context, DONO, GERIR.name);
    const convidar = page.getByRole("button", { name: "Convidar utilizador" });
    await expect(convidar).toBeDisabled({ timeout: 10_000 });
    await expect(convidar.locator("xpath=..")).toHaveAttribute("title", /Pagamento pendente/);
    const ep = new EquipaPage(page, context, DONO);
    const ficha = await ep.openMember(GERIR.name);
    await ficha.getByRole("tab", { name: "Permissões" }).click();
    await expect(ficha.getByRole("button", { name: "Guardar permissões" })).toBeDisabled();
  });

  test("sessão de suporte: o admin entra no tenant e todas as escritas da Equipa ficam desactivadas", async ({ page, context }) => {
    const api = await pwRequest.newContext();
    let tenantId: string;
    try {
      tenantId = (await login(api, DONO)).userId!;
    } finally {
      await api.dispose();
    }
    await loginAs(context, ADMIN);
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      await page.goto(`/suporte/entrar/${tenantId}`);
      try {
        await expect(page.getByRole("region", { name: "Sessão de suporte" })).toBeVisible({ timeout: 20_000 });
        ok = true;
      } catch {
        await loginAs(context, ADMIN);
      }
    }
    expect(ok, "a sessão de suporte abriu").toBe(true);

    await page.goto("/equipa");
    await expect(anyRow(page, GERIR.name)).toBeVisible({ timeout: 15_000 });
    const convidar = page.getByRole("button", { name: "Convidar utilizador" });
    await expect(convidar).toBeDisabled();
    // A lista continua legível e a ficha abre (leitura) mas sem nenhuma escrita.
    await anyRow(page, GERIR.name).click();
    const ficha = page.getByRole("dialog", { name: GERIR.name });
    await expect(ficha).toBeVisible();
    for (const nome of ["Guardar permissões", "Remover", "Desactivar", "Terminar sessões", "Enviar reset de password"]) {
      await expect(ficha.getByRole("button", { name: nome })).toBeDisabled();
    }
    await expect(ficha.getByLabel("Nome")).toBeDisabled();
    await expect(ficha.getByRole("checkbox", { name: "Agenda", exact: true })).toBeDisabled();
  });
});
