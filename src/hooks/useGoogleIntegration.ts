import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
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
 * preciso aqui. Os tipos locais (`GoogleStatus`/`GoogleReview`/
 * `GoogleReviewsResponse`) mantêm-se: o spec marca os campos como opcionais/
 * nullable (contrato genérico), mas o servidor devolve sempre o objeto
 * completo nestas respostas de sucesso — os `as Tipo` abaixo são esse cast
 * de fronteira. As query keys mantêm-se EXACTAMENTE como antes da migração
 * (não as dos hooks gerados) para não desalinhar nenhuma invalidação.
 */

export interface GoogleStatus {
  connected: boolean;
  calendarId: string;
  placeId: string | null;
  connectedAt: string | null;
  configured: boolean;
}

export interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  relative_time_description: string;
  profile_photo_url?: string;
  time?: number;
}

export interface GoogleReviewsResponse {
  configured: boolean;
  name?: string | null;
  rating?: number | null;
  total?: number | null;
  reviews: GoogleReview[];
  error?: string;
}

const STATUS_KEY = ["google-integration", "status"];
const REVIEWS_KEY = ["google-integration", "reviews"];

export function useGoogleStatus() {
  const { isAuthenticated } = useAuth();
  return useQuery<GoogleStatus>({
    queryKey: STATUS_KEY,
    enabled: isAuthenticated,
    queryFn: async () => (await getIntegrationsGoogleStatus()) as GoogleStatus,
  });
}

export function useGoogleReviews(enabled: boolean) {
  const { isAuthenticated } = useAuth();
  return useQuery<GoogleReviewsResponse>({
    queryKey: REVIEWS_KEY,
    enabled: isAuthenticated && enabled,
    queryFn: async () => (await getIntegrationsGoogleReviews()) as GoogleReviewsResponse,
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
