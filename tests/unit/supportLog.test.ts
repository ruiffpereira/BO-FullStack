import { describe, it, expect, vi, beforeEach } from "vitest";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

import {
  areaForResource,
  changeEntries,
  describeSupportAction,
  describeSupportActor,
  failureLabel,
  verbForMethod,
  type SupportLogItem,
} from "../../src/lib/supportLog";
import {
  isImpersonationForbiddenError,
  notifyImpersonationForbidden,
  readSupportSession,
  resetImpersonationForbiddenThrottle,
  supportEntryErrorMessage,
  SUPPORT_SESSION_STORAGE_KEY,
} from "../../src/lib/supportSession";

const item = (over: Partial<SupportLogItem>): SupportLogItem => ({
  auditLogId: "a1",
  createdAt: "2026-10-10T10:00:00.000Z",
  kind: "change",
  actorName: "Ana (suporte)",
  method: "PUT",
  path: "/services/1",
  resourceType: "services",
  resourceId: "1",
  statusCode: 200,
  success: true,
  changes: null,
  ...over,
});

describe("Registo do suporte — texto por kind / método / recurso", () => {
  it("session → 'Entrou na tua conta (sessão de suporte)'", () => {
    expect(describeSupportAction(item({ kind: "session", method: "POST" }))).toBe(
      "Entrou na tua conta (sessão de suporte)",
    );
  });

  it("grant → 'Deste acesso ao suporte por N dias' (N vem de changes.days)", () => {
    expect(describeSupportAction(item({ kind: "grant", changes: { days: 7 } }))).toBe(
      "Deste acesso ao suporte por 7 dias",
    );
    expect(describeSupportAction(item({ kind: "grant", changes: { days: 1 } }))).toBe(
      "Deste acesso ao suporte por 1 dia",
    );
    expect(describeSupportAction(item({ kind: "grant", changes: null }))).toBe("Deste acesso ao suporte");
  });

  it("revoke → 'Revogaste o acesso do suporte'", () => {
    expect(describeSupportAction(item({ kind: "revoke" }))).toBe("Revogaste o acesso do suporte");
  });

  it.each([
    ["POST", "Criou"],
    ["PUT", "Alterou"],
    ["PATCH", "Alterou"],
    ["DELETE", "Apagou"],
    ["delete", "Apagou"],
  ])("change com %s → verbo '%s'", (method, verb) => {
    expect(verbForMethod(method)).toBe(verb);
    expect(describeSupportAction(item({ method, resourceType: "services" }))).toBe(`${verb} os serviços`);
  });

  it.each([
    ["services", "os serviços"],
    ["cms", "os conteúdos"],
    ["products", "os produtos"],
    ["categories", "as categorias"],
    ["schedule", "a agenda"],
    ["gym", "o ginásio"],
    ["uploads", "ficheiros carregados"],
    ["settings", "as definições"],
    ["languages", "as línguas"],
    ["users", "o perfil"],
  ])("resourceType '%s' → '%s'", (resourceType, area) => {
    expect(areaForResource(resourceType)).toBe(area);
  });

  it.each([
    ["/schedule/services", "Criou os serviços"],
    ["/schedule/services/3f1c2b7a-0000-4000-8000-000000000000", "Criou os serviços"],
    ["/schedule/appointments", "Criou as marcações"],
    ["/schedule/working-hours", "Criou os horários"],
    ["/schedule/blocked-slots", "Criou os bloqueios da agenda"],
    ["/cms/entries", "Criou os conteúdos"],
  ])("pelo path '%s' → '%s' (o segmento mais específico ganha ao resourceType)", (path, text) => {
    expect(describeSupportAction(item({ method: "POST", path, resourceType: path.split("/")[1] }))).toBe(text);
  });

  it("view → 'Viu <área>'; área desconhecida → 'Viu a conta'", () => {
    expect(describeSupportAction(item({ kind: "view", method: "GET", path: "/customers", resourceType: "customers" }))).toBe("Viu os clientes");
    expect(describeSupportAction(item({ kind: "view", method: "GET", path: "/schedule/services", resourceType: "schedule" }))).toBe("Viu os serviços");
    expect(describeSupportAction(item({ kind: "view", method: "GET", path: "/widgets/1", resourceType: "widgets" }))).toBe("Viu a conta");
  });

  it("sem correspondência fica o resourceType cru", () => {
    expect(areaForResource("widgets")).toBe("widgets");
    expect(describeSupportAction(item({ method: "POST", resourceType: "widgets", path: "/widgets/1" }))).toBe("Criou widgets");
  });

  it("'Quem': Tu para grant/revoke; senão o actorName (com fallback)", () => {
    expect(describeSupportActor(item({ kind: "grant", actorName: null }))).toBe("Tu");
    expect(describeSupportActor(item({ kind: "revoke", actorName: "Ana" }))).toBe("Tu");
    expect(describeSupportActor(item({ kind: "session", actorName: "Ana (suporte)" }))).toBe("Ana (suporte)");
    expect(describeSupportActor(item({ kind: "change", actorName: null }))).toBe("Suporte");
  });

  it("selo de falha: 403 → Bloqueado, outro erro → Falhou, sucesso → nada", () => {
    expect(failureLabel({ success: false, statusCode: 403 })).toBe("Bloqueado");
    expect(failureLabel({ success: false, statusCode: 500 })).toBe("Falhou");
    expect(failureLabel({ success: true, statusCode: 200 })).toBeNull();
  });

  it("changeEntries: chave/valor truncados; vazio sem changes", () => {
    expect(changeEntries(null)).toEqual([]);
    expect(changeEntries([1, 2])).toEqual([]);
    const long = "x".repeat(200);
    const entries = changeEntries({ name: "Corte", price: 12, long, obj: { a: 1 } });
    expect(entries[0]).toEqual(["name", "Corte"]);
    expect(entries[1]).toEqual(["price", "12"]);
    expect(entries[2][1].length).toBe(81); // 80 + reticências
    expect(entries[2][1].endsWith("…")).toBe(true);
    expect(entries[3]).toEqual(["obj", '{"a":1}']);
  });
});

describe("supportSession — peças puras", () => {
  beforeEach(() => {
    sessionStorage.clear();
    toastError.mockClear();
    resetImpersonationForbiddenThrottle();
  });

  it("readSupportSession: none / expired / valid / lixo (e nunca remove nada)", () => {
    expect(readSupportSession().status).toBe("none");

    const base = { accessToken: "t", tenant: { userId: "u", name: "N", email: "e@x" } };
    sessionStorage.setItem(
      SUPPORT_SESSION_STORAGE_KEY,
      JSON.stringify({ ...base, expiresAt: new Date(Date.now() - 1000).toISOString() }),
    );
    expect(readSupportSession().status).toBe("expired");
    expect(sessionStorage.getItem(SUPPORT_SESSION_STORAGE_KEY)).not.toBeNull(); // pura

    sessionStorage.setItem(
      SUPPORT_SESSION_STORAGE_KEY,
      JSON.stringify({ ...base, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    );
    expect(readSupportSession().status).toBe("valid");

    sessionStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, "{not json");
    expect(readSupportSession().status).toBe("none");
    sessionStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, JSON.stringify({ accessToken: "t" }));
    expect(readSupportSession().status).toBe("none");
  });

  it("403 IMPERSONATION_FORBIDDEN dá um toast claro (coalescido); outros erros não", () => {
    expect(isImpersonationForbiddenError(403, { code: "IMPERSONATION_FORBIDDEN" })).toBe(true);
    expect(isImpersonationForbiddenError(403, { code: "OUTRO" })).toBe(false);
    expect(isImpersonationForbiddenError(401, { code: "IMPERSONATION_FORBIDDEN" })).toBe(false);

    expect(notifyImpersonationForbidden(403, { code: "IMPERSONATION_FORBIDDEN" })).toBe(true);
    expect(notifyImpersonationForbidden(403, { code: "IMPERSONATION_FORBIDDEN" })).toBe(true);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0][0]).toMatch(/sessão de suporte/);
    expect(notifyImpersonationForbidden(500, {})).toBe(false);
  });

  it("mensagens do impersonate por code / status", () => {
    const e = (status: number, code?: string, error?: string) => ({ response: { status, data: { code, error } } });
    expect(supportEntryErrorMessage(e(403, "TARGET_IS_ADMIN"))).toMatch(/administrador/);
    expect(supportEntryErrorMessage(e(403, "SUPPORT_ACCESS_DENIED"))).toMatch(/não autorizou/);
    expect(supportEntryErrorMessage(e(403, "IMPERSONATION_FORBIDDEN"))).toMatch(/outra sessão de suporte/);
    expect(supportEntryErrorMessage(e(400))).toMatch(/própria conta/);
    expect(supportEntryErrorMessage(e(404))).toMatch(/não encontrado/);
    expect(supportEntryErrorMessage(e(500, undefined, "Falhou algo"))).toBe("Falhou algo");
  });
});
