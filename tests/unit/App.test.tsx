import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// App.tsx (FIX 6) decide entre Signup/SetupPassword/Login/Shell só a partir de
// useAuth() (AuthContext) + a pathname. Mockamos o AuthContext e substituímos
// Shell/Login/SetupPassword/Signup por stubs leves — Shell normalmente renderiza
// <Routes> com todas as páginas (Dashboard, Agenda, ...), que precisariam de
// QueryClientProvider + dezenas de hooks gerados; como o stub não renderiza
// `children`, essas rotas nunca chegam a montar.
//
// App.tsx usa useThemeSync (T3.4) — GET/PUT /users/me (hooks gerados) +
// useQueryClient. Mockamos os hooks gerados (nenhum destes testes de routing
// exercita o toggle de tema) e envolvemos num QueryClientProvider real, mesmo
// padrão de tests/unit/Perfil.test.tsx/useThemeSync.test.tsx.

const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));

vi.mock("../../src/gen/backoffice/hooks/useGetUsersMe", () => ({
  useGetUsersMe: () => ({ data: undefined }),
  getUsersMeQueryKey: () => [{ url: "/users/me" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePutUsersMe", () => ({
  usePutUsersMe: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../src/components/Shell", () => ({
  Shell: () => <div data-testid="shell">shell</div>,
}));
vi.mock("../../src/components/Login", () => ({
  Login: () => <div data-testid="login">login</div>,
}));
vi.mock("../../src/pages/SetupPassword", () => ({
  SetupPassword: () => <div data-testid="setup-password">setup-password</div>,
}));
vi.mock("../../src/pages/Signup", () => ({
  Signup: () => <div data-testid="signup">signup</div>,
}));

import App from "../../src/App";

function mockAuth(opts: { isAuthenticated: boolean; initializing: boolean }) {
  authMock.mockReturnValue(opts);
}

function renderApp(path: string) {
  window.history.pushState({}, "", path);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("App — /signup com sessão autenticada (FIX 6)", () => {
  it("visitante não autenticado vê o /signup normalmente", () => {
    mockAuth({ isAuthenticated: false, initializing: false });
    renderApp("/signup");

    expect(screen.getByTestId("signup")).toBeInTheDocument();
    expect(screen.queryByTestId("shell")).not.toBeInTheDocument();
  });

  it("tenant já autenticado em /signup é redirecionado para o dashboard (Shell), não vê o formulário público", () => {
    mockAuth({ isAuthenticated: true, initializing: false });
    renderApp("/signup");

    expect(screen.queryByTestId("signup")).not.toBeInTheDocument();
    expect(screen.getByTestId("shell")).toBeInTheDocument();
  });

  it("enquanto a sessão ainda está a inicializar, /signup continua acessível (não corta o fluxo de um visitante)", () => {
    // initializing=true e isAuthenticated ainda não resolvido (false por omissão) —
    // só redireciona depois de a sessão estar resolvida.
    mockAuth({ isAuthenticated: false, initializing: true });
    renderApp("/signup");

    expect(screen.getByTestId("signup")).toBeInTheDocument();
  });

  it("/setup-password continua público e não é afetado por este fix", () => {
    mockAuth({ isAuthenticated: true, initializing: false });
    renderApp("/setup-password");

    expect(screen.getByTestId("setup-password")).toBeInTheDocument();
  });
});
