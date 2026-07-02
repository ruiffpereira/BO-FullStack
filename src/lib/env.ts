/**
 * Envs obrigatórias da app. Regra do projeto: NUNCA há defaults silenciosos —
 * cada ambiente (dev/test/prod) tem de declarar os seus valores, senão erro.
 *
 * A 1.ª linha de defesa é o vite.config.ts, que recusa arrancar/buildar sem
 * elas (o build do Coolify falha em vez de embutir um valor errado). Este
 * módulo é o backstop em runtime para contextos que não passam pelo guard
 * (ex.: vitest, que injeta os valores via `test.env`).
 */
function required(name: string): string {
  const raw = (import.meta.env[name] as string | undefined)?.trim();
  if (!raw) {
    throw new Error(
      `[backoffice] Env obrigatória em falta: ${name}. ` +
        "Define-a no ambiente do build (Coolify: build-time variable; " +
        "dev: .env.development) — sem default.",
    );
  }
  return raw;
}

/** Base da API (ex.: https://api.dominio.com/api · dev: http://localhost:3001/api). */
export const API_BASE = required("VITE_API_BASE_URL");

/** Base pública dos sites dos tenants (ex.: https://rufvision.com · dev: http://localhost:3000). */
export const SITE_ROOT_URL = required("VITE_SITE_ROOT_URL");
