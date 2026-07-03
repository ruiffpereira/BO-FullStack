import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// A página /signup (T8) é conduzida por 3 hooks gerados:
//   - useGetBillingCatalog (público, catálogo de preços — passo 2)
//   - usePostUsersSignup (submeter o formulário)
//   - usePostUsersSignupResend (reenviar o email de verificação)
// Mockamos os 3 para testar o fluxo sem servidor, como o Faturacao.test.tsx faz.

const catalogMock = vi.fn();
const signupMutateMock = vi.fn();
let signupOptions: any;
const resendMutateMock = vi.fn();
let resendOptions: any;

vi.mock("../../src/gen/backoffice/hooks/useGetBillingCatalog", () => ({
  useGetBillingCatalog: () => catalogMock(),
}));

vi.mock("../../src/gen/backoffice/hooks/usePostUsersSignup", () => ({
  usePostUsersSignup: (options: any) => {
    signupOptions = options;
    return {
      mutate: (vars: any) => {
        signupMutateMock(vars);
      },
      isPending: false,
    };
  },
}));

vi.mock("../../src/gen/backoffice/hooks/usePostUsersSignupResend", () => ({
  usePostUsersSignupResend: (options: any) => {
    resendOptions = options;
    return {
      mutate: (vars: any) => {
        resendMutateMock(vars);
      },
      isPending: false,
    };
  },
}));

import { Signup } from "../../src/pages/Signup";

const CATALOG = [
  { module: "agenda", label: "Agenda", monthlyAmountEur: 15, monthlyAmountCents: 1500 },
  { module: "gym", label: "Ginásio", monthlyAmountEur: 30, monthlyAmountCents: 3000 },
  { module: "loja", label: "Loja", monthlyAmountEur: 20, monthlyAmountCents: 2000 },
];

// Catálogo público SEM "loja" — simula um módulo indisponível (o endpoint só
// devolve módulos ATIVOS; um módulo ausente é o mesmo que "indisponível" do
// ponto de vista do signup, ver FIX 2).
const CATALOG_NO_LOJA = CATALOG.filter((c) => c.module !== "loja");

function mockCatalog(data = CATALOG, opts: { isLoading?: boolean; isError?: boolean } = {}) {
  catalogMock.mockReturnValue({
    data,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
  });
}

function renderSignup(path = "/signup") {
  window.history.pushState({}, "", path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Signup theme="light" onToggleTheme={() => {}} />
    </MemoryRouter>,
  );
}

// O total (passo 2) e o preço por módulo partilham o mesmo formato ("X,XX €");
// o preço por módulo tem "/mês" colado ao mesmo nó de texto (ex.: "15,00 €/mês"),
// o total não. Ancorar com ^...$ evita apanhar as duas ocorrências ao mesmo tempo
// (dom-testing-library só olha para os nós de texto diretos de cada elemento).
function totalText(eurValue: string) {
  return new RegExp(`^${eurValue}\\s*€$`);
}

function fillStep1(vertical = "Ginásio") {
  fireEvent.click(screen.getByRole("radio", { name: vertical }));
  fireEvent.change(screen.getByLabelText("Nome do negócio"), { target: { value: "O Meu Ginásio" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "dono@ginasio.pt" } });
  fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCatalog();
  signupOptions = undefined;
  resendOptions = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Signup — passo 1 (negócio)", () => {
  it("pré-seleciona a vertical vinda da query string e ignora uma inválida", () => {
    renderSignup("/signup?vertical=gym");
    expect(screen.getByRole("radio", { name: "Ginásio" })).toBeChecked();
  });

  it("vertical inválida na query string é ignorada (nenhuma pré-selecionada)", () => {
    renderSignup("/signup?vertical=not-a-vertical");
    for (const label of ["Barbearia/Salão", "Ginásio", "Loja", "Outro"]) {
      expect(screen.getByRole("radio", { name: label })).not.toBeChecked();
    }
  });

  it("valida campos antes de avançar para o passo 2", () => {
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    expect(screen.getByText("Escolhe o tipo de negócio.")).toBeInTheDocument();
    expect(screen.getByText("Nome do negócio demasiado curto.")).toBeInTheDocument();
    expect(screen.getByText("Introduz um email válido.")).toBeInTheDocument();
    expect(screen.queryByText("Escolhe o teu plano")).not.toBeInTheDocument();
  });

  it("tem um link para o login", () => {
    renderSignup();
    expect(screen.getByRole("link", { name: /entrar/i })).toHaveAttribute("href", "/login");
  });
});

describe("Signup — passo 2 (plano): pré-seleção por vertical + total", () => {
  it("a vertical escolhida pré-seleciona os módulos certos", () => {
    renderSignup();
    fillStep1("Ginásio");

    expect(screen.getByText("Escolhe o teu plano")).toBeInTheDocument();
    expect(screen.getByLabelText("Ginásio")).toBeChecked();
    expect(screen.getByLabelText("Agenda")).not.toBeChecked();
    expect(screen.getByLabelText("Loja")).not.toBeChecked();
    // Total = preço do módulo pré-selecionado (Ginásio, 30€)
    expect(screen.getByText(totalText("30,00"))).toBeInTheDocument();
  });

  it("barbearia pré-seleciona Agenda", () => {
    renderSignup();
    fillStep1("Barbearia/Salão");
    expect(screen.getByLabelText("Agenda")).toBeChecked();
  });

  it("loja pré-seleciona Loja", () => {
    renderSignup();
    fillStep1("Loja");
    expect(screen.getByLabelText("Loja")).toBeChecked();
  });

  it('"Outro" não pré-seleciona nenhum módulo', () => {
    renderSignup();
    fillStep1("Outro");
    expect(screen.getByLabelText("Agenda")).not.toBeChecked();
    expect(screen.getByLabelText("Ginásio")).not.toBeChecked();
    expect(screen.getByLabelText("Loja")).not.toBeChecked();
    expect(screen.getByText(totalText("0,00"))).toBeInTheDocument();
  });

  it("o total recomputa ao marcar/desmarcar módulos", () => {
    renderSignup();
    fillStep1("Ginásio"); // Ginásio (30€) pré-marcado

    fireEvent.click(screen.getByLabelText("Agenda")); // +15€
    expect(screen.getByText(totalText("45,00"))).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Ginásio")); // -30€
    expect(screen.getByText(totalText("15,00"))).toBeInTheDocument();
  });
});

describe("Signup — catálogo de preços: loading/erro (FIX 1)", () => {
  it("enquanto o catálogo carrega, o total NÃO mostra €0,00 (mostra skeleton) e avisa 'a carregar preços'", () => {
    mockCatalog(CATALOG, { isLoading: true });
    renderSignup();
    fillStep1("Ginásio");

    expect(screen.queryByText(totalText("0,00"))).not.toBeInTheDocument();
    expect(screen.getByText("A carregar preços…")).toBeInTheDocument();
  });

  it("erro a carregar o catálogo mostra uma nota junto do total e desativa 'Criar conta'", () => {
    mockCatalog(CATALOG, { isError: true });
    renderSignup();
    fillStep1("Ginásio");

    // Total mostra "—", nunca €0,00 (pareceria grátis).
    expect(screen.queryByText(totalText("0,00"))).not.toBeInTheDocument();
    expect(screen.getByText(/não foi possível carregar os preços/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar conta/i })).toBeDisabled();
  });

  it("catálogo carregado normalmente: total correto e submit ativo (comportamento de hoje)", () => {
    mockCatalog();
    renderSignup();
    fillStep1("Ginásio");

    expect(screen.getByText(totalText("30,00"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar conta/i })).not.toBeDisabled();
  });
});

describe("Signup — módulos indisponíveis fora do catálogo público (FIX 2)", () => {
  it("um módulo fora do catálogo (loja) aparece desativado com badge 'Indisponível' e não pré-selecionado", () => {
    mockCatalog(CATALOG_NO_LOJA);
    renderSignup();
    fillStep1("Loja"); // a vertical "Loja" normalmente pré-seleciona o módulo Loja

    const lojaCheckbox = screen.getByLabelText("Loja");
    expect(lojaCheckbox).toBeDisabled();
    expect(lojaCheckbox).not.toBeChecked();
    expect(screen.getByText("Indisponível")).toBeInTheDocument();
  });

  it("o módulo indisponível não conta para o total", () => {
    mockCatalog(CATALOG_NO_LOJA);
    renderSignup();
    fillStep1("Loja");

    expect(screen.getByText(totalText("0,00"))).toBeInTheDocument();
  });

  it("os módulos disponíveis continuam normais (Agenda/Ginásio ficam ativos e marcáveis)", () => {
    mockCatalog(CATALOG_NO_LOJA);
    renderSignup();
    fillStep1("Loja");

    expect(screen.getByLabelText("Agenda")).not.toBeDisabled();
    expect(screen.getByLabelText("Ginásio")).not.toBeDisabled();
  });
});

describe("Signup — submissão", () => {
  it("envia businessName/email/vertical/modules corretamente", () => {
    renderSignup();
    fillStep1("Ginásio");
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));

    expect(signupMutateMock).toHaveBeenCalledTimes(1);
    expect(signupMutateMock).toHaveBeenCalledWith({
      data: {
        businessName: "O Meu Ginásio",
        email: "dono@ginasio.pt",
        vertical: "gym",
        modules: ["gym"],
      },
    });
  });

  it('sucesso mostra sempre o ecrã "Confirma o teu email" (role=status)', () => {
    renderSignup();
    fillStep1("Ginásio");
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));

    // Simula a resposta 200 do backend (anti-enumeração: sempre sucesso).
    act(() => {
      signupOptions.mutation.onSuccess();
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Confirma o teu email");
    expect(status).toHaveTextContent("dono@ginasio.pt");
  });
});

describe("Signup — reenvio de verificação", () => {
  function reachSentState() {
    renderSignup();
    fillStep1("Ginásio");
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    act(() => {
      signupOptions.mutation.onSuccess();
    });
  }

  it("o botão de reenvio começa desativado (cooldown) e ativa passado o tempo", () => {
    vi.useFakeTimers();
    reachSentState();

    const button = screen.getByRole("button", { name: /reenviar email/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/60s/);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole("button", { name: /^reenviar email$/i })).not.toBeDisabled();
  });

  it("clicar reenviar chama o endpoint de resend com o email", () => {
    vi.useFakeTimers();
    reachSentState();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    fireEvent.click(screen.getByRole("button", { name: /^reenviar email$/i }));
    expect(resendMutateMock).toHaveBeenCalledWith({ data: { email: "dono@ginasio.pt" } });

    // Reinicia o cooldown depois de um reenvio bem-sucedido.
    act(() => {
      resendOptions.mutation.onSuccess();
    });
    expect(screen.getByRole("button", { name: /reenviar email \(60s\)/i })).toBeDisabled();
  });
});
