import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { getSettingsLanguages, getSettingsLanguagesQueryKey } from "../gen/backoffice/hooks/useGetSettingsLanguages.js";
import { putSettingsLanguages as putSettingsLanguagesGen } from "../gen/backoffice/hooks/usePutSettingsLanguages.js";

// Migrado (B18) para os clients gerados pelo Kubb. A query key gerada
// (`[{ url: "/settings/languages" }]`) já era, por coincidência, idêntica à
// key manual de antes — reexportamo-la directamente, sem trocar consumidores.

export interface AvailableLanguage {
  code: string;
  name: string;
  flag: string;
}

export interface LanguageSettings {
  available: AvailableLanguage[];
  selected: string[];
  default: string;
}

export { getSettingsLanguagesQueryKey };

export function useGetSettingsLanguages() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: getSettingsLanguagesQueryKey(),
    queryFn: async () => (await getSettingsLanguages()) as LanguageSettings,
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  });
}

export function usePutSettingsLanguages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { languages: string[]; default?: string }) =>
      putSettingsLanguagesGen(body) as Promise<{ languages: string[]; default: string }>,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: getSettingsLanguagesQueryKey() }),
  });
}
