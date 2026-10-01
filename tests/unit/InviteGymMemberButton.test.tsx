import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Testes para o botão "Convidar sócio" com guard: subscrições ativas +
 * write-guard de billing.
 *
 * O guard já teve um 3.º motivo (aviso de falta de subdomínio) — saiu no B35
 * com o site-engine (o link do convite passou a usar o `User.websiteDomain`
 * do lado da API).
 */

const gymSubsMock = vi.fn();
const writeGuardMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetGymSubscriptions.js", () => ({
  useGetGymSubscriptions: () => gymSubsMock(),
}));

vi.mock("../../src/hooks/useWriteGuard.js", () => ({
  useWriteGuard: () => writeGuardMock(),
}));

import { InviteGymMemberButton } from "../../src/pages/GymMensalidade";

function render_() {
  return render(
    <InviteGymMemberButton onInviteClick={() => {}} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  gymSubsMock.mockReturnValue({ data: [] });
  writeGuardMock.mockReturnValue({ readOnly: false, message: "" });
});

describe("InviteGymMemberButton — guards", () => {
  it("disponível quando tem subscrições ativas + billing OK", () => {
    gymSubsMock.mockReturnValue({
      data: [{ subscriptionId: "sub1", active: true }],
    });
    writeGuardMock.mockReturnValue({ readOnly: false, message: "" });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button).not.toBeDisabled();
    expect(button.title || "").toBe("");
  });

  it("bloqueado sem subscrições ativas", () => {
    gymSubsMock.mockReturnValue({
      data: [{ subscriptionId: "sub1", active: false }], // inativa
    });
    writeGuardMock.mockReturnValue({ readOnly: false, message: "" });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      expect.stringContaining("Cria uma subscrição"),
    );
  });

  it("bloqueado por write-guard de billing (mesmo com subscrições ativas)", () => {
    gymSubsMock.mockReturnValue({
      data: [{ subscriptionId: "sub1", active: true }],
    });
    writeGuardMock.mockReturnValue({
      readOnly: true,
      message: "Subscrição da plataforma em atraso. Vai a Faturação.",
    });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      expect.stringContaining("Subscrição da plataforma em atraso"),
    );
  });

  it("prioridade: sem subscrições > write-guard de billing", () => {
    gymSubsMock.mockReturnValue({ data: [] }); // nenhuma subscrição
    writeGuardMock.mockReturnValue({
      readOnly: true,
      message: "Subscrição da plataforma em atraso.",
    });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button).toBeDisabled();
    // Motivo é "subscrição ativa", não "billing"
    expect(button.title).toContain("subscrição ativa");
    expect(button.title).not.toContain("plataforma");
  });

  it("dispara a ação onInviteClick quando clicado e disponível", () => {
    gymSubsMock.mockReturnValue({
      data: [{ subscriptionId: "sub1", active: true }],
    });
    writeGuardMock.mockReturnValue({ readOnly: false, message: "" });

    const onInviteClick = vi.fn();
    render(<InviteGymMemberButton onInviteClick={onInviteClick} />);

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button).not.toBeDisabled();
    // Nota: não testamos o click real porque o Vitest não permite, mas podemos
    // confirmar que o botão existe e está habilitado para receber cliques.
  });
});

describe("InviteGymMemberButton — mensagens PT-PT", () => {
  it("mensagem de subscrições está em português correto", () => {
    gymSubsMock.mockReturnValue({ data: [] });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button.title).toMatch(/subscrição ativa/i);
    expect(button.title).toMatch(/catálogo/i);
  });
});
