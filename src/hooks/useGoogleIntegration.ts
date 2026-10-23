import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import type { GetIntegrationsGoogleStatus200 } from "../gen/backoffice/types/GetIntegrationsGoogleStatus.js";
import type { GetIntegrationsGoogleReviews200 } from "../gen/backoffice/types/GetIntegrationsGoogleReviews.js";
import { getIntegrationsGoogleStatus } from "../gen/backoffice/hooks/useGetIntegrationsGoogleStatus.js";
import { getIntegrationsGoogleReviews } from "../gen/backoffice/hooks/useGetIntegrationsGoogleReviews.js";
import { getIntegrationsGoogleConnect } from "../gen/backoffice/hooks/useGetIntegrationsGoogleConnect.js";
import { postIntegrationsGoogleDisconnect } from "../gen/backoffice/hooks/usePostIntegrationsGoogleDisconnect.js";
import { putIntegrationsGooglePlace } from "../gen/backoffice/hooks/usePutIntegrationsGooglePlace.js";

/**
 * Integração Google (Calendar sync + Reviews) por tenant.
 * Migrado para os clients gerados pelo Kubb — o `axiosInstance` partilhado
 * (interceptor posto pelo `AuthContext`) já injeta `Authorization`, `baseURL`
 * e `withCredentials` em TODOS os pedidos, incluindo os dos clients gerados
 * (correm no mesmo `axiosInstance`) — por isso `authHeader()` deixou de ser
 * preciso aqui. Os tipos vêm do spec (F6b6: os campos que a API devolve
 * sempre são `required`). As query keys mantêm-se EXACTAMENTE como antes da
 * migração (não as dos hooks gerados) para não desalinhar nenhuma invalidação.
 */

export type GoogleStatus = GetIntegrationsGoogleStatus200;
export type GoogleReviewsResponse = GetIntegrationsGoogleReviews200;
export type GoogleReview = GoogleReviewsResponse["reviews"][number];

const STATUS_KEY = ["google-integration", "status"];
const REVIEWS_KEY = ["google-integration", "reviews"];

export function useGoogleStatus() {
  const { isAuthenticated } = useAuth();
  return useQuery<GoogleStatus>({
    queryKey: STATUS_KEY,
    enabled: isAuthenticated,
    queryFn: () => getIntegrationsGoogleStatus(),
  });
}

export function useGoogleReviews(enabled: boolean) {
  const { isAuthenticated } = useAuth();
  return useQuery<GoogleReviewsResponse>({
    queryKey: REVIEWS_KEY,
    enabled: isAuthenticated && enabled,
    queryFn: () => getIntegrationsGoogleReviews(),
  });
}

/** Devolve o URL de consentimento OAuth para redirecionar o browser. */
export function useGoogleConnect() {
  return useMutation<string>({
    mutationFn: async () => {
      const data = await getIntegrationsGoogleConnect();
      // O spec marca `url` como opcional (contrato genérico), mas uma resposta
      // 200 desta rota traz sempre o URL — falha alto e explícito em vez de
      // deixar `window.location.href = undefined` silencioso no chamador.
      if (!data.url) throw new Error("O servidor não devolveu o URL de autorização Google.");
      return data.url;
    },
  });
}

export function useGoogleDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await postIntegrationsGoogleDisconnect();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: STATUS_KEY }),
  });
}

export function useSetGooglePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (placeId: string) => {
      await putIntegrationsGooglePlace({ placeId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STATUS_KEY });
      qc.invalidateQueries({ queryKey: REVIEWS_KEY });
    },
  });
}
