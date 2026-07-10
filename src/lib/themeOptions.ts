import type { ThemePreset, ThemeAccent, ThemeFont, ThemeMode } from "../hooks/useWebsite";

/**
 * Opções de marca (preset/accent/tipografia) da tab "Marca" do Website —
 * labels PT + cores para swatches/preview. Isto é apresentação do Backoffice
 * (mapeia os enums do tema para cor/label), **não** os templates de arranque
 * do site: esses vivem só na API (fonte única, T19,
 * `GET /website/templates`) e chegam aqui via `useGetWebsiteTemplates`
 * (Kubb) — ver `TemplateTab` em `src/pages/Website.tsx`.
 */

export const PRESET_BG: Record<ThemePreset, string> = {
  slate: "#0f172a",
  sand: "#f5f0e6",
  ink: "#0a0a0a",
  mist: "#eef2f7",
};
export const PRESET_FG: Record<ThemePreset, string> = {
  slate: "#e2e8f0",
  sand: "#3b352b",
  ink: "#fafafa",
  mist: "#1f2937",
};
export const ACCENT_HEX: Record<ThemeAccent, string> = {
  blue: "#2a6fdb",
  emerald: "#10b981",
  violet: "#7c3aed",
  amber: "#f59e0b",
  rose: "#e11d48",
  teal: "#0d9488",
  ink: "#111827",
};
export const FONT_STACK: Record<ThemeFont, string> = {
  grotesk: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
  editorial: 'Georgia, "Times New Roman", serif',
  modern: '"Inter", system-ui, -apple-system, sans-serif',
  warm: '"Nunito", "Segoe UI", system-ui, sans-serif',
  serifbody: '"Source Serif 4", Georgia, serif',
};
export const FONT_LABEL: Record<ThemeFont, string> = {
  grotesk: "Grotesk",
  editorial: "Editorial",
  modern: "Moderno",
  warm: "Acolhedor",
  serifbody: "Serifa",
};
export const PRESET_LABEL: Record<ThemePreset, string> = {
  slate: "Ardósia",
  sand: "Areia",
  ink: "Tinta",
  mist: "Névoa",
};
export const ACCENT_LABEL: Record<ThemeAccent, string> = {
  blue: "Azul",
  emerald: "Esmeralda",
  violet: "Violeta",
  amber: "Âmbar",
  rose: "Rosa",
  teal: "Turquesa",
  ink: "Tinta",
};

/** Modo claro/escuro (ver `SiteTheme.mode`, `site-engine/lib/theme.ts::themeAttrs`). */
export const MODE_LABEL: Record<ThemeMode, string> = {
  light: "Claro",
  dark: "Escuro",
};
export const MODE_ICON: Record<ThemeMode, string> = {
  light: "sun",
  dark: "moon",
};
export const THEME_MODES: ThemeMode[] = ["light", "dark"];

export const THEME_PRESETS: ThemePreset[] = ["slate", "sand", "ink", "mist"];
export const THEME_ACCENTS: ThemeAccent[] = [
  "blue",
  "emerald",
  "violet",
  "amber",
  "rose",
  "teal",
  "ink",
];
export const THEME_FONTS: ThemeFont[] = [
  "grotesk",
  "editorial",
  "modern",
  "warm",
  "serifbody",
];

// ── Accent: 7 nomeados curados + hex livre (color-picker) ──────────────────
// Fase 3.3 do roadmap: o accent aceita também uma cor livre, mantendo os
// presets/fontes curados (sem cor por elemento, sem fonte livre). A mesma
// regex dura corre no renderer (`site-engine/lib/theme.ts::accentStyle`) —
// qualquer outro formato é tratado como ausente/inválido.

/** Regex estrita `#rrggbb` (6 dígitos hex) — mesma validação do renderer. */
export const ACCENT_HEX_RE = /^#[0-9a-f]{6}$/i;

/** Normaliza um input de cor livre para `#rrggbb` minúsculas, ou `null` se inválido. */
export function normalizeAccentHex(raw: string): string | null {
  let v = raw.trim();
  if (!v) return null;
  if (!v.startsWith("#")) v = `#${v}`;
  return ACCENT_HEX_RE.test(v) ? v.toLowerCase() : null;
}

/**
 * Só os 7 literais nomeados — repetidos aqui (em vez de derivados de
 * `ThemeAccent`/`THEME_ACCENTS`, ambos tipados como `ThemeAccent[]`) porque
 * `ThemeAccent` inclui `(string & {})`: qualquer tipo derivado dele colapsa
 * de volta a "qualquer string", e excluir esses literais no ramo negativo de
 * `isNamedAccent` dava `never` em vez de `string`.
 */
type NamedAccent = "blue" | "emerald" | "violet" | "amber" | "rose" | "teal" | "ink";

/** É um dos 7 accents nomeados curados (não uma cor livre)? */
export function isNamedAccent(v: string | null | undefined): v is NamedAccent {
  return !!v && (THEME_ACCENTS as readonly string[]).includes(v);
}

/** Hex a usar num preview/swatch para qualquer accent (nomeado OU livre) —
 *  nunca falha: cai no "blue" curado se `v` não for nem um nome válido nem um hex válido. */
export function resolveAccentHex(v: string | null | undefined): string {
  if (!v) return ACCENT_HEX.blue;
  if (isNamedAccent(v)) return ACCENT_HEX[v];
  return ACCENT_HEX_RE.test(v) ? v.toLowerCase() : ACCENT_HEX.blue;
}
