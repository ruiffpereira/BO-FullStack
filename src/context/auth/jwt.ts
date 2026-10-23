import { REFRESH_FALLBACK_MS, REFRESH_MIN_DELAY_MS, REFRESH_SKEW_MS } from "./constants";

function getJwtExpiry(accessToken: string): number | null {
  const decoded = decodeJwtPayload(accessToken);
  return typeof decoded?.exp === "number" ? decoded.exp * 1000 : null;
}

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  const [, payload] = accessToken.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function getIdentityFromJwt(accessToken: string): {
  userId: string | null;
  username: string | null;
  email: string | null;
} {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return { userId: null, username: null, email: null };

  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    return null;
  };

  return {
    userId: pick("userId", "uid", "sub"),
    username: pick("username", "preferred_username", "name", "email"),
    // O access token do BO só carrega { userId, tokenVersion } (ver
    // `generateAccessToken` na API) — nunca vem daqui na prática hoje, mas
    // fica pronto caso o payload alguma vez ganhe o campo, sem mais um sítio
    // a mudar. A identidade real (login/reload) vem do `login()`/localStorage.
    email: pick("email"),
  };
}

export function getRefreshDelay(accessToken: string) {
  const expiry = getJwtExpiry(accessToken);
  if (!expiry) return REFRESH_FALLBACK_MS;
  return Math.max(expiry - Date.now() - REFRESH_SKEW_MS, REFRESH_MIN_DELAY_MS);
}
