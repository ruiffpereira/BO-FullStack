import type { Page } from "@playwright/test";

/**
 * Força campos da resposta de `GET /cms/site-builder` (o resto é a resposta REAL). Serve para estados que a API de e2e
 * não consegue produzir: o Coolify não existe (e o job de 10 s não corre com ENVIRONMENT=TEST) e não há armazenamento
 * de ficheiros (`SEAWEEDFS_*` vazio) para a API aceitar uma `shareImage`.
 *
 * `state.patch` pode mudar a meio do teste; `null` deixa passar a resposta real. Aplica-se a leituras a seguir ao
 * recarregamento (ou ao polling de 5 s do editor enquanto há deploy).
 */
export async function patchSiteBuilder(page: Page): Promise<{ patch: Record<string, unknown> | null }> {
  const state: { patch: Record<string, unknown> | null } = { patch: null };
  await page.route(/\/cms\/site-builder$/, async (route) => {
    if (route.request().method() !== "GET" || !state.patch) return route.continue();
    try {
      const res = await route.fetch();
      const body = await res.json();
      await route.fulfill({ response: res, json: { ...body, ...state.patch } });
    } catch {
      // Uma leitura em voo quando o teste acaba (o editor repete-a a cada 5 s): a página já está a fechar.
      await route.abort().catch(() => undefined);
    }
  });
  return state;
}
