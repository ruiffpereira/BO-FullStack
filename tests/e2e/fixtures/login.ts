import { type BrowserContext, expect } from "@playwright/test";

export const E2E_PASSWORD = "E2ePass123!";

const API = process.env.VITE_API_BASE_URL ?? "http://localhost:3002/api";

/**
 * Cada login usa um IP fictício único no header `CF-Connecting-IP` (que a API lê
 * como IP do cliente para o rate limit). No CI, todos os testes correm do MESMO IP
 * real → os muitos logins da suite colidiam no rate limit por IP do login (429).
 * Dar um IP diferente a cada login torna-os independentes. Não afeta produção
 * (lá o header vem da Cloudflare com o IP real).
 */
let ipCounter = 0;
export function nextClientIp(): string {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

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
    headers: { "CF-Connecting-IP": nextClientIp() },
  });
  expect(res.ok(), `login e2e de "${username}" falhou (${res.status()})`).toBeTruthy();
}
