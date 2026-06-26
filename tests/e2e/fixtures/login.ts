import { type BrowserContext, expect } from "@playwright/test";

export const E2E_PASSWORD = "E2ePass123!";

const API = process.env.VITE_API_BASE_URL ?? "http://localhost:3002/api";

/**
 * Autentica um tenant específico (semeado em scripts/seedE2e.ts) no contexto do
 * teste, via API. O cookie de refresh fica no jar partilhado → ao navegar, a app
 * autentica no arranque. Usar com `test.use({ storageState: vazio })`.
 */
export async function loginAs(
  context: BrowserContext,
  username: string,
  password: string = E2E_PASSWORD,
): Promise<void> {
  const res = await context.request.post(`${API}/users/login`, {
    data: { username, password },
  });
  expect(res.ok(), `login e2e de "${username}" falhou (${res.status()})`).toBeTruthy();
}
