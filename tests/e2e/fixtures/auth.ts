import { test as base, expect } from "@playwright/test";
import { nextClientIp } from "./login";

const USER = process.env.TEST_USER ?? "admin";
const PASS = process.env.TEST_PASSWORD ?? "";
const API = process.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

/**
 * Fixture de autenticação para os specs que precisam de sessão de backoffice.
 *
 * Faz login fresco POR TESTE via API (cada teste tem o seu próprio contexto e
 * refresh token). Isto é necessário porque a API roda os refresh tokens
 * (`rotateRefreshToken`) e o AuthContext faz refresh no arranque de cada página:
 * um `storageState` estático partilhado invalidaria todos os testes após o
 * primeiro (o primeiro refresh rotaciona o cookie e mata os restantes). Login por
 * teste dá isolamento total e não esbarra no rate limit (isento em dev).
 *
 * Os specs `auth`/`security` correm de propósito SEM auth e o `errors` intercepta
 * a API — esses continuam a importar de `@playwright/test`.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    // `context.request` partilha o cookie jar com as páginas → o refresh cookie
    // do login fica disponível e a app autentica no arranque (faz o refresh/CSRF).
    const res = await context.request.post(`${API}/users/login`, {
      data: { username: USER, password: PASS },
      headers: { "CF-Connecting-IP": nextClientIp() },
    });
    if (!res.ok()) {
      throw new Error(
        `Login e2e falhou (${res.status()}). Verifica TEST_USER/TEST_PASSWORD em .env.test e a API em ${API}.`,
      );
    }
    await use(context);
  },
});

export { expect };
