import { useGetSettingsLanguages } from "../hooks/useSettingsLanguages";
import { LangFlag } from "../utils/langFlag";

export type TranslationMap = Record<string, { name?: string; description?: string }>;

interface TranslationInputsProps {
  value: TranslationMap;
  onChange: (value: TranslationMap) => void;
  fields?: ("name" | "description")[];
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
}

export function TranslationInputs({
  value,
  onChange,
  fields = ["name"],
  namePlaceholder = "Nome traduzido",
  descriptionPlaceholder = "Descrição traduzida",
}: TranslationInputsProps) {
  const { data, isLoading } = useGetSettingsLanguages();
  const selected = data?.selected ?? [];
  const available = data?.available ?? [];

  if (isLoading || selected.length === 0) return null;

  const langs = selected
    .map((code) => available.find((l) => l.code === code))
    .filter(Boolean) as { code: string; name: string; flag: string }[];

  const update = (lang: string, field: "name" | "description", val: string) => {
    onChange({
      ...value,
      [lang]: { ...(value[lang] ?? {}), [field]: val },
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Traduções
      </p>
      {langs.map((lang) => (
        <div
          key={lang.code}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2"
        >
          <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <LangFlag code={lang.code} className="h-3.5 w-auto rounded-sm" />
            {lang.name}
          </p>
          {fields.includes("name") && (
            <input
              type="text"
              placeholder={namePlaceholder}
              value={value[lang.code]?.name ?? ""}
              onChange={(e) => update(lang.code, "name", e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          )}
          {fields.includes("description") && (
            <input
              type="text"
              placeholder={descriptionPlaceholder}
              value={value[lang.code]?.description ?? ""}
              onChange={(e) => update(lang.code, "description", e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          )}
        </div>
      ))}
    </div>
  );
}
