import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { getCsrfToken } from "../../gen/backoffice/hooks/useGetCsrfToken.js";
import { getUserPermissions } from "../../gen/backoffice/hooks/useGetUserPermissions.js";
import { getUserPermissionsAccess } from "../../gen/backoffice/hooks/useGetUserPermissionsAccess.js";
import { AUTH_REQUEST_TIMEOUT_MS, SKIP_401 } from "./constants";
import { AccessState, Permission } from "./types";

export function isAuthEndpoint(url = "") {
  const path = url.split("?")[0];
  return SKIP_401.some((p) => path === p || path.endsWith(p));
}

export async function fetchCsrfToken(): Promise<string> {
  const csrf = await getCsrfToken({ timeout: AUTH_REQUEST_TIMEOUT_MS } as any);
  if (!csrf?.csrfToken) throw new Error("CSRF token em falta.");
  return csrf.csrfToken;
}

export async function fetchPermissions(accessToken: string): Promise<Permission[]> {
  return getUserPermissions({
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: AUTH_REQUEST_TIMEOUT_MS,
  } as any);
}

export async function fetchAccess(accessToken: string): Promise<AccessState> {
  const res = await getUserPermissionsAccess({
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: AUTH_REQUEST_TIMEOUT_MS,
  } as any);
  return {
    member: res?.member ?? null,
    modules: (res?.modules ?? [])
      .filter((m) => !!m.key)
      .map((m) => ({
        key: m.key as string,
        label: m.label ?? (m.key as string),
        level: m.level === "edit" ? ("edit" as const) : ("view" as const),
      })),
    grants: (res?.grants ?? [])
      .filter((g) => !!g.key)
      .map((g) => ({
        key: g.key as string,
        level: g.level === "edit" ? ("edit" as const) : ("view" as const),
        ...(g.scope === "meus" ? { scope: "meus" as const } : {}),
      })),
    staffId: res?.staffId ?? null,
  };
}

export async function refreshSession(): Promise<string | null> {
  const csrfToken = await fetchCsrfToken();
  const res = await axiosInstance.post<{ accessToken?: string }>(
    "/users/refresh",
    undefined,
    {
      headers: { "x-csrf-token": csrfToken },
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 401,
      timeout: AUTH_REQUEST_TIMEOUT_MS,
      withCredentials: true,
    },
  );

  if (res.status === 401) return null;
  return res.data?.accessToken ?? null;
}

export async function getBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}
