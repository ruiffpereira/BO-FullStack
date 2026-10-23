import { useQuery } from "@tanstack/react-query";
import { getCmsEntriesKeyReferences } from "../gen/backoffice/hooks/useGetCmsEntriesKeyReferences.js";
import { getCmsEntriesReferencesCounts } from "../gen/backoffice/hooks/useGetCmsEntriesReferencesCounts.js";
import type { GetCmsEntriesKeyReferences200 } from "../gen/backoffice/types/GetCmsEntriesKeyReferences.js";
import { queryKeys } from '../lib/queryKeys'

// Derivados do gerado (nunca à mão).
export type CmsReferences = GetCmsEntriesKeyReferences200;
export type CmsReference = CmsReferences["products"][number] | CmsReferences["services"][number];
export type GymReference = CmsReferences["gym"][number];

/**
 * GET /cms/entries/{key}/references — migrado (B18) para o client gerado
 * pelo Kubb. Bearer injetado pelo interceptor do `axiosInstance` partilhado
 * (AuthContext.tsx), por isso `authHeader()` deixou de ser preciso.
 */
export async function fetchCmsReferences(key: string): Promise<CmsReferences> {
  return await getCmsEntriesKeyReferences(key);
}

export function useCmsReferences(key: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cmsReferences(key),
    queryFn: () => fetchCmsReferences(key!),
    enabled: !!key && enabled,
    staleTime: 30_000,
  });
}

/**
 * GET /cms/entries/references-counts — migrado (B18) para o client gerado.
 * As keys vão RAW (não pré-codificadas) no param `keys`: o axios já as
 * codifica ao montar a query string — pré-codificar aqui duplicaria o
 * `encodeURIComponent` (ex.: "," → "%2C" → "%252C") e o servidor deixaria de
 * as conseguir separar.
 */
export async function fetchCmsReferencesCounts(keys: string[]): Promise<Record<string, number>> {
  if (keys.length === 0) return {};
  return await getCmsEntriesReferencesCounts({ keys: keys.join(",") });
}

export function useCmsReferencesCounts(keys: string[]) {
  return useQuery({
    queryKey: queryKeys.cmsReferencesCounts.of(keys),
    queryFn: () => fetchCmsReferencesCounts(keys),
    enabled: keys.length > 0,
  });
}
