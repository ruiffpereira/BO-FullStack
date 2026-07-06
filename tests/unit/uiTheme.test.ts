import { describe, it, expect } from "vitest";
import { resolveInitialTheme, resolveThemeFromServer } from "../../src/lib/uiTheme";

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

// T3.4 (.design/shell-nav-perfil/TASKS.md) — tema server-side: o servidor
// (User.uiTheme) ganha sempre a localStorage/sistema deste browser quando é
// "light"/"dark" explícito; "system" (ou ausente/inválido) segue o sistema.
describe("resolveThemeFromServer", () => {
  it("servidor 'light' ganha ao sistema 'dark'", () => {
    expect(resolveThemeFromServer("light", true)).toBe("light");
  });

  it("servidor 'dark' ganha ao sistema 'light'", () => {
    expect(resolveThemeFromServer("dark", false)).toBe("dark");
  });

  it("servidor 'system' segue o sistema (light)", () => {
    expect(resolveThemeFromServer("system", false)).toBe("light");
  });

  it("servidor 'system' segue o sistema (dark)", () => {
    expect(resolveThemeFromServer("system", true)).toBe("dark");
  });

  it("servidor ausente/inválido segue o sistema, mesma convenção", () => {
    expect(resolveThemeFromServer(undefined, false)).toBe("light");
    expect(resolveThemeFromServer(null, true)).toBe("dark");
    expect(resolveThemeFromServer("blue", false)).toBe("light");
  });

  it("servidor 'system' + sistema indetetável cai em 'dark' (mesmo fallback de resolveInitialTheme)", () => {
    expect(resolveThemeFromServer("system", undefined)).toBe("dark");
  });
});
