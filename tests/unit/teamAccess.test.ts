import { describe, it, expect, vi, beforeEach } from "vitest";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import {
  notifyTeamForbidden,
  resetTeamForbiddenThrottle,
  teamErrorMessage,
  VIEW_ONLY_MESSAGE,
  OWNER_ONLY_MESSAGE,
} from "../../src/lib/teamAccess";
import { moduleForPath } from "../../src/lib/navigation";

beforeEach(() => {
  vi.clearAllMocks();
  resetTeamForbiddenThrottle();
});

describe("notifyTeamForbidden — backstop dos 403 da equipa", () => {
  it("TEAM_FORBIDDEN → toast 'Só tens permissão para ver'", () => {
    expect(notifyTeamForbidden(403, { code: "TEAM_FORBIDDEN" })).toBe(true);
    expect(toastError).toHaveBeenCalledWith(VIEW_ONLY_MESSAGE, expect.anything());
  });

  it("TEAM_OWNER_ONLY → toast 'Esta área é só do dono da conta'", () => {
    expect(notifyTeamForbidden(403, { code: "TEAM_OWNER_ONLY" })).toBe(true);
    expect(toastError).toHaveBeenCalledWith(OWNER_ONLY_MESSAGE, expect.anything());
    expect(OWNER_ONLY_MESSAGE).toBe("Esta área é só do dono da conta");
  });

  it("coalesce uma rajada num só toast", () => {
    notifyTeamForbidden(403, { code: "TEAM_FORBIDDEN" });
    notifyTeamForbidden(403, { code: "TEAM_FORBIDDEN" });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("ignora outros erros (outro 403, outro status)", () => {
    expect(notifyTeamForbidden(403, { code: "IMPERSONATION_FORBIDDEN" })).toBe(false);
    expect(notifyTeamForbidden(402, { code: "TEAM_FORBIDDEN" })).toBe(false);
    expect(notifyTeamForbidden(undefined, undefined)).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("teamErrorMessage", () => {
  const err = (code: string, error?: string) => ({ response: { data: { code, error } } });
  it("traduz os códigos conhecidos", () => {
    expect(teamErrorMessage(err("EMAIL_IN_USE"), "x")).toMatch(/já está a ser usado/);
    expect(teamErrorMessage(err("TEAM_LIMIT"), "x")).toMatch(/máximo/);
    expect(teamErrorMessage(err("TEAM_ADMIN_FORBIDDEN"), "x")).toMatch(/administrador/);
  });
  it("cai na mensagem da API e depois no fallback", () => {
    expect(teamErrorMessage(err("OUTRO", "Mensagem da API"), "x")).toBe("Mensagem da API");
    expect(teamErrorMessage({}, "fallback")).toBe("fallback");
  });
});

describe("moduleForPath", () => {
  it.each([
    ["/agenda", "agenda"],
    ["/agenda/marcacoes", "agenda"],
    ["/loja/encomendas", "loja"],
    ["/ginasio/clientes", "ginasio"],
    ["/clientes/leads", "clientes"],
    ["/despesas", "despesas"],
    ["/financeiro/despesas", "despesas"],
    ["/conteudos/emails", "conteudos"],
    ["/paginas", "paginas"],
    ["/mensagens", "mensagens"],
    ["/estatisticas", "estatisticas"],
  ])("%s → %s", (path, mod) => {
    expect(moduleForPath(path)).toBe(mod);
  });

  it("Dashboard, Financeiro (resto), Faturação, Perfil e Equipa não têm módulo", () => {
    for (const p of ["/dashboard", "/financeiro", "/financeiro/agenda", "/faturacao", "/perfil", "/equipa", "/agendamento"]) {
      expect(moduleForPath(p)).toBeUndefined();
    }
  });
});
