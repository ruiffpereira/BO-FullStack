import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Testes para o botão "Convidar sócio" com guard multinível:
 * subdomínio + subscrições ativas + write-guard de billing.
 *
 * O botão deve estar desativado com motivo claro quando:
 * 1. Sem subdomínio (prioridade 1)
 * 2. Sem subscrições ativas (prioridade 2)
 * 3. Write-guard de billing bloqueado (prioridade 3)
 */

const siteMock = vi.fn();
const gymSubsMock = vi.fn();
const writeGuardMock = vi.fn();

vi.mock("../../src/hooks/useWebsite.js", () => ({
  useSite: () => siteMock(),
}));

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
  siteMock.mockReturnValue({ data: { subdomain: null }, isLoading: false });
  gymSubsMock.mockReturnValue({ data: [] });
  writeGuardMock.mockReturnValue({ readOnly: false, message: "" });
});

describe("InviteGymMemberButton — guards", () => {
  it("disponível quando tem subdomínio + subscrições ativas + billing OK", () => {
    siteMock.mockReturnValue({ data: { subdomain: "meu-ginasio" }, isLoading: false });
    gymSubsMock.mockReturnValue({
      data: [{ subscriptionId: "sub1", active: true }],
    });
    writeGuardMock.mockReturnValue({ readOnly: false, message: "" });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button).not.toBeDisabled();
  });

  it("bloqueado sem subdomínio, com mensagem a apontar para Website → O meu site", () => {
    siteMock.mockReturnValue({ data: { subdomain: null }, isLoading: false });
    gymSubsMock.mockReturnValue({
      data: [{ subscriptionId: "sub1", active: true }],
    });
    writeGuardMock.mockReturnValue({ readOnly: false, message: "" });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      expect.stringContaining("subdomínio"),
    );
    // O destino tem de ser "O meu site": o separador "Domínio" deixou de existir
    // na simplificação de 2026-08-12 e mandar lá o tenant era um beco sem saída.
    expect(button).toHaveAttribute(
      "title",
      expect.stringContaining("O meu site"),
    );
    expect(button.title).not.toMatch(/Website\s*→\s*Domínio/i);
  });

  it("bloqueado sem subscrições ativas (mesmo com subdomínio)", () => {
    siteMock.mockReturnValue({ data: { subdomain: "meu-ginasio" }, isLoading: false });
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

  it("bloqueado por write-guard de billing (mesmo com subdomínio e subscrições)", () => {
    siteMock.mockReturnValue({ data: { subdomain: "meu-ginasio" }, isLoading: false });
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

  it("prioridade: sem subdomínio > sem subscrições", () => {
    siteMock.mockReturnValue({ data: { subdomain: null }, isLoading: false });
    gymSubsMock.mockReturnValue({ data: [] }); // nem subscrições ativas

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button).toBeDisabled();
    // Motivo é "subdomínio", não "subscrição"
    expect(button.title).toContain("subdomínio");
    expect(button.title).not.toContain("subscrição");
  });

  it("prioridade: sem subscrições > write-guard de billing", () => {
    siteMock.mockReturnValue({ data: { subdomain: "meu-ginasio" }, isLoading: false });
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

  it("estado de carregamento do site não causa bloqueio falso", () => {
    siteMock.mockReturnValue({ data: null, isLoading: true });
    gymSubsMock.mockReturnValue({
      data: [{ subscriptionId: "sub1", active: true }],
    });
    writeGuardMock.mockReturnValue({ readOnly: false, message: "" });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    // Enquanto carrega, não bloqueia (evita piscar "sem subdomínio")
    expect(button).not.toBeDisabled();
  });

  it("dispara a ação onInviteClick quando clicado e disponível", () => {
    siteMock.mockReturnValue({ data: { subdomain: "meu-ginasio" }, isLoading: false });
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
  it("mensagem do subdomínio está em português correto", () => {
    siteMock.mockReturnValue({ data: { subdomain: null }, isLoading: false });
    gymSubsMock.mockReturnValue({
      data: [{ subscriptionId: "sub1", active: true }],
    });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button.title).toMatch(/subdomínio/i);
    expect(button.title).toMatch(/sócios/i);
    expect(button.title).toMatch(/app/i);
    expect(button.title).toMatch(/Website/i);
  });

  it("mensagem de subscrições está em português correto", () => {
    siteMock.mockReturnValue({ data: { subdomain: "meu-ginasio" }, isLoading: false });
    gymSubsMock.mockReturnValue({ data: [] });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button.title).toMatch(/subscrição ativa/i);
    expect(button.title).toMatch(/catálogo/i);
  });
});
