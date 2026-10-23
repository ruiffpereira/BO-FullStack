import { AccessState, AuthState } from "./types";

export const ownerAccess: AccessState = { member: null, modules: [], grants: [], staffId: null };

/**
 * ⚠ EXCEPÇÃO DELIBERADA ao "Kubb everywhere" (2026-09-24). Os paths de auth
 * deste ficheiro ficam em strings, e não vêm dos clients gerados. Não é
 * esquecimento — não os migres.
 *
 * PORQUÊ. As funções geradas pelo Kubb devolvem `res.data` e **descartam o
 * status HTTP**. O bootstrap de sessão daqui ramifica precisamente por ele:
 *
 *     validateStatus: (s) => (s >= 200 && s < 300) || s === 401
 *     if (res.status === 401) return null;   // veredito DEFINITIVO
 *
 * Sem o status, a única alternativa seria deixar o 401 lançar e apanhá-lo — e
 * aí um **erro de rede** ficaria indistinguível de **sessão expirada**. Essa
 * distinção é o que sustenta tudo o resto: uma é transitória e faz retry
 * (`reconnecting`), a outra termina a sessão. Confundi-las dá logout a quem só
 * teve um soluço de rede, ou uma app presa a tentar renovar uma sessão morta.
 *
 * `SKIP_401` é, além disso, uma lista de POLÍTICA (onde um 401 não pode
 * disparar o interceptor de refresh, para não entrar em ciclo) — não é uma
 * lista de chamadas. Mesmo com clients gerados continuaria a existir.
 *
 * O resto do Backoffice está migrado; a excepção é só esta.
 */
export const SKIP_401 = [
  "/csrf-token",
  "/users/login",
  "/users/refresh",
  "/users/logout",
  "/users/setup-password",
];

export const REFRESH_FALLBACK_MS = 10 * 60 * 1000;
export const REFRESH_SKEW_MS = 60 * 1000;
export const REFRESH_RETRY_MS = 30 * 1000;
export const REFRESH_MIN_DELAY_MS = 30 * 1000;
export const AUTH_REQUEST_TIMEOUT_MS = 5 * 1000;
export const AUTH_IDENTITY_STORAGE_KEY = "backoffice.auth.identity";
// B12 — cadência e orçamento do "ainda sem veredicto" no arranque (ver
// `doRefresh` abaixo). Só se aplica ENQUANTO a sessão desta aba nunca chegou a
// um veredito definitivo (autenticada, 401 duro, ou desistência); uma vez
// resolvida, o refresh de fundo volta à cadência normal (REFRESH_RETRY_MS,
// 30s) — não há motivo para martelar o servidor de uma app já em uso.
// 3 tentativas a 2s dão um orçamento máximo de ~(15s + 2s) × 3 ≈ 51s no pior
// caso (cada tentativa pode gastar até AUTH_REQUEST_TIMEOUT_MS × 3 = 15s, a
// cadeia csrf→refresh→permissões) — o suficiente para engolir um soluço real
// de rede sem deixar o utilizador a fitar "a reconectar…" durante minutos.
export const RECONNECT_RETRY_MS = 2 * 1000;
export const MAX_RECONNECT_ATTEMPTS = 3;

export const emptyAuth: AuthState = {
  userId: null,
  username: null,
  email: null,
  accessToken: null,
  permissions: [],
  access: ownerAccess,
  isAuthenticated: false,
};
