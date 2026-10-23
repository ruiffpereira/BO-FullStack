import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// UM só sistema de confirmação: o `confirmDialog` imperativo desenha o `ConfirmDialog` (GuardButton) —
// o write-guard (EQ-03) tem de valer neste caminho tal como no uso declarativo.
const billingMock = vi.fn();
vi.mock("../../src/gen/backoffice/hooks/useGetBillingSubscription", () => ({
  useGetBillingSubscription: () => billingMock(),
}));
const authMock = vi.fn();
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => authMock() }));

import { ConfirmHost, confirmDialog } from "../../src/components/confirm";

function renderHost() {
  return render(
    <MemoryRouter initialEntries={["/agenda"]}>
      <ConfirmHost />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  billingMock.mockReturnValue({ data: { readOnly: false, reason: "active" } });
  authMock.mockReturnValue({ isMember: false, member: null, can: () => true });
});

describe("confirmDialog (imperativo) → ConfirmDialog", () => {
  it("confirmar resolve true; título e mensagem aparecem", async () => {
    renderHost();
    let result: Promise<boolean> | undefined;
    act(() => {
      result = confirmDialog({ title: "Eliminar «X»?", message: "Não se desfaz.", danger: true });
    });
    expect(await screen.findByText("Eliminar «X»?")).toBeInTheDocument();
    expect(screen.getByText("Não se desfaz.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await expect(result).resolves.toBe(true);
    expect(screen.queryByText("Eliminar «X»?")).toBeNull();
  });

  it("cancelar resolve false; labels personalizados e confirmação não destrutiva", async () => {
    renderHost();
    let result: Promise<boolean> | undefined;
    act(() => {
      result = confirmDialog({ title: "Enviar agora?", confirmLabel: "Enviar agora", cancelLabel: "Voltar" });
    });
    expect(await screen.findByRole("button", { name: "Enviar agora" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await expect(result).resolves.toBe(false);
  });

  it("EQ-03: billing read-only → o botão de confirmar fica desactivado (não resolve true)", async () => {
    billingMock.mockReturnValue({ data: { readOnly: true, reason: "past_due_locked" } });
    renderHost();
    let result: Promise<boolean> | undefined;
    act(() => {
      result = confirmDialog({ title: "Apagar?", danger: true });
    });
    expect(await screen.findByRole("button", { name: "Eliminar" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await expect(result).resolves.toBe(false);
  });

  it("EQ-03: membro só-ver → o botão de confirmar fica desactivado", async () => {
    authMock.mockReturnValue({ isMember: true, member: { id: "m1" }, can: () => false });
    renderHost();
    let result: Promise<boolean> | undefined;
    act(() => {
      result = confirmDialog({ title: "Apagar?", danger: true });
    });
    expect(await screen.findByRole("button", { name: "Eliminar" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await expect(result).resolves.toBe(false);
  });

  it("guard:false (revogar o acesso do suporte) → mesmo com billing read-only o confirmar fica activo e resolve true", async () => {
    billingMock.mockReturnValue({ data: { readOnly: true, reason: "past_due_locked" } });
    renderHost();
    let result: Promise<boolean> | undefined;
    act(() => {
      result = confirmDialog({ title: "Revogar?", confirmLabel: "Revogar acesso", danger: true, guard: false });
    });
    const btn = await screen.findByRole("button", { name: "Revogar acesso" });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    await expect(result).resolves.toBe(true);
  });
});
