import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getCmsSearch,
  getCmsSearchQueryKey,
} from "../gen/backoffice/hooks/useGetCmsSearch.js";
import type { GetCmsSearchQueryParams } from "../gen/backoffice/types/GetCmsSearch.js";

/**
 * Wrapper fino sobre o hook gerado pelo Kubb (`useGetCmsSearch`). Existe só
 * para acrescentar `staleTime`/`placeholderData` (evita "piscar" resultados
 * enquanto o utilizador escreve) — o fetch e a queryKey são os GERADOS, para
 * que as invalidações espalhadas pelo código (`getCmsSearchQueryKey()`)
 * continuem sempre a bater com esta leitura, mesmo que o path mude no spec.
 * Antes deste ficheiro montava `/cms/search?${query}` à mão; agora os
 * parâmetros vão em `params`, como o client gerado espera.
 *
 * `context` fica `string` (não o enum gerado) porque o CmsCombo — único
 * consumidor — recebe o contexto como prop genérica de vários sítios da app;
 * o valor continua a ser sempre um dos contextos válidos, só não vale a pena
 * apertar o tipo aqui só por causa deste ponto.
 */
export function useGetCmsSearch(
  params: { q?: string; context?: string; lang?: string },
  options?: { query?: { enabled?: boolean } },
) {
  const genParams = params as GetCmsSearchQueryParams;
  return useQuery({
    queryKey: getCmsSearchQueryKey(genParams),
    queryFn: () => getCmsSearch(genParams),
    enabled: options?.query?.enabled ?? true,
    staleTime: 30_000,
    // Mantém os resultados anteriores enquanto refaz a pesquisa (evita "piscar").
    placeholderData: keepPreviousData,
  });
}
