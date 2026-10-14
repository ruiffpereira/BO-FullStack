import { describe, it, expect, afterEach, vi } from "vitest";

const getBackofficeTracking = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetBackofficeTracking", () => ({
  getBackofficeTracking: () => getBackofficeTracking(),
}));

import { initUmami } from "../../src/lib/umami";

/**
 * Umami do próprio Backoffice: o par vem da API (`GET /analytics/backoffice`);
 * 204 ou erro → não se injecta nada e o arranque não parte. O script nunca
 * envia query nem hash — o `/setup-password` leva o token na query.
 */
describe("lib/umami — initUmami", () => {
  afterEach(() => {
    document.head.querySelectorAll("script").forEach((s) => s.remove());
    getBackofficeTracking.mockReset();
  });

  it("injecta o script com o website e sem query nem hash", async () => {
    getBackofficeTracking.mockResolvedValue({
      websiteId: "abc-123",
      src: "https://m.exemplo.com/script.js",
    });
    await initUmami();
    const script = document.head.querySelector("script");
    expect(script?.src).toBe("https://m.exemplo.com/script.js");
    expect(script?.defer).toBe(true);
    expect(script?.dataset.websiteId).toBe("abc-123");
    expect(script?.dataset.excludeSearch).toBe("true");
    expect(script?.dataset.excludeHash).toBe("true");
  });

  it("não injecta nada quando a API responde 204 (corpo vazio)", async () => {
    getBackofficeTracking.mockResolvedValue("");
    await initUmami();
    expect(document.head.querySelector("script")).toBeNull();
  });

  it("não injecta nada nem lança quando o pedido falha", async () => {
    getBackofficeTracking.mockRejectedValue(new Error("Network Error"));
    await expect(initUmami()).resolves.toBeUndefined();
    expect(document.head.querySelector("script")).toBeNull();
  });
});
