import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { loginAs, E2E_PASSWORD } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";
import { LoginPage } from "./pages/LoginPage";
import { AdminPage } from "./pages/AdminPage";

// B41 · fase 1 — Equipa do tenant por módulo.
// Tenant semeado: "Barbearia Navalha" (equipa@e2e.local, não-admin: Agenda + Clientes + Loja + Despesas) com
// dois membros — Ana Membro (activa: agenda ver · clientes editar) e Rui Convidado (convidado, token fixo).
// Os testes correm em série e na ordem: os que só lêem vêm antes dos que mudam o estado dos membros semeados.
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const DONO = "equipa@e2e.local";
const MEMBRO = "membro@e2e.local";
const MEMBRO_NOME = "Ana Membro";
const TENANT = "Barbearia Navalha";
const CONVIDADO_TOKEN = "e2e-member-setup-token-0001";

const nav = (page: Page) => page.locator("nav").first();
const navBtn = (page: Page, name: string) => nav(page).getByRole("button", { name, exact: true });

async function abrirEquipa(page: Page, context: BrowserContext) {
  await withSessionRetry(
    page,
    context,
    DONO,
    () => page.goto("/perfil"),
    async () => {
      await page.getByRole("button", { name: "Menu da conta" }).click();
      await page.getByRole("menuitem", { name: "Equipa" }).click();
      await expect(page).toHaveURL(/\/equipa$/);
      await expect(page.getByRole("row", { name: `Abrir ${MEMBRO_NOME}` })).toBeVisible({ timeout: 10_000 });
    },
  );
}

const linha = (page: Page, nome: string) => page.getByRole("row", { name: `Abrir ${nome}` });

test.describe("Equipa — o dono do tenant", () => {
  test("o menu do avatar tem 'Equipa' e a lista mostra nome, email, estado e último acesso", async ({ page, context }) => {
    await loginAs(context, DONO);
    await abrirEquipa(page, context);

    const ana = linha(page, MEMBRO_NOME);
    await expect(ana).toContainText("membro@e2e.local");
    await expect(ana).toContainText("Activo");
    const rui = linha(page, "Rui Convidado");
    await expect(rui).toContainText("Convidado");
    await expect(rui).toContainText("Nunca");
  });

  test("convida, edita as permissões, desactiva, reactiva e remove (com confirmação)", async ({ page, context }) => {
    await loginAs(context, DONO);
    await abrirEquipa(page, context);

    // Convidar: nome, email e árvore — o tenant não tem Ginásio, Conteúdos nem Páginas: esses módulos nem aparecem.
    await page.getByRole("button", { name: "Convidar utilizador" }).click();
    const invite = page.getByRole("dialog", { name: "Convidar utilizador" });
    await expect(invite.getByRole("radio", { name: /Escolher na árvore/ })).toBeChecked();
    await expect(invite.getByRole("checkbox", { name: "Agenda", exact: true })).toBeVisible();
    for (const name of ["Ginásio", "Conteúdos", "Páginas"]) {
      await expect(invite.getByRole("checkbox", { name, exact: true })).toHaveCount(0);
    }
    await invite.getByLabel("Nome").fill("Marta Recepção");
    await invite.getByLabel("Email").fill("marta.recepcao@e2e.local");
    await invite.getByRole("checkbox", { name: "Agenda", exact: true }).check(); // marca o ramo inteiro (ao máximo)
    await expect(invite.getByText("7 de 7")).toBeVisible();
    await invite.getByRole("checkbox", { name: "Estatísticas do site" }).check();
    await expect(invite.getByText("Só ver")).toBeVisible(); // nó só-leitura: sem [Ver | Editar]
    await invite.getByRole("button", { name: "Enviar convite" }).click();

    const marta = linha(page, "Marta Recepção");
    await expect(marta).toBeVisible({ timeout: 10_000 });
    await expect(marta).toContainText("Convidado");

    // Ficha: baixa "Serviços" a só ver e junta Clientes (abre o topo Agenda pelo chevron).
    await marta.click();
    const ficha = page.getByRole("dialog", { name: "Marta Recepção" });
    await ficha.getByRole("button", { name: "Abrir Agenda" }).click();
    await expect(ficha.getByRole("tab", { name: "Serviços: editar", selected: true })).toBeVisible();
    const guardar = ficha.getByRole("button", { name: "Guardar permissões" });
    await expect(guardar).toBeDisabled(); // nada mudou
    await ficha.getByRole("tab", { name: "Serviços: só ver" }).click();
    await ficha.getByRole("checkbox", { name: "Clientes", exact: true }).check();
    await expect(guardar).toBeEnabled();
    await guardar.click();
    await expect(guardar).toBeDisabled({ timeout: 10_000 }); // gravou: o formulário volta a estar limpo
    await ficha.getByRole("button", { name: "Fechar" }).last().click(); // o do rodapé (o outro é o X)

    // Reabrir confirma o que ficou gravado.
    await marta.click();
    const ficha2 = page.getByRole("dialog", { name: "Marta Recepção" });
    await ficha2.getByRole("button", { name: "Abrir Agenda" }).click();
    await expect(ficha2.getByRole("tab", { name: "Serviços: só ver", selected: true })).toBeVisible();
    await expect(ficha2.getByRole("tab", { name: "Horário e configurações: editar", selected: true })).toBeVisible();
    await expect(ficha2.getByRole("checkbox", { name: "Clientes", exact: true })).toBeChecked();

    // Convidado: reenviar convite existe; reset de password não.
    await expect(ficha2.getByRole("button", { name: /Reenviar convite/ })).toBeVisible();
    await expect(ficha2.getByRole("button", { name: /Enviar reset de password/ })).toHaveCount(0);

    // Desactivar → "Desactivado"; Reactivar → volta.
    await ficha2.getByRole("button", { name: /Desactivar/ }).click();
    await expect(ficha2.getByText("Desactivado")).toBeVisible({ timeout: 10_000 });
    await ficha2.getByRole("button", { name: /Reactivar/ }).click();
    await expect(ficha2.getByText("Convidado")).toBeVisible({ timeout: 10_000 });

    // Remover pede confirmação.
    await ficha2.getByRole("button", { name: "Remover" }).click();
    await expect(page.getByText("Remover Marta Recepção?")).toBeVisible();
    await page.getByRole("button", { name: "Remover" }).last().click();
    await expect(linha(page, "Marta Recepção")).toHaveCount(0, { timeout: 10_000 });
  });

  test("convidar um email já usado mostra o erro em PT", async ({ page, context }) => {
    await loginAs(context, DONO);
    await abrirEquipa(page, context);

    await page.getByRole("button", { name: "Convidar utilizador" }).click();
    const invite = page.getByRole("dialog", { name: "Convidar utilizador" });
    await invite.getByLabel("Nome").fill("Duplicado");
    await invite.getByLabel("Email").fill(MEMBRO);
    await invite.getByRole("checkbox", { name: "Agenda", exact: true }).check();
    await invite.getByRole("button", { name: "Enviar convite" }).click();
    await expect(page.getByText(/já está a ser usado/)).toBeVisible({ timeout: 10_000 });
  });

  test("a conta admin não tem Equipa: sem item no menu e /equipa é expulso", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    await withSessionRetry(
      page,
      context,
      "admin@e2e",
      () => page.goto("/equipa"),
      async () => {
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
        await page.getByRole("button", { name: "Menu da conta" }).click();
        await expect(page.getByRole("menuitem", { name: "O meu perfil" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Equipa" })).toHaveCount(0);
      },
    );
  });
});

test.describe("Equipa — Admin → Utilizadores", () => {
  test("coluna 'Equipa' com o nº de membros e acção 'Equipa' só de leitura", async ({ page, context }) => {
    await loginAs(context, "admin@e2e");
    await withSessionRetry(
      page,
      context,
      "admin@e2e",
      () => page.goto("/admin"),
      async () => {
        await expect(page.getByRole("columnheader", { name: "Equipa" })).toBeVisible({ timeout: 10_000 });
        // A lista pagina client-side (10/página): procura a linha do tenant desde a 1.ª página.
        const row = await new AdminPage(page).userRowFromStart("equipa@e2e.local");
        // 3 membros no seed: Ana (activa), Rui (convidado) e Mário (`meus@e2e.local`, «Só os meus» — R6.0).
        await expect(row.getByTestId("team-count")).toHaveText("3");
        await row.getByRole("button", { name: `Equipa de ${TENANT}` }).click();
      },
    );
    const dialog = page.getByRole("dialog", { name: "Equipa" });
    await expect(dialog).toContainText(MEMBRO_NOME);
    await expect(dialog).toContainText("membro@e2e.local");
    await expect(dialog).toContainText("Rui Convidado");
    await expect(dialog).toContainText("Mário Pessoal");
    await expect(dialog).toContainText("Convidado");
    // só leitura: nada para guardar/remover
    await expect(dialog.getByRole("button", { name: /Guardar|Remover|Desactivar/ })).toHaveCount(0);
  });
});

test.describe("Equipa — o membro", () => {
  test("vê só Agenda e Clientes, sem Dashboard/Financeiro/Loja/Faturação, e o topo diz quem é", async ({ page, context }) => {
    await loginAs(context, MEMBRO);
    await withSessionRetry(
      page,
      context,
      MEMBRO,
      () => page.goto("/"),
      async () => {
        // O Dashboard não existe para um membro: aterra no 1.º módulo que tem.
        await expect(page).toHaveURL(/\/clientes/, { timeout: 10_000 });
        await expect(navBtn(page, "Clientes")).toBeVisible();
        await expect(navBtn(page, "Agenda")).toBeVisible();
        for (const hidden of ["Dashboard", "Financeiro", "Loja", "Faturação", "Estatísticas", "Mensagens", "Conteúdos", "Páginas", "Admin", "Ginásio"]) {
          await expect(navBtn(page, hidden)).toHaveCount(0);
        }
        await expect(page.getByTestId("member-identity")).toHaveText(`${MEMBRO_NOME} · equipa de ${TENANT}`);
        // Com sino desde a 2c (notificações por folha) mas sem atalho de mensagens (não tem o módulo).
        await expect(page.getByRole("button", { name: /notifica/i })).toBeVisible();
        await expect(page.getByRole("button", { name: /^Mensagens/ })).toHaveCount(0);
      },
    );
  });

  test("Agenda só para ver: o CTA de escrita está desactivado com 'Só tens permissão para ver'; nos Clientes (editar) não", async ({ page, context }) => {
    await loginAs(context, MEMBRO);
    await withSessionRetry(
      page,
      context,
      MEMBRO,
      () => page.goto("/agenda"),
      async () => {
        const nova = page.getByRole("button", { name: "Nova marcação" });
        await expect(nova).toBeVisible({ timeout: 10_000 });
        await expect(nova).toBeDisabled();
        await expect(nova.locator("xpath=..")).toHaveAttribute("title", "Só tens permissão para ver");
      },
    );
    // O calendário continua legível: a marcação semeada abre a ficha, mas não se grava nada.
    await page.goto("/agenda/servicos");
    await expect(page.getByRole("button", { name: "Novo serviço" })).toBeDisabled({ timeout: 10_000 });

    await page.goto("/clientes");
    await expect(page.getByRole("button", { name: "Novo cliente" })).toBeEnabled({ timeout: 10_000 });
  });

  test("deep-links fora do que tem são expulsos para o 1.º módulo (/loja, /faturacao, /dashboard, /equipa, /admin)", async ({ page, context }) => {
    await loginAs(context, MEMBRO);
    await withSessionRetry(
      page,
      context,
      MEMBRO,
      () => page.goto("/loja"),
      async () => {
        // O pathname de partida (/loja) não é o de chegada: o toHaveURL só passa depois do guard redirigir.
        await expect(page).toHaveURL(/\/clientes/, { timeout: 10_000 });
      },
    );
    for (const route of ["/faturacao", "/dashboard", "/equipa", "/admin", "/financeiro", "/estatisticas"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/clientes/, { timeout: 10_000 });
    }
    // O que tem continua acessível.
    await page.goto("/agenda");
    await expect(page).toHaveURL(/\/agenda/);
  });

  test("não pede nada que a API recusa a um membro (billing, notificações, SSE, push, /users/me): zero 403", async ({ page, context }) => {
    const forbidden: string[] = [];
    page.on("response", (res) => {
      if (res.status() === 403) forbidden.push(`${res.status()} ${res.url()}`);
    });
    await loginAs(context, MEMBRO);
    await withSessionRetry(
      page,
      context,
      MEMBRO,
      () => page.goto("/"),
      async () => {
        await expect(page).toHaveURL(/\/clientes/, { timeout: 10_000 });
      },
    );
    for (const route of ["/agenda", "/agenda/marcacoes", "/clientes", "/perfil", "/loja", "/faturacao"]) {
      await page.goto(route);
      await page.waitForTimeout(1_200);
    }
    expect(forbidden, `403 inesperados:\n${forbidden.join("\n")}`).toEqual([]);
  });

  test("Perfil do membro: só nome, password e tema — nada de negócio, faturação nem acesso de suporte", async ({ page, context }) => {
    await loginAs(context, MEMBRO);
    await withSessionRetry(
      page,
      context,
      MEMBRO,
      () => page.goto("/perfil"),
      async () => {
        await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(MEMBRO_NOME, { timeout: 10_000 });
        await expect(page.getByLabel("Email")).toBeDisabled();
        await expect(page.getByText("Password atual")).toBeVisible();
        await expect(page.getByRole("tab", { name: "Claro" })).toBeVisible();
        await expect(page.getByRole("tab", { name: "Escuro" })).toBeVisible();
        for (const absent of ["Logótipo", "Telefone", "Acesso de suporte", "Nome do negócio", "Língua padrão"]) {
          await expect(page.getByText(absent)).toHaveCount(0);
        }
      },
    );
  });

  test("entra pelo ecrã de login normal (a mesma porta do dono)", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.waitForLoginForm();
    await login.login(MEMBRO, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/clientes/, { timeout: 15_000 });
    await expect(page.getByTestId("member-identity")).toBeVisible();
  });

  test("convidado: define a password no /setup-password, entra e vê só a Agenda", async ({ page, context }) => {
    await page.goto(`/setup-password?token=${CONVIDADO_TOKEN}`);
    const pw = page.locator('input[type="password"]');
    await expect(pw.first()).toBeVisible({ timeout: 10_000 });
    await pw.first().fill("NovaPass123!");
    await pw.nth(1).fill("NovaPass123!");
    await page.getByRole("button", { name: /definir password/i }).click();
    await expect(page.getByText("Password definida!")).toBeVisible({ timeout: 10_000 });

    await loginAs(context, "convidado@e2e.local", "NovaPass123!");
    await withSessionRetry(
      page,
      context,
      "convidado@e2e.local",
      () => page.goto("/"),
      async () => {
        await expect(page).toHaveURL(/\/agenda/, { timeout: 10_000 });
        await expect(navBtn(page, "Agenda")).toBeVisible();
        await expect(navBtn(page, "Clientes")).toHaveCount(0);
      },
    );
  });
});

test.describe("Equipa — desactivar mata a sessão", () => {
  test("o dono desactiva a Ana e o pedido seguinte dela já não tem sessão; reactivar devolve o acesso", async ({ browser }) => {
    const ctxDono = await browser.newContext();
    const ctxMembro = await browser.newContext();
    try {
      const dono = await ctxDono.newPage();
      const membro = await ctxMembro.newPage();

      await loginAs(ctxMembro, MEMBRO);
      await membro.goto("/agenda");
      await expect(navBtn(membro, "Agenda")).toBeVisible({ timeout: 10_000 });

      await loginAs(ctxDono, DONO);
      await dono.goto("/equipa");
      await linha(dono, MEMBRO_NOME).click();
      const ficha = dono.getByRole("dialog", { name: MEMBRO_NOME });
      await ficha.getByRole("button", { name: /Desactivar/ }).click();
      await expect(ficha.getByText("Desactivado")).toBeVisible({ timeout: 10_000 });

      // O membro tenta usar a app: o token morreu e o refresh também → ecrã de login.
      await membro.reload();
      await expect(membro.getByRole("button", { name: "Entrar" })).toBeVisible({ timeout: 15_000 });
      // …e não consegue voltar a entrar com a password certa.
      const login = new LoginPage(membro);
      await login.waitForLoginForm();
      await login.login(MEMBRO, E2E_PASSWORD);
      await expect(membro.getByRole("button", { name: "Entrar" })).toBeVisible();

      // Reactivar (limpa o estado do seed para quem vier a seguir).
      await ficha.getByRole("button", { name: /Reactivar/ }).click();
      await expect(ficha.getByText("Activo")).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctxDono.close();
      await ctxMembro.close();
    }
  });
});
