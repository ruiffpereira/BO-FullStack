/**
 * Tema (light/dark): persistência local (`localStorage`) + default do
 * sistema (`prefers-color-scheme`). Fonte única de verdade para o init lazy
 * do `App.tsx` e para o script anti-flash do `index.html` (duplicado ali
 * porque corre antes do bundle — mantém os dois em sincronia se mexeres
 * aqui).
 *
 * T3.4 (`.design/shell-nav-perfil/TASKS.md`) vai promover isto a preferência
 * server-side (`User.uiTheme`): prioridade passa a ser servidor > localStorage > sistema.
 */

export type Theme = "light" | "dark";

// Não exportada: sem consumidores fora deste ficheiro (readStoredTheme/
// persistTheme já a encapsulam). O T3.4 (tema server-side) pode voltar a
// precisar de a expor — só reexportar então.
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
 * exportada: usada só por `computeInitialTheme` neste ficheiro — sem
 * consumidores externos (o T3.4 pode voltar a expô-la).
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
 * `true`/`false` = preferência do sistema; `undefined` = matchMedia
 * indisponível. Não exportada: usada só por `computeInitialTheme` neste
 * ficheiro — sem consumidores externos (o T3.4 pode voltar a expô-la).
 */
function getSystemPrefersDark(): boolean | undefined {
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
