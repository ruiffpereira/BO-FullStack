import type { MutableRefObject } from "react";
import { axiosInstance } from "@kubb/plugin-client/clients/axios";
import { API_BASE } from "../../lib/env";
import { notifyBillingReadOnly } from "../../lib/billing402";
import { notifyImpersonationForbidden, type SupportEndReason } from "../../lib/supportSession";
import { notifyTeamForbidden } from "../../lib/teamAccess";
import { isAuthEndpoint } from "./api";
import type { AuthState, RefreshOutcome } from "./types";

/**
 * Interceptors do axios partilhado: junta o Bearer a cada pedido e, num 401, refresca UMA vez e repete
 * (nunca em sessão de suporte — aí o 401 termina a sessão; o cookie de refresh é o do admin). Devolve o `uninstall`.
 */
export function installAuthInterceptors(deps: {
  authRef: MutableRefObject<AuthState>;
  supportActiveRef: MutableRefObject<boolean>;
  navigateRef: MutableRefObject<(to: string, opts?: { replace?: boolean }) => void>;
  doRefresh: () => Promise<RefreshOutcome>;
  endImpersonation: (reason: SupportEndReason) => void;
}) {
  const { authRef, supportActiveRef, navigateRef, doRefresh, endImpersonation } = deps;
  axiosInstance.defaults.baseURL = API_BASE;
  axiosInstance.defaults.withCredentials = true;

  const reqId = axiosInstance.interceptors.request.use((config) => {
    config.baseURL = API_BASE;
    config.withCredentials = true;
    const token = authRef.current.accessToken;
    const url = config.url ?? "";
    if (token && !isAuthEndpoint(url)) {
      const headers = (config.headers ?? {}) as Record<string, string>;
      if (!headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
      }
      config.headers = headers as any;
    }
    return config;
  });

  const resId = axiosInstance.interceptors.response.use(
    (res) => res,
    async (err) => {
      const url = err?.config?.url ?? "";
      const is401 = err?.response?.status === 401;
      const skipRefresh = isAuthEndpoint(url);

      // Sessão de suporte: um 401 (ex.: `SUPPORT_SESSION_ENDED` — o cliente
      // revogou) termina a sessão e rejeita. NUNCA refresca nem repete: o
      // cookie de refresh é o do admin e repetir gravaria na conta dele.
      if (supportActiveRef.current) {
        if (is401) endImpersonation("ended");
        notifyImpersonationForbidden(err?.response?.status, err?.response?.data);
        return Promise.reject(err);
      }

      if (is401 && !skipRefresh && !err.config?._retry) {
        const outcome = await doRefresh();
        if (outcome.kind === "authenticated") {
          err.config._retry = true;
          err.config.withCredentials = true;
          err.config.headers = err.config.headers ?? {};
          err.config.headers.Authorization = `Bearer ${outcome.accessToken}`;
          return axiosInstance(err.config);
        }
      }

      // Gate read-only do platform billing: uma escrita bloqueada devolve 402
      // com `reason`. Mostra um toast (coalescido) a apontar para /faturacao —
      // só ADICIONA feedback, não engole o erro (a promise segue rejeitada, as
      // mutations veem o 402). No-op para qualquer outro erro/status.
      notifyBillingReadOnly(err?.response?.status, err?.response?.data, (to) =>
        navigateRef.current(to),
      );
      // Backstop das permissões da equipa (B41): a UI já esconde/desactiva, mas se uma escrita
      // escapar e a API disser 403 TEAM_*, o membro vê porquê. No-op para qualquer outro erro.
      notifyTeamForbidden(err?.response?.status, err?.response?.data);

      return Promise.reject(err);
    },
  );


  return () => {
    axiosInstance.interceptors.request.eject(reqId);
    axiosInstance.interceptors.response.eject(resId);
  };
}
