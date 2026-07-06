import { describe, it, expect } from "vitest";
import { resolveInitialTheme } from "../../src/lib/uiTheme";

describe("resolveInitialTheme", () => {
  it("localStorage 'light' ganha ao sistema 'dark'", () => {
    expect(resolveInitialTheme("light", true)).toBe("light");
  });

  it("localStorage 'dark' ganha ao sistema 'light'", () => {
    expect(resolveInitialTheme("dark", false)).toBe("dark");
  });

  it("sem localStorage segue o sistema (light)", () => {
    expect(resolveInitialTheme(null, false)).toBe("light");
  });

  it("sem localStorage segue o sistema (dark)", () => {
    expect(resolveInitialTheme(null, true)).toBe("dark");
  });

  it("valor inválido no localStorage cai no sistema", () => {
    expect(resolveInitialTheme("blue", false)).toBe("light");
    expect(resolveInitialTheme("", true)).toBe("dark");
    expect(resolveInitialTheme(undefined, false)).toBe("light");
  });

  it("sem localStorage e sem sistema detetável (matchMedia indisponível) cai em 'dark'", () => {
    expect(resolveInitialTheme(null, undefined)).toBe("dark");
  });

  it("valor inválido + sistema indetetável cai em 'dark'", () => {
    expect(resolveInitialTheme("system", undefined)).toBe("dark");
  });
});
