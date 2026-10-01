import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * `src/lib/env.ts` é o backstop em runtime das envs obrigatórias da app (a 1.ª
 * linha de defesa é o guard em `vite.config.ts`, que recusa arrancar/buildar).
 * Regra do projeto: NUNCA há defaults silenciosos — falta uma env obrigatória
 * → lança erro claro. Este teste cobre o caso feliz (envs de teste definidas
 * em `vitest.config.ts`) e o fail-fast quando faltam.
 */
describe("lib/env — fail-fast das envs obrigatórias (sem defaults)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exporta API_BASE quando a env está definida", async () => {
    vi.resetModules();
    const mod = await import("../../src/lib/env");
    expect(mod.API_BASE).toBe("http://localhost:3001/api");
  });

  it("lança quando VITE_API_BASE_URL está em falta", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.resetModules();
    await expect(import("../../src/lib/env")).rejects.toThrow(/VITE_API_BASE_URL/);
  });

  it("lança quando VITE_API_BASE_URL só tem espaços (não conta como definida)", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "   ");
    vi.resetModules();
    await expect(import("../../src/lib/env")).rejects.toThrow(/VITE_API_BASE_URL/);
  });
});
