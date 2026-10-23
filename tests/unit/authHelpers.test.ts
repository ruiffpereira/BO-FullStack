import { describe, it, expect, beforeEach } from "vitest";
import { getIdentityFromJwt, getRefreshDelay } from "../../src/context/auth/jwt";
import { clearStoredIdentity, readStoredIdentity, writeStoredIdentity } from "../../src/context/auth/identity";
import { isAuthEndpoint } from "../../src/context/auth/api";
import { AUTH_IDENTITY_STORAGE_KEY, REFRESH_FALLBACK_MS, REFRESH_MIN_DELAY_MS, REFRESH_SKEW_MS } from "../../src/context/auth/constants";

const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (payload: Record<string, unknown>) => `${b64({ alg: "HS256" })}.${b64(payload)}.sig`;
const nullIdentity = { userId: null, username: null, email: null };

describe("auth/jwt", () => {
  it("getIdentityFromJwt extrai userId/username/email quando existem", () => {
    expect(getIdentityFromJwt(jwt({ userId: "u1", username: "ana", email: "a@x.pt" }))).toEqual({
      userId: "u1",
      username: "ana",
      email: "a@x.pt",
    });
    // o access token do BO só traz o userId: o resto fica null
    expect(getIdentityFromJwt(jwt({ userId: "u1", tokenVersion: 3 }))).toEqual({ userId: "u1", username: null, email: null });
  });

  it("getIdentityFromJwt tolera um token estragado", () => {
    expect(getIdentityFromJwt("lixo")).toEqual(nullIdentity);
    expect(getIdentityFromJwt("a.@@@.c")).toEqual(nullIdentity);
  });

  it("getRefreshDelay: sem exp usa o fallback", () => {
    expect(getRefreshDelay(jwt({}))).toBe(REFRESH_FALLBACK_MS);
    expect(getRefreshDelay("lixo")).toBe(REFRESH_FALLBACK_MS);
  });

  it("getRefreshDelay: renova antes de expirar (skew) e nunca abaixo do mínimo", () => {
    const inOneHour = Math.floor(Date.now() / 1000) + 3600;
    const d = getRefreshDelay(jwt({ exp: inOneHour }));
    expect(d).toBeGreaterThan(REFRESH_MIN_DELAY_MS);
    expect(d).toBeLessThanOrEqual(3600_000 - REFRESH_SKEW_MS + 1000);
    const almostExpired = Math.floor(Date.now() / 1000) + 1;
    expect(getRefreshDelay(jwt({ exp: almostExpired }))).toBe(REFRESH_MIN_DELAY_MS);
  });
});

describe("auth/identity (localStorage)", () => {
  beforeEach(() => localStorage.clear());

  it("escreve, lê e limpa a identidade", () => {
    writeStoredIdentity({ userId: "u1", username: "ana", email: "a@x.pt" });
    expect(readStoredIdentity()).toEqual({ userId: "u1", username: "ana", email: "a@x.pt" });
    clearStoredIdentity();
    expect(readStoredIdentity()).toEqual(nullIdentity);
  });

  it("JSON estragado = identidade vazia", () => {
    localStorage.setItem(AUTH_IDENTITY_STORAGE_KEY, "{nao-json");
    expect(readStoredIdentity()).toEqual(nullIdentity);
  });

  it("campos vazios ou de tipo errado viram null", () => {
    localStorage.setItem(AUTH_IDENTITY_STORAGE_KEY, JSON.stringify({ userId: "  ", username: 5, email: "a@x.pt" }));
    expect(readStoredIdentity()).toEqual({ userId: null, username: null, email: "a@x.pt" });
  });
});

describe("auth/api — isAuthEndpoint", () => {
  it("login/refresh/logout/csrf/setup-password não disparam refresh num 401", () => {
    for (const u of ["/users/login", "/users/refresh", "/users/logout", "/csrf-token", "/users/setup-password"]) {
      expect(isAuthEndpoint(u)).toBe(true);
    }
    expect(isAuthEndpoint("/users/login?x=1")).toBe(true);
    expect(isAuthEndpoint("/customers")).toBe(false);
  });
});
