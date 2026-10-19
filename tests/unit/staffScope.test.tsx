import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { grantScope, grantScopeAll, type GrantEntry } from "../../src/lib/teamTree";
import { fixedStaff, staffPickOptions, staffPriceHint, UNLINKED_STAFF_MESSAGE } from "../../src/lib/staffFilter";
import { memberLinkOptions } from "../../src/lib/staffMemberLink";

const GRANTS: GrantEntry[] = [
  { key: "agenda.marcacoes", level: "edit", scope: "meus" },
  { key: "financeiro.negocio", level: "view", scope: "meus" },
  { key: "financeiro.agenda", level: "view" },
];

describe("scopeOf — âmbito das folhas da sessão", () => {
  it("meus só onde a API o deu; sem grant ou sem scope = todos", () => {
    expect(grantScope(GRANTS, "agenda.marcacoes")).toBe("meus");
    expect(grantScope(GRANTS, "financeiro.agenda")).toBe("todos");
    expect(grantScope(GRANTS, "loja.encomendas")).toBe("todos");
    expect(grantScope([], "agenda.marcacoes")).toBe("todos");
  });

  it("várias folhas: meus só se todas as que a sessão tem são «Só os meus»", () => {
    expect(grantScopeAll(GRANTS, ["agenda.marcacoes", "financeiro.negocio"])).toBe("meus");
    expect(grantScopeAll(GRANTS, ["financeiro.negocio", "financeiro.agenda"])).toBe("todos");
    expect(grantScopeAll(GRANTS, ["financeiro.negocio", "loja.encomendas"])).toBe("meus"); // a que não tem não conta
    expect(grantScopeAll(GRANTS, ["loja.encomendas"])).toBe("todos");
  });
});

describe("staffFilter — âmbito fixo e dica de serviço", () => {
  const STAFF = [
    { staffId: "a1", name: "Tiago", active: true, doesService: true, price: 18 },
    { staffId: "b2", name: "Rita", active: true, doesService: false, price: null },
  ];

  it("fixedStaff: o ligado, ou 'sem ligação' quando staffId é null", () => {
    expect(fixedStaff(STAFF, "a1")).toEqual({ linked: true, staffId: "a1", name: "Tiago" });
    expect(fixedStaff(STAFF, null)).toEqual({ linked: false });
  });

  it("staffPriceHint: preço quando existe; aviso quando não faz o serviço; nada sem preço", () => {
    expect(staffPriceHint(STAFF, "a1")).toBe("Preço com este profissional: 18.00€");
    expect(staffPriceHint(STAFF, "b2")).toMatch(/não faz este serviço/);
    expect(staffPriceHint([{ staffId: "c3" }], "c3")).toBeNull();
    expect(staffPriceHint(STAFF, "")).toBeNull();
  });

  it("staffPickOptions: quem não faz o serviço fica indicado e desactivado (o já escolhido não)", () => {
    const opts = staffPickOptions(STAFF, "");
    expect(opts.find((o) => o.value === "b2")).toMatchObject({ disabled: true });
    expect(opts.find((o) => o.value === "b2")?.label).toMatch(/não faz este serviço/);
    expect(opts.find((o) => o.value === "a1")?.disabled).toBeUndefined();
    expect(staffPickOptions(STAFF, "b2").find((o) => o.value === "b2")?.disabled).toBe(false);
  });
});

describe("memberLinkOptions — linkable-members", () => {
  const MEMBERS = [
    { memberId: "m1", name: "Ana", linkedStaffId: null },
    { memberId: "m2", name: "Rui", linkedStaffId: "s9" },
    { memberId: "m3", name: "Eva", linkedStaffId: "s1" },
  ];

  it("indica quem já está ligado a outro profissional (desactivado) e deixa o do próprio", () => {
    const opts = memberLinkOptions(MEMBERS, { staffId: "s1", staffNames: { s9: "Tiago" } });
    expect(opts[0]).toEqual({ value: "", label: "Sem ligação" });
    expect(opts.find((o) => o.value === "m1")).toEqual({ value: "m1", label: "Ana" });
    expect(opts.find((o) => o.value === "m2")).toMatchObject({ disabled: true, label: "Rui — já ligado a Tiago" });
    expect(opts.find((o) => o.value === "m3")).toEqual({ value: "m3", label: "Eva" });
  });

  it("ao criar (sem staffId) todos os já ligados ficam desactivados; ligação actual fora da lista mantém-se", () => {
    const opts = memberLinkOptions(MEMBERS, { current: { memberId: "m7", memberName: "Zé" } });
    expect(opts.filter((o) => o.disabled).map((o) => o.value)).toEqual(["m2", "m3"]);
    expect(opts.at(-1)).toEqual({ value: "m7", label: "Zé" });
  });
});

/* ───────────────────────── Componentes ───────────────────────── */

const teamMock = vi.fn();
const staffMock = vi.fn();
vi.mock("../../src/hooks/useTeamAccess", () => ({ useTeamAccess: () => teamMock() }));
vi.mock("../../src/hooks/useStaff", () => ({ useStaffOptions: () => staffMock() }));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
const linkableMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetScheduleStaffLinkableMembers.js", () => ({
  useGetScheduleStaffLinkableMembers: (o: unknown) => linkableMock(o),
}));

import { StaffFilterSelect, StaffField } from "../../src/components/StaffSelect";
import { StaffMemberLink } from "../../src/components/StaffMemberLink";

const STAFF_LIST = [
  { staffId: "a1", name: "Tiago", active: true },
  { staffId: "b2", name: "Rita", active: true },
];

function access(over: Record<string, unknown> = {}) {
  return {
    member: null,
    isMember: false,
    can: () => true,
    canAny: () => true,
    scopeOf: () => "todos",
    scopeOfAll: () => "todos",
    staffId: null,
    ...over,
  };
}

beforeEach(() => {
  teamMock.mockReset().mockReturnValue(access());
  staffMock.mockReset().mockReturnValue({ staff: STAFF_LIST, active: STAFF_LIST, hasStaff: true, isLoading: false });
  linkableMock.mockReset().mockReturnValue({ data: [], isError: false });
});

describe("StaffFilterSelect — «Só os meus»", () => {
  it("dono / âmbito Todos: selector completo (Global, Sem profissional, todos)", () => {
    render(<StaffFilterSelect value="all" onChange={() => {}} leaves={["financeiro.negocio"]} />);
    expect(screen.getByTestId("staff-filter")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Global" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Rita" })).toBeInTheDocument();
  });

  it("Só os meus: fica fixo no profissional ligado, sem Global/Sem profissional/outros", () => {
    teamMock.mockReturnValue(access({ isMember: true, scopeOfAll: () => "meus", staffId: "a1" }));
    render(<StaffFilterSelect value="all" onChange={() => {}} leaves={["financeiro.negocio"]} />);
    expect(screen.getByTestId("staff-filter-fixed")).toHaveTextContent("Tiago");
    expect(screen.queryByTestId("staff-filter")).toBeNull();
    expect(screen.queryByText("Global")).toBeNull();
    expect(screen.queryByText("Rita")).toBeNull();
  });

  it("Só os meus sem profissional ligado: mostra o aviso", () => {
    teamMock.mockReturnValue(access({ isMember: true, scopeOfAll: () => "meus", staffId: null }));
    render(<StaffFilterSelect value="all" onChange={() => {}} leaves={["financeiro.negocio"]} />);
    expect(screen.getByTestId("staff-filter-fixed")).toHaveTextContent(UNLINKED_STAFF_MESSAGE);
  });

  it("sem leaves não há âmbito (selectores de folhas sem «Só os meus»)", () => {
    teamMock.mockReturnValue(access({ isMember: true, scopeOfAll: () => "meus", staffId: "a1" }));
    render(<StaffFilterSelect value="all" onChange={() => {}} />);
    expect(screen.getByTestId("staff-filter")).toBeInTheDocument();
  });
});

describe("StaffField — «Só os meus» e dica do serviço", () => {
  it("Só os meus: mostra só o profissional ligado (a API força-o)", () => {
    teamMock.mockReturnValue(access({ isMember: true, scopeOfAll: () => "meus", staffId: "b2" }));
    render(<StaffField value="" onChange={() => {}} leaves={["agenda.marcacoes"]} />);
    expect(screen.getByTestId("staff-field-fixed")).toHaveTextContent("Rita");
    expect(screen.queryByTestId("staff-field")).toBeNull();
  });

  it("com serviceId mostra o preço efectivo vindo das options", () => {
    staffMock.mockReturnValue({
      staff: [{ staffId: "a1", name: "Tiago", active: true, doesService: true, price: 20 }],
      active: [],
      hasStaff: true,
      isLoading: false,
    });
    render(<StaffField value="a1" onChange={() => {}} serviceId="svc1" leaves={["agenda.marcacoes"]} />);
    expect(screen.getByText("Preço com este profissional: 20.00€")).toBeInTheDocument();
  });
});

describe("StaffMemberLink — linkable-members", () => {
  it("pede a lista sem exigir a folha equipa (basta Editar em agenda.profissionais)", () => {
    teamMock.mockReturnValue(access({ isMember: true, can: (k: string, l?: string) => k === "agenda.profissionais" && l === "edit" }));
    linkableMock.mockReturnValue({ data: [{ memberId: "m1", name: "Ana", linkedStaffId: null }], isError: false });
    render(<StaffMemberLink value="" onChange={() => {}} />);
    expect(linkableMock).toHaveBeenCalledWith({ query: expect.objectContaining({ enabled: true }) });
    expect(screen.getByText("Ligar a um membro da equipa (opcional)")).toBeInTheDocument();
  });

  it("sem Editar: não pede e mostra só a ligação actual", () => {
    teamMock.mockReturnValue(access({ isMember: true, can: () => false }));
    render(<StaffMemberLink value="" onChange={() => {}} currentMemberName="Ana" />);
    expect(linkableMock).toHaveBeenCalledWith({ query: expect.objectContaining({ enabled: false }) });
    expect(screen.getByTestId("staff-member-link-readonly")).toHaveTextContent("Ana");
  });

  it("403 (STAFF_LINK_FORBIDDEN): cai para o texto só-leitura", () => {
    linkableMock.mockReturnValue({ data: undefined, isError: true });
    render(<StaffMemberLink value="" onChange={() => {}} currentMemberName="Ana" />);
    expect(screen.getByTestId("staff-member-link-readonly")).toBeInTheDocument();
  });
});
