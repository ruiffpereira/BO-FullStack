import fetch from "@kubb/plugin-client/clients/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

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

export const getSettingsLanguagesQueryKey = () =>
  [{ url: "/settings/languages" }] as const;

export async function fetchSettingsLanguages(
  headers: Record<string, string>,
): Promise<LanguageSettings> {
  const res = await fetch<LanguageSettings, Error, unknown>({
    method: "GET",
    url: "/settings/languages",
    baseURL: BASE,
    headers,
  });
  return res.data;
}

export async function putSettingsLanguages(
  body: { languages: string[]; default?: string },
  headers: Record<string, string>,
): Promise<{ languages: string[]; default: string }> {
  const res = await fetch<{ languages: string[]; default: string }, Error, unknown>({
    method: "PUT",
    url: "/settings/languages",
    baseURL: BASE,
    headers,
    data: body,
  });
  return res.data;
}

export function useGetSettingsLanguages() {
  const { authHeader, isAuthenticated } = useAuth();
  const headers = authHeader();
  return useQuery({
    queryKey: getSettingsLanguagesQueryKey(),
    queryFn: () => fetchSettingsLanguages(headers),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  });
}

export function usePutSettingsLanguages() {
  const qc = useQueryClient();
  const { authHeader } = useAuth();
  return useMutation({
    mutationFn: (body: { languages: string[]; default?: string }) =>
      putSettingsLanguages(body, authHeader()),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: getSettingsLanguagesQueryKey() }),
  });
}
