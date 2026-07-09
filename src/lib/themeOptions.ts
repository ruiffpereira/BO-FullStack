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
