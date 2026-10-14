import { getBackofficeTracking } from "../gen/backoffice/hooks/useGetBackofficeTracking";

export type UmamiTracking = { websiteId: string; src: string };

/**
 * Mede o próprio Backoffice no Umami. Não há envs: a API provisiona o website
 * pelo domínio do `BACKOFFICE_URL` e devolve o par `{websiteId, src}` — o
 * mesmo `src` (`UMAMI_PUBLIC_URL`) que os sites externos recebem. Sem Umami no
 * servidor, ou em dev (host local), a API responde 204 e não se injecta nada.
 *
 * Best-effort: medir nunca pode partir o arranque do BO.
 */
export async function initUmami(): Promise<void> {
  try {
    const tracking = await getBackofficeTracking();
    if (tracking?.websiteId && tracking?.src) injectUmami(tracking);
  } catch {
    // API em baixo ou pedido bloqueado — a app arranca na mesma, sem medição.
  }
}

/**
 * O tracker segue sozinho o `pushState` do router, por isso basta injectá-lo
 * uma vez. Query e hash ficam fora do que se envia: o `/setup-password` leva o
 * token na query.
 */
export function injectUmami({ websiteId, src }: UmamiTracking): void {
  const script = document.createElement("script");
  script.defer = true;
  script.src = src;
  script.dataset.websiteId = websiteId;
  script.dataset.excludeSearch = "true";
  script.dataset.excludeHash = "true";
  document.head.appendChild(script);
}
