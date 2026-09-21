import { type BrowserContext, type Page, expect } from "@playwright/test";
import { loginAs } from "./login";

/**
 * Mitigação partilhada para a corrida diagnosticada em `doRefresh`
 * (`src/context/AuthContext.tsx`, ~284-337): no arranque a app faz TRÊS
 * chamadas em série — `GET /csrf-token` → `POST /users/refresh` →
 * `GET /userpermissions` — cada uma com o seu timeout de 5s
 * (`AUTH_REQUEST_TIMEOUT_MS`). Se qualquer uma atrasar sob carga, o `catch`
 * desliga `initializing` sem `isAuthenticated`, e o `App.tsx` renderiza o
 * ecrã de Login público em vez da rota pedida. Não é preciso rotação de
 * refresh token — um timeout chega. Ver docs/ARMADILHAS.md → "Testes e2e".
 *
 * Este ficheiro extrai o padrão que já existia (isolado) dentro do
 * `expectBlockedRedirect` do `rbac-matriz.spec.ts`, para ser reutilizável em
 * qualquer navegação + asserção, não só em "confirma o redirect do guard".
 */

const LOGIN_BUTTON_NAME = "Entrar";
const MAX_ATTEMPTS = 4;
// Tempo dado ao guard/refresh estabilizarem antes de decidir se a app caiu no
// ecrã de Login. Não é um "aguenta e torce": é a janela mínima para a app
// ultrapassar a corrida (o pior caso são as 3 chamadas em série do doRefresh,
// que normalmente resolvem em bem menos que isto sob carga de teste) antes de
// decidirmos se vale a pena reautenticar.
const SETTLE_MS = 1_500;

async function isOnLoginScreen(page: Page): Promise<boolean> {
  return page
    .getByRole("button", { name: LOGIN_BUTTON_NAME })
    .isVisible()
    .catch(() => false);
}

/**
 * Corre `navigate` (goto/reload/o que for preciso para chegar ao estado a
 * testar) e, depois de dar tempo ao guard/refresh estabilizarem, verifica se
 * a app caiu no ecrã de Login público. Se caiu, reautentica `user` (via API —
 * cookie de refresh novo no jar partilhado do `context`) e repete `navigate`,
 * até `MAX_ATTEMPTS`.
 *
 * A app pode cair no ecrã de Login em dois momentos distintos, e este helper
 * cobre os dois: (1) logo a seguir a `navigate` (apanhado pela verificação
 * antes de `assertion` correr) — ou (2) só DEPOIS do `SETTLE_MS`, a meio da
 * janela de timeout da própria `assertion` (o pior caso das 3 chamadas em
 * série do `doRefresh` é bem mais lento que `SETTLE_MS`). Por isso, se
 * `assertion` falhar, verifica-se de novo o ecrã antes de desistir: só nesse
 * caso se reautentica e repete; qualquer outra falha (sessão viva) propaga-se
 * imediatamente — nunca fica mascarada nem enfraquecida.
 *
 * Serve tanto para "navegar e confirmar redirect" (ver `expectBlockedRedirect`
 * abaixo) como para "navegar e confirmar conteúdo autenticado" (sidebar,
 * página de módulo, formulários, etc.).
 */
export async function withSessionRetry(
  page: Page,
  context: BrowserContext,
  user: string,
  // `Promise<unknown>` (não `Promise<void>`): aceita `() => page.goto(...)`/
  // `() => page.reload()` directamente, que devolvem `Promise<Response | null>`.
  navigate: () => Promise<unknown>,
  assertion: () => Promise<void>,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await navigate();
    await page.waitForTimeout(SETTLE_MS);
    if (await isOnLoginScreen(page)) {
      // Sessão caiu por corrida do doRefresh em série (timeout sob carga) →
      // reautentica e repete a navegação do zero.
      await loginAs(context, user);
      continue;
    }
    try {
      await assertion();
      return;
    } catch (err) {
      const isLastAttempt = attempt === MAX_ATTEMPTS - 1;
      // A queda pode ter acontecido DEPOIS do check acima, a meio da janela
      // de timeout da própria `assertion` — reconfirma antes de desistir.
      if (isLastAttempt || !(await isOnLoginScreen(page))) throw err;
      await loginAs(context, user);
    }
  }
  throw new Error(
    `Sessão de ${user} caiu repetidamente (timeout do doRefresh em série no AuthContext).`,
  );
}

/**
 * Navega para uma rota bloqueada e confirma que o guard redireciona para
 * /dashboard. Usa `withSessionRetry` — nunca enfraquece o assert: a rota
 * bloqueada TEM MESMO de acabar em /dashboard com sessão válida.
 */
export async function expectBlockedRedirect(
  page: Page,
  context: BrowserContext,
  user: string,
  route: string,
): Promise<void> {
  await withSessionRetry(
    page,
    context,
    user,
    () => page.goto(route),
    () =>
      expect(page, `${user} não devia poder ficar em ${route}`).toHaveURL(/\/dashboard/, {
        timeout: 15_000,
      }),
  );
}
