import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { API, E2E_PASSWORD, loginAs, nextClientIp } from "./login";

/**
 * Sessão de suporte («Entrar como») para os specs do construtor de páginas: o tenant dá o consentimento, o admin
 * abre o separador de suporte. Partilhado por `paginas-definicoes`, `paginas-migrar`, `paginas-publicacao`.
 */

export const ADMIN = "admin@e2e";

/** Login por API (sessão isolada do browser): devolve o token e o id do tenant. */
export async function apiLogin(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/users/login`, {
    data: { username: email, password: E2E_PASSWORD },
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login de ${email} falhou (${res.status()})`).toBeTruthy();
  const body = await res.json();
  return { headers: { Authorization: `Bearer ${body.accessToken as string}` }, userId: body.userId as string };
}

/** O tenant dá consentimento ao suporte (como no Perfil) para o admin poder entrar. */
export async function grantSupportAccess(request: APIRequestContext, email: string) {
  const { headers, userId } = await apiLogin(request, email);
  const res = await request.put(`${API}/users/me/support-access`, { headers, data: { days: 7 } });
  expect(res.ok(), `consentimento de ${email}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return { headers, userId };
}

/** Abre o separador de suporte (como o «Entrar como»); reautentica o admin e repete se a sessão cair sob carga. */
export async function openSupportTab(context: BrowserContext, userId: string): Promise<Page> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const page = await context.newPage();
    await page.goto(`/suporte/entrar/${userId}`);
    try {
      await expect(page.getByRole("region", { name: "Sessão de suporte" })).toBeVisible({ timeout: 20_000 });
      return page;
    } catch (err) {
      lastErr = err;
      await page.close();
      await loginAs(context, ADMIN);
    }
  }
  throw lastErr;
}
