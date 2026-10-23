import { useState } from "react";
import { toast } from "sonner";
import { useGetSettingsLanguages, usePutSettingsLanguages } from "../../hooks/useSettingsLanguages";

/** Línguas do CMS: o servidor é a fonte da verdade; `draft` guarda as edições por gravar. */
export function useLanguageDraft() {
  const { data: langData } = useGetSettingsLanguages();
  const saveLangs = usePutSettingsLanguages();
  const [draft, setDraft] = useState<{
    langs: string[];
    defaultLang: string;
  } | null>(null);

  // Ensure the default language is always in the selected list (new users may have nothing saved)
  const serverDefault = langData?.default ?? "pt";
  const serverSelected = langData?.selected ?? [];
  const effectiveServerSelected = serverSelected.includes(serverDefault)
    ? serverSelected
    : [serverDefault, ...serverSelected];

  // draft overrides server state while editing
  const selectedLangs = draft?.langs ?? effectiveServerSelected;
  const defaultLang = draft?.defaultLang ?? serverDefault;
  const hasLangChanges = draft !== null;

  const LOCALES = selectedLangs;

  const toggleLang = (code: string) => {
    const base = draft?.langs ?? effectiveServerSelected;
    const currDefault = draft?.defaultLang ?? serverDefault;
    // Cannot remove the default language — change the default first
    if (code === currDefault && base.includes(code)) return;
    const next = base.includes(code)
      ? base.filter((c) => c !== code)
      : [...base, code];
    setDraft({ langs: next, defaultLang: currDefault });
  };

  const handleSetDefault = (code: string) => {
    const base = draft?.langs ?? effectiveServerSelected;
    // Activating a language when it's set as default
    const next = base.includes(code) ? base : [...base, code];
    setDraft({ langs: next, defaultLang: code });
  };

  const handleSaveLangs = () => {
    if (!draft) return;
    saveLangs.mutate(
      { languages: draft.langs, default: draft.defaultLang },
      {
        onSuccess: () => {
          toast.success("Línguas guardadas");
          setDraft(null);
        },
        onError: () => toast.error("Erro ao guardar línguas"),
      },
    );
  };

  return { langData, saveLangs, selectedLangs, defaultLang, hasLangChanges, LOCALES, toggleLang, handleSetDefault, handleSaveLangs };
}
