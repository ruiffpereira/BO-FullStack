import fetch from "@kubb/plugin-client/clients/axios";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";

import { API_BASE as BASE } from "../lib/env";

export interface CmsSearchResult {
  key: string;
  label: string;
  sectionName: string | null | undefined;
}

export async function fetchCmsSearch(
  params: { q?: string; context?: string; lang?: string },
  headers: Record<string, string>,
): Promise<CmsSearchResult[]> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.context) search.set("context", params.context);
  if (params.lang) search.set("lang", params.lang);

  const res = await fetch<CmsSearchResult[], Error, unknown>({
    method: "GET",
    url: `/cms/search?${search.toString()}`,
    baseURL: BASE,
    headers,
  });
  return res.data;
}

export function useGetCmsSearch(
  params: { q?: string; context?: string; lang?: string },
  options?: { query?: { enabled?: boolean } },
) {
  const { authHeader } = useAuth();
  const headers = authHeader();
  return useQuery({
    queryKey: ["cms-search", params.q, params.context, params.lang],
    queryFn: () => fetchCmsSearch(params, headers),
    enabled: options?.query?.enabled ?? true,
    staleTime: 30_000,
    // Mantém os resultados anteriores enquanto refaz a pesquisa (evita "piscar").
    placeholderData: keepPreviousData,
  });
}
