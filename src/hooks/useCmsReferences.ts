import fetch from "@kubb/plugin-client/clients/axios";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

export interface CmsReference {
  productId?: string;
  serviceId?: string;
  name: string;
  contentKey: string | null;
  descriptionKey: string | null;
}

export interface CmsReferences {
  products: CmsReference[];
  services: CmsReference[];
}

export async function fetchCmsReferences(
  key: string,
  headers: Record<string, string>,
): Promise<CmsReferences> {
  const res = await fetch<CmsReferences, Error, unknown>({
    method: "GET",
    url: `/cms/entries/${encodeURIComponent(key)}/references`,
    baseURL: BASE,
    headers,
  });
  return res.data;
}

export function useCmsReferences(key: string | null, enabled = true) {
  const { authHeader } = useAuth();
  const headers = authHeader();
  return useQuery({
    queryKey: ["cms-references", key],
    queryFn: () => fetchCmsReferences(key!, headers),
    enabled: !!key && enabled,
    staleTime: 30_000,
  });
}

export async function fetchCmsReferencesCounts(
  keys: string[],
  headers: Record<string, string>,
): Promise<Record<string, number>> {
  if (keys.length === 0) return {};
  const res = await fetch<Record<string, number>, Error, unknown>({
    method: "GET",
    url: `/cms/entries/references-counts?keys=${keys.map(encodeURIComponent).join(",")}`,
    baseURL: BASE,
    headers,
  });
  return res.data;
}

export function useCmsReferencesCounts(keys: string[]) {
  const { authHeader } = useAuth();
  const headers = authHeader();
  return useQuery({
    queryKey: ["cms-references-counts", keys.slice().sort().join(",")],
    queryFn: () => fetchCmsReferencesCounts(keys, headers),
    enabled: keys.length > 0,
  });
}
