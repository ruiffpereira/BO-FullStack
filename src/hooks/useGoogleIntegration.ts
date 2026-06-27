import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { useAuth } from "../context/AuthContext";

/**
 * Integração Google (Calendar sync + Reviews) por tenant.
 * Bearer auto-injetado via authHeader(); tudo env-gated no servidor.
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
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<GoogleStatus>({
    queryKey: STATUS_KEY,
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await axiosInstance.get<GoogleStatus>("/integrations/google/status", {
        headers: authHeader(),
        withCredentials: true,
      });
      return res.data;
    },
  });
}

export function useGoogleReviews(enabled: boolean) {
  const { authHeader, isAuthenticated } = useAuth();
  return useQuery<GoogleReviewsResponse>({
    queryKey: REVIEWS_KEY,
    enabled: isAuthenticated && enabled,
    queryFn: async () => {
      const res = await axiosInstance.get<GoogleReviewsResponse>("/integrations/google/reviews", {
        headers: authHeader(),
        withCredentials: true,
      });
      return res.data;
    },
  });
}

/** Devolve o URL de consentimento OAuth para redirecionar o browser. */
export function useGoogleConnect() {
  const { authHeader } = useAuth();
  return useMutation<string>({
    mutationFn: async () => {
      const res = await axiosInstance.get<{ url: string }>("/integrations/google/connect", {
        headers: authHeader(),
        withCredentials: true,
      });
      return res.data.url;
    },
  });
}

export function useGoogleDisconnect() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await axiosInstance.post("/integrations/google/disconnect", null, {
        headers: authHeader(),
        withCredentials: true,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: STATUS_KEY }),
  });
}

export function useSetGooglePlace() {
  const { authHeader } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (placeId: string) => {
      await axiosInstance.put(
        "/integrations/google/place",
        { placeId },
        { headers: authHeader(), withCredentials: true },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STATUS_KEY });
      qc.invalidateQueries({ queryKey: REVIEWS_KEY });
    },
  });
}
