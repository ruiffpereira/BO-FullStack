import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// Admin → "Domínios permitidos" (CORS). Mesma técnica do Admin.test.tsx: hooks gerados
// mockados por caminho de import; capturamos as `options.mutation` que o componente passa
// aos hooks para testar o que a página faz com o resultado (mensagens por código de erro).

const getMock = vi.fn();
const addMutate = vi.fn();
let addOptions: any = null;
const removeMutate = vi.fn();
const confirmMock = vi.fn();
const authMock = vi.fn();

vi.mock("../../src/gen/backoffice/hooks/useGetAdminCorsOrigins.js", () => ({
  useGetAdminCorsOrigins: () => getMock(),
  getAdminCorsOriginsQueryKey: () => [{ url: "/admin/cors-origins" }],
}));
vi.mock("../../src/gen/backoffice/hooks/usePostAdminCorsOrigins.js", () => ({
  usePostAdminCorsOrigins: (opts: any) => {
    addOptions = opts;
    return { mutate: addMutate, isPending: false };
  },
}));
vi.mock("../../src/gen/backoffice/hooks/useDeleteAdminCorsOriginsCorsoriginid.js", () => ({
  useDeleteAdminCorsOriginsCorsoriginid: () => ({ mutate: removeMutate, isPending: false }),
}));
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => authMock(),
}));
vi.mock("../../src/components/confirm", () => ({
  confirmDialog: (...a: unknown[]) => confirmMock(...a),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import { Admin } from "../../src/pages/Admin";

const DATA = {
  extra: [{ corsOriginId: "c1", domain: "extra.example.pt", createdAt: "2026-10-10T10:00:00.000Z" }],
  tenants: [{ userId: "u1", name: "Barbearia Central", domain: "barbearia.pt" }],
  env: ["https://bo.example.com"],
};

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Admin view="dominios" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  addOptions = null;
  getMock.mockReturnValue({ data: DATA, isLoading: false });
  authMock.mockReturnValue({ authHeader: () => ({}), userId: "admin-1" });
});

describe("Admin — Domínios permitidos", () => {
  it("mostra os extra, os websites dos clientes e as origens do servidor", () => {
    renderView();
    expect(screen.getByText("extra.example.pt")).toBeInTheDocument();
    expect(screen.getByText("Barbearia Central")).toBeInTheDocument();
    expect(screen.getByText("barbearia.pt")).toBeInTheDocument();
    expect(screen.getByText("Definido no servidor")).toBeInTheDocument();
    expect(screen.getByText("https://bo.example.com")).toBeInTheDocument();
  });

  it("estados vazios", () => {
    getMock.mockReturnValue({ data: { extra: [], tenants: [], env: [] }, isLoading: false });
    renderView();
    expect(screen.getByText("Sem domínios extra")).toBeInTheDocument();
    expect(screen.getByText("Nenhum cliente tem website definido.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma origem definida.")).toBeInTheDocument();
  });

  it("adicionar: envia o domínio sem espaços; vazio não envia", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(addMutate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Introduz um domínio");

    fireEvent.change(screen.getByPlaceholderText("exemplo.pt"), { target: { value: "  novo.example.pt " } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(addMutate).toHaveBeenCalledWith({ data: { domain: "novo.example.pt" } });

    act(() => {
      addOptions.mutation.onSuccess();
    });
    expect(toastSuccess).toHaveBeenCalledWith("Domínio permitido");
    expect((screen.getByPlaceholderText("exemplo.pt") as HTMLInputElement).value).toBe("");
  });

  it("409 e 400 mostram a mensagem certa", () => {
    renderView();
    act(() => {
      addOptions.mutation.onError({ response: { status: 409 } });
    });
    expect(toastError).toHaveBeenCalledWith("Esse domínio já está permitido.");
    act(() => {
      addOptions.mutation.onError({ response: { status: 400 } });
    });
    expect(toastError).toHaveBeenCalledWith("Domínio inválido.");
  });

  it("remover pede confirmação: recusa não apaga, aceita apaga", async () => {
    renderView();
    const row = screen.getByText("extra.example.pt").closest("li")!;

    confirmMock.mockResolvedValueOnce(false);
    fireEvent.click(within(row).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    expect(removeMutate).not.toHaveBeenCalled();

    confirmMock.mockResolvedValueOnce(true);
    fireEvent.click(within(row).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(removeMutate).toHaveBeenCalledWith({ corsOriginId: "c1" }));
  });
});
