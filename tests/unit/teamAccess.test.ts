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
import { moduleForPath, leafForPath, memberSubitems, SUBMENU } from "../../src/lib/navigation";
import { canFromGrants } from "../../src/lib/teamTree";

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
    ["/despesas", "financeiro"],
    ["/financeiro/despesas", "financeiro"],
    ["/financeiro/ginasio", "financeiro"],
    ["/conteudos/emails", "conteudos"],
    ["/paginas", "paginas"],
    ["/mensagens", "mensagens"],
    ["/estatisticas", "estatisticas"],
  ])("%s → %s", (path, mod) => {
    expect(moduleForPath(path)).toBe(mod);
  });

  it("Dashboard, Financeiro (O Negócio/Agenda/Loja), Faturação, Perfil e Equipa não têm módulo", () => {
    for (const p of ["/dashboard", "/financeiro", "/financeiro/agenda", "/financeiro/loja", "/faturacao", "/perfil", "/equipa", "/agendamento"]) {
      expect(moduleForPath(p)).toBeUndefined();
    }
  });
});

describe("leafForPath — página/separador → folha da árvore", () => {
  it.each([
    ["/agenda", "agenda.marcacoes"],
    ["/agenda/marcacoes", "agenda.marcacoes"],
    ["/agenda/servicos", "agenda.servicos"],
    ["/agenda/config", "agenda.config"],
    ["/loja", "loja.produtos"],
    ["/loja/encomendas", "loja.encomendas"],
    ["/loja/categorias", "loja.categorias"],
    ["/ginasio", "ginasio.exercicios"],
    ["/ginasio/treinos", "ginasio.treinos"],
    ["/ginasio/planos", "ginasio.treinos"],
    ["/ginasio/clientes", "ginasio.clientes"],
    ["/clientes", "clientes.lista"],
    ["/clientes/leads", "clientes.leads"],
    ["/financeiro/ginasio", "financeiro.mensalidades"],
    ["/financeiro/despesas", "financeiro.despesas"],
    ["/conteudos", "conteudos.website"],
    ["/conteudos/produtos", "conteudos.produtos"],
    ["/conteudos/servicos", "conteudos.servicos"],
    ["/conteudos/ginasio", "conteudos.ginasio"],
    ["/conteudos/linguas", "conteudos.linguas"],
    ["/conteudos/emails", "conteudos.emails"],
    ["/conteudos/notificacoes", "conteudos.notificacoes"],
    ["/paginas", "paginas.rascunho"],
  ])("%s → %s", (path, leaf) => {
    expect(leafForPath(path)).toBe(leaf);
  });
});

describe("memberSubitems — submenus por folha", () => {
  const can = (leaves: Record<string, "view" | "edit">) => (key: string, level: "view" | "edit" = "view") =>
    canFromGrants(Object.entries(leaves).map(([k, l]) => ({ key: k, level: l })), key, level);

  it("Agenda: cada subitem pela sua folha; Configurações basta uma das duas", () => {
    expect(memberSubitems("/agenda", can({ "agenda.servicos": "view" })).map((i) => i.id)).toEqual(["servicos"]);
    expect(memberSubitems("/agenda", can({ "agenda.bloqueios": "view" })).map((i) => i.id)).toEqual(["config"]);
    expect(memberSubitems("/agenda", can({ "agenda.marcacoes": "edit" })).map((i) => i.id)).toEqual(["cal", "marcacoes"]);
  });
  it("Financeiro: só Ginásio (mensalidades) e Despesas; O Negócio/Agenda/Loja nunca", () => {
    const all = can({ "financeiro.mensalidades": "view", "financeiro.despesas": "edit", "agenda.marcacoes": "edit" });
    expect(memberSubitems("/financeiro", all).map((i) => i.id)).toEqual(["ginasio", "despesas"]);
  });
  it("Conteúdos: os 7 separadores têm folha; Ginásio: Planos e Dia de Treino pela mesma folha", () => {
    expect(SUBMENU["/conteudos"].every((i) => !!i.leaf)).toBe(true);
    expect(memberSubitems("/ginasio", can({ "ginasio.treinos": "view" })).map((i) => i.id)).toEqual(["treinos", "planos"]);
  });
  it("sem folha nenhuma → grupo vazio (some da sidebar)", () => {
    for (const root of Object.keys(SUBMENU).filter((r) => r !== "/admin")) {
      expect(memberSubitems(root, can({}))).toEqual([]);
    }
  });
  it("todo o subitem tem folha ou é só do dono (default-deny para membros)", () => {
    for (const root of Object.keys(SUBMENU).filter((r) => r !== "/admin")) {
      for (const it of SUBMENU[root]) expect(!!it.leaf || !!it.ownerOnly).toBe(true);
    }
  });
});
