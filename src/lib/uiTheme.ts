/**
 * Tema (light/dark): persistência local (`localStorage`) + default do
 * sistema (`prefers-color-scheme`). Fonte única de verdade para o init lazy
 * do `App.tsx` e para o script anti-flash do `index.html` (duplicado ali
 * porque corre antes do bundle — mantém os dois em sincronia se mexeres
 * aqui).
 *
 * T3.4 (`.design/shell-nav-perfil/TASKS.md`): a preferência server-side
 * (`User.uiTheme`, via `useThemeSync` em `src/hooks/useThemeSync.ts`) manda
 * assim que `GET /users/me` resolve — prioridade servidor > localStorage >
 * sistema. Este ficheiro continua a ser só o 1.º palpite (antes de saber se
 * há sessão) + as funções puras partilhadas pelos dois lados.
 */

export type Theme = "light" | "dark";

/** Preferência guardada no servidor (`User.uiTheme`) — 3 vias, ao contrário
 * do `Theme` aplicado (2 vias: o que fica na classe `dark` do `<html>`). */
export type UiThemeChoice = "light" | "dark" | "system";

// Não exportada: sem consumidores fora deste ficheiro (readStoredTheme/
// persistTheme já a encapsulam).
const THEME_STORAGE_KEY = "bo.theme";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Resolve o tema inicial a partir do valor bruto do localStorage e da
 * preferência de sistema (`prefers-color-scheme: dark`). Função pura — não
 * toca em `localStorage`/`matchMedia` — para ser testável sem DOM real.
 *
 * Prioridade: localStorage válido (`"light"`/`"dark"`, qualquer outra coisa
 * é ignorada) > sistema > `"dark"` (fallback quando o sistema não é
 * detetável, ex.: `matchMedia` indisponível).
 */
export function resolveInitialTheme(
  storedValue: string | null | undefined,
  systemPrefersDark: boolean | undefined,
): Theme {
  if (isTheme(storedValue)) return storedValue;
  if (systemPrefersDark === false) return "light";
  return "dark";
}

/**
 * Lê o tema guardado em localStorage (`null` se ausente/bloqueado). Não
 * exportada: usada só por `computeInitialTheme` neste ficheiro — `useThemeSync`
 * (T3.4) não precisa de a ler diretamente, só de a persistir/limpar
 * (`persistTheme`/`clearStoredTheme`, essas sim exportadas).
 */
function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Persiste o tema escolhido manualmente (silencioso se localStorage bloqueado). */
export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage indisponível (modo privado, quota excedida, etc.) — ignora.
  }
}

/**
 * Limpa o override local (T3.4): usada quando a preferência (servidor ou
 * escolha do user) passa a `"system"` — em vez de gravar a string `"system"`
 * no localStorage, limpa a chave para o anti-flash do próximo reload (que só
 * conhece localStorage/sistema, nunca o servidor) cair direto no sistema.
 */
export function clearStoredTheme(): void {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // localStorage indisponível — ignora (mesmo caso de persistTheme).
  }
}

/**
 * `true`/`false` = preferência do sistema; `undefined` = matchMedia
 * indisponível. Exportada (T3.4): `useThemeSync` usa-a para resolver o tema
 * aplicado quando a preferência do servidor é `"system"`.
 */
export function getSystemPrefersDark(): boolean | undefined {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return undefined;
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return undefined;
  }
}

/** Composição pronta a usar no init lazy do `useState` do tema no `App.tsx`. */
export function computeInitialTheme(): Theme {
  return resolveInitialTheme(readStoredTheme(), getSystemPrefersDark());
}

/**
 * Resolve o tema APLICADO a partir da preferência guardada no SERVIDOR
 * (`User.uiTheme`, `GET /users/me`) e da preferência de sistema atual. Pura
 * — não toca em `localStorage`/`matchMedia` — para ser testável sem DOM
 * real (T3.4, `useThemeSync`).
 *
 * Prioridade: `"light"`/`"dark"` explícitos no servidor GANHAM SEMPRE (é a
 * correção do "o tema começa sempre X noutro browser" — sobrepõe-se ao que o
 * localStorage/sistema deste browser diziam) > `"system"` (ou
 * ausente/inválido) segue o sistema, com o mesmo fallback `"dark"` de
 * `resolveInitialTheme` quando o sistema não é detetável.
 */
export function resolveThemeFromServer(
  serverTheme: string | null | undefined,
  systemPrefersDark: boolean | undefined,
): Theme {
  if (isTheme(serverTheme)) return serverTheme;
  if (systemPrefersDark === false) return "light";
  return "dark";
}
