import { test, expect } from "./fixtures/auth";
import { DEFAULT_TEST_USER } from "./fixtures/login";
import { withSessionRetry } from "./fixtures/session";

/**
 * /perfil (T3.3, `.design/shell-nav-perfil/`) + menu do avatar no topbar.
 *
 * IMPORTANTE: `admin@e2e` é o utilizador seeded partilhado por praticamente
 * todos os outros specs (login via `./fixtures/auth`, `TEST_USER=admin@e2e`
 * por omissão) — e o campo "Nome do negócio" (`Users.name`) É o identificador
 * de login (`username`). Por isso o teste de persistência abaixo edita o
 * campo **"Telefone"** (`Users.phone`), não o nome: `phone` não é usado por
 * `loginAs`/login nenhum, por isso mesmo que o restore no `finally` falhe
 * (ex.: timeout do toast), a sessão de "admin@e2e" nunca fica envenenada para
 * os specs seguintes (rbac, isolamento, etc. — correm em serial, um nome
 * alterado aqui deixava-os todos a levar 401).
 *
 * Cada navegação completa (`goto`/`reload`) passa por `withSessionRetry`
 * (fixtures/session.ts): é aí que o AuthContext remonta e pode cair no ecrã
 * de Login sob carga (doRefresh, 3 chamadas em série — ver ARMADILHAS).
 */
test.describe("Perfil — menu do avatar", () => {
  test("abrir o menu do avatar navega para /perfil", async ({ page, context }) => {
    await withSessionRetry(
      page,
      context,
      DEFAULT_TEST_USER,
      () => page.goto("/dashboard"),
      async () => {
        await page
          .waitForSelector(".animate-spin", { state: "detached", timeout: 10_000 })
          .catch(() => {});
        await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible({ timeout: 10_000 });
      },
    );

    await page.getByRole("button", { name: "Menu da conta" }).click();
    await expect(page.getByRole("menu", { name: "Conta" })).toBeVisible({ timeout: 5_000 });

    await page.getByRole("menuitem", { name: "O meu perfil" }).click();
    await expect(page).toHaveURL(/\/perfil/);
    // Título só existe no topbar (h2, Shell.tsx) — a página já não tem h1 próprio.
    await expect(page.getByRole("heading", { name: "Perfil", level: 2 })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Esc fecha o menu do avatar", async ({ page, context }) => {
    await withSessionRetry(
      page,
      context,
      DEFAULT_TEST_USER,
      () => page.goto("/dashboard"),
      async () => {
        await page
          .waitForSelector(".animate-spin", { state: "detached", timeout: 10_000 })
          .catch(() => {});
        await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible({ timeout: 10_000 });
      },
    );

    await page.getByRole("button", { name: "Menu da conta" }).click();
    await expect(page.getByRole("menu", { name: "Conta" })).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "Conta" })).toHaveCount(0);
  });
});

test.describe("Perfil — Conta", () => {
  test("editar o telefone e guardar persiste (reload mantém o valor novo)", async ({ page, context }) => {
    const phoneInput = page.getByLabel("Telefone");
    await withSessionRetry(
      page,
      context,
      DEFAULT_TEST_USER,
      () => page.goto("/perfil"),
      async () => {
        await expect(phoneInput).toBeVisible({ timeout: 10_000 });

        // Esperar que o formulário esteja SEMEADO pelo `GET /users/me` antes de
        // escrever. Sem isto o teste era intermitente no CI (falhou em commits que
        // só mexiam em documentação, o que denunciou a corrida): preenchia-se o
        // telefone, a resposta chegava depois e re-semeava o estado do formulário,
        // o `dirty` voltava a falso e o `Guardar` — que é `disabled={!dirty}` —
        // ficava desactivado para sempre. O sintoma era "14 × locator resolved to
        // <button disabled>". Isto está agora corrigido em `ContaCard`
        // (`src/pages/Perfil.tsx`, flag `touched`) — ver
        // "uma edição de telefone em curso sobrevive..." abaixo, que prova a
        // regressão directamente. Mantemos aqui a espera pelo sentinela de email
        // na mesma: é barata e documenta a precondição que o teste assume.
        //
        // O email serve de sentinela porque um tenant tem sempre email; o telefone
        // pode legitimamente vir vazio, por isso não dá para esperar por ele.
        await expect(page.getByLabel("Email")).not.toHaveValue("", { timeout: 10_000 });
      },
    );

    const original = await phoneInput.inputValue();
    const novoTelefone = "+351 912 345 678";

    // exact:true — sem isto "Guardar" também casa com "Guardar logótipo"
    // (Playwright faz substring match por omissão no `name` do getByRole).
    //
    // O `try`/`finally` original apanhava qualquer erro do `finally` (o
    // restore do telefone) e deixava-o SUBSTITUIR o erro do `try` — em JS o
    // erro do `finally` ganha sempre ao do `try`. Foi assim que o CI mostrou
    // a asserção do restore (linha ~49 à data) como "a falha", quando a causa
    // real estava na escrita original. Aqui: o restore corre sempre, mas só
    // pode lançar se o `try` não tiver já falhado — e mesmo assim o erro do
    // `try` é o que se propaga.
    let tryError: unknown;
    try {
      await phoneInput.fill(novoTelefone);
      const saveBtn = page.getByRole("button", { name: "Guardar", exact: true });
      await expect(saveBtn).toBeEnabled();
      await saveBtn.click();
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 8_000 });

      // Persistência real: recarrega a página (novo GET /users/me) e confirma
      // que o telefone novo veio da API, não só do estado local do formulário.
      // O reload é outro ponto onde o AuthContext remonta — mesmo helper.
      await withSessionRetry(
        page,
        context,
        DEFAULT_TEST_USER,
        () => page.reload(),
        () =>
          expect(page.getByLabel("Telefone")).toHaveValue(novoTelefone, {
            timeout: 10_000,
          }),
      );
    } catch (err) {
      tryError = err;
    }

    try {
      await page.getByLabel("Telefone").fill(original);
      const saveBtn = page.getByRole("button", { name: "Guardar", exact: true });
      await expect(saveBtn).toBeEnabled();
      await saveBtn.click();
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 8_000 });
    } catch (restoreErr) {
      // A causa real (se houver) é sempre a do `try` — o restore a falhar
      // depois de o teste já estar condenado não é a informação útil aqui.
      throw tryError ?? restoreErr;
    }

    if (tryError) throw tryError;
  });

  test("uma edição de telefone em curso sobrevive a uma resposta tardia de GET /users/me", async ({
    page,
    context,
  }) => {
    // Regressão do bug apanhado por `perfil-*chromium-retry1/test-failed-1.png`
    // no CI: `ContaCard` (src/pages/Perfil.tsx) re-semeava name/email/phone
    // sempre que `GET /users/me` devolvia valores — mesmo a meio de uma
    // edição por guardar. Um refetch em BACKGROUND (outro observer da mesma
    // query, uma invalidação disparada de outro cartão, um reconnect) que
    // aterrasse depois de o utilizador escrever apagava o que tinha sido
    // escrito: o campo voltava ao valor do servidor e, como o `dirty`
    // comparava com esse mesmo valor, o "Guardar" ficava desactivado.
    //
    // Aqui força-se um refetch DETERMINÍSTICO (sem depender de uma corrida
    // real sob carga): o `onlineManager` do React Query só notifica os
    // observers numa transição efectiva de estado, por isso disparamos
    // "offline" seguido de "online" — o `refetchOnReconnect` (default `true`,
    // nunca desligado em `src/lib/queryClient.ts`) trata do resto. A resposta
    // a essa chamada é intercetada para simular "o valor mudou nesse
    // instante" (ex.: outra sessão/aba) com um valor por si distinto do
    // original E do que está a ser escrito — só assim há mesmo uma mudança de
    // valor a testar o guard (uma resposta IDÊNTICA à já cacheada nunca
    // dispara o efeito de sincronização, com ou sem o bug).
    const phoneInput = page.getByLabel("Telefone");
    await withSessionRetry(
      page,
      context,
      DEFAULT_TEST_USER,
      () => page.goto("/perfil"),
      async () => {
        await expect(phoneInput).toBeVisible({ timeout: 10_000 });
        await expect(page.getByLabel("Email")).not.toHaveValue("", { timeout: 10_000 });
      },
    );

    const novoTelefone = "+351 917 000 111";
    const telefoneDeOutraSessao = "+351 900 111 222";

    // Canário: um campo que o `PreferenciasCard` (intocado por este fix)
    // continua SEMPRE a re-semear a partir de `data.uiTheme`, sem guarda
    // nenhuma. Ao vir na MESMA resposta que traz `telefoneDeOutraSessao`,
    // dá um sinal observável e inequívoco de que a resposta já foi
    // processada pelo React (mesmo `data`, mesma actualização da query) —
    // sem isto não há como esperar deterministicamente por "nada mudou"
    // (o campo continuar com `novoTelefone` é ambíguo: tanto pode ser
    // porque a resposta ainda não chegou, como porque chegou e o guard
    // funcionou).
    const escuroActivo =
      (await page.getByRole("tab", { name: "Escuro" }).getAttribute("aria-selected")) === "true";
    const canaryTheme = escuroActivo ? "light" : "dark";
    const canaryLabel = escuroActivo ? "Claro" : "Escuro";

    let backgroundRequestFulfilled = false;
    await page.route("**/users/me", async (route) => {
      if (route.request().method() !== "GET" || backgroundRequestFulfilled) {
        return route.continue();
      }
      backgroundRequestFulfilled = true;
      const real = await route.fetch();
      const body = await real.json();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...body, phone: telefoneDeOutraSessao, uiTheme: canaryTheme }),
      });
    });

    // Começa a editar — SEM guardar.
    await phoneInput.fill(novoTelefone);
    await expect(phoneInput).toHaveValue(novoTelefone);

    // Força o refetch em segundo plano a meio da edição.
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    });
    await expect.poll(() => backgroundRequestFulfilled, { timeout: 10_000 }).toBe(true);

    // Sincroniza pelo canário — só depois disto é que a resposta está mesmo
    // reflectida no formulário (evita a corrida entre "ainda não chegou" e
    // "chegou e o guard funcionou").
    await expect(page.getByRole("tab", { name: canaryLabel })).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 10_000 },
    );

    // A edição em curso tem de sobreviver: nem o campo nem o botão podem ter
    // sido repostos pela resposta em segundo plano (nem para o valor
    // "de outra sessão", nem para o original).
    await expect(phoneInput).toHaveValue(novoTelefone);
    await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeEnabled();

    await page.unroute("**/users/me");
  });
});
