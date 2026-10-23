import type { ContentEntry as GenContentEntry } from "../../gen/backoffice/types/ContentEntry.js";
import type { ContentSection } from "../../gen/backoffice/types/ContentSection.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type CmsContext = "website" | "product" | "service" | "gym";
/** Vista pedida via `view` (rota — T2.6, `src/lib/navigation.ts`). */
export type ConteudosView = CmsContext | "linguas" | "emails" | "notificacoes";
// Tipos DERIVADOS do gerado (Kubb) — nunca à mão ao lado.
export type Section = ContentSection;
export type ContentEntry = GenContentEntry;
export type GroupedEntry = {
  key: string;
  type: string;
  translations: Record<string, string>;
  sectionId: string | null;
};
export type EntryForm = {
  key: string;
  type: string;
  translations: { locale: string; value: string }[];
  sectionId: string | null;
};
export type SectionForm = { name: string; parentId: string | null };
export type ImportRow = {
  key: string;
  locale: string | null;
  value: string;
  type: string;
  sectionName: string | null;
  parentSectionName: string | null;
};
export type ConfirmAction =
  | { type: "deleteEntry"; key: string }
  | { type: "bulkDelete"; count: number; keys: string[] }
  | { type: "deleteSection"; section: Section };

export const TYPE_LABEL: Record<string, string> = { text: "Texto", image: "Imagem" };

// Labels usados nas mensagens internas da página (empty states, título do
// modal de secção). Alinhados com os labels do submenu da sidebar
// (`SUBMENU["/conteudos"]`, `src/lib/navigation.ts`) — incluindo o mesmo
// desambiguar de "Loja"/"Agenda"/"Ginásio" (que colidiriam com os nomes
// acessíveis dos itens de módulo da sidebar): "Produtos", "Serviços",
// "Ginásio (nomes)". Ver o comentário lá para o porquê.
export const CMS_TABS: {
  id: ConteudosView;
  label: string;
  icon: string;
  permission: string | null;
}[] = [
  { id: "website", label: "Website", icon: "globe", permission: null },
  { id: "product", label: "Produtos", icon: "store", permission: "VIEW_PRODUCTS" },
  {
    id: "service",
    label: "Serviços",
    icon: "scissors",
    permission: "VIEW_SCHEDULE",
  },
  { id: "gym", label: "Ginásio (nomes)", icon: "trend", permission: "VIEW_GYM" },
  { id: "linguas", label: "Línguas", icon: "globe", permission: null },
  { id: "emails", label: "Emails", icon: "mail", permission: null },
  { id: "notificacoes", label: "Notificações", icon: "bell", permission: null },
];

export function localeLabel(code: string): string {
  return code.toUpperCase().slice(0, 2);
}

export const emptyEntry = (sectionId: string | null): EntryForm => ({
  key: "",
  type: "text",
  translations: [{ locale: "pt", value: "" }],
  sectionId,
});
export const emptySection = (parentId: string | null): SectionForm => ({
  name: "",
  parentId,
});

export const inputCls =
  "w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100";

export function groupEntries(entries: ContentEntry[]): GroupedEntry[] {
  const map = new Map<string, GroupedEntry>();
  for (const e of entries) {
    if (!map.has(e.key))
      map.set(e.key, {
        key: e.key,
        type: e.type,
        translations: {},
        sectionId: e.sectionId ?? null,
      });
    map.get(e.key)!.translations[e.locale ?? "_"] = e.value;
  }
  return [...map.values()];
}

export function getSectionPath(
  sections: Section[],
  sectionId: string | null,
): Section[] {
  if (!sectionId) return [];
  const path: Section[] = [];
  let id: string | null = sectionId;
  while (id) {
    const s = sections.find((s) => s.sectionId === id);
    if (!s) break;
    path.unshift(s);
    id = s.parentId ?? null;
  }
  return path;
}

// ─── Site icon card ───────────────────────────────────────────────────────────

/** Key CMS fixa do ícone do site (favicon + atalho PWA). Contrato fixado: sectionId
 * null, locale = a língua actualmente seleccionada na página (ver `iconLocale`). */
export const SITE_ICON_KEY = "site.icon";
