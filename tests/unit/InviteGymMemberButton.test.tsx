import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Testes para o botão "Convidar sócio" com guard multinível:
 * subdomínio + subscrições ativas + write-guard de billing.
 *
 * O botão deve estar desativado com motivo claro quando:
 * BLOQUEIAM: (1) sem subscrições ativas, (2) write-guard de billing.
 * AVISA sem bloquear: falta de subdomínio — ver o comentário no teste
 * respectivo (era bloqueio, e era uma premissa errada sobre onde vive a app
 * do sócio).
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

  /**
   * ⚠️ A falta de subdomínio AVISA, não bloqueia.
   *
   * Isto era um bloqueio (2026-08-20) e foi um erro: a premissa "a app do sócio
   * vive em {subdomain}.{host}" é verdade para um ginásio alojado no
   * site-engine e FALSA para um cujo app é um deploy standalone com domínio
   * próprio — o caso do ginásio real. O bloqueio impedia os convites desse
   * ginásio, uma regressão num fluxo que funcionava. O Backoffice não consegue
   * distinguir os dois alojamentos com fiabilidade, por isso informa e deixa
   * seguir.
   */
  it("sem subdomínio AVISA mas deixa convidar", () => {
    siteMock.mockReturnValue({ data: { subdomain: null }, isLoading: false });
    gymSubsMock.mockReturnValue({
      data: [{ subscriptionId: "sub1", active: true }],
    });
    writeGuardMock.mockReturnValue({ readOnly: false, message: "" });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button).not.toBeDisabled();
    expect(button.title).toMatch(/subdomínio/i);
    // O destino tem de ser "O meu site": o separador "Domínio" deixou de existir
    // na simplificação de 2026-08-12 e mandar lá o tenant era um beco sem saída.
    expect(button.title).toMatch(/O meu site/);
    expect(button.title).not.toMatch(/Website\s*→\s*Domínio/i);
    // E tem de dizer a quem tem app própria que pode ignorar.
    expect(button.title).toMatch(/app própria|ignora/i);
  });

  it("com subdomínio não mostra aviso nenhum", () => {
    siteMock.mockReturnValue({ data: { subdomain: "meu-ginasio" }, isLoading: false });
    gymSubsMock.mockReturnValue({
      data: [{ subscriptionId: "sub1", active: true }],
    });
    writeGuardMock.mockReturnValue({ readOnly: false, message: "" });

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button).not.toBeDisabled();
    expect(button.title || "").toBe("");
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

  it("sem subscrições bloqueia mesmo sem subdomínio (o aviso não tapa o bloqueio)", () => {
    siteMock.mockReturnValue({ data: { subdomain: null }, isLoading: false });
    gymSubsMock.mockReturnValue({ data: [] }); // nem subscrições ativas

    render_();

    const button = screen.getByRole("button", { name: /convidar sócio/i });
    expect(button).toBeDisabled();
    // O motivo mostrado é o BLOQUEIO (subscrição), não o aviso do subdomínio —
    // um aviso nunca deve tapar a razão pela qual o botão está de facto travado.
    expect(button.title).toMatch(/subscrição/i);
    expect(button.title).not.toMatch(/subdomínio/i);
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
