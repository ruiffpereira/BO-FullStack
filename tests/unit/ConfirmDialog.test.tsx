import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "../../src/components/ConfirmDialog";

const base = {
  open: true,
  onClose: () => {},
  onConfirm: () => {},
  title: "Eliminar item?",
  description: "Esta ação é permanente.",
};

describe("ConfirmDialog", () => {
  it("não renderiza nada quando fechado", () => {
    render(<ConfirmDialog {...base} open={false} />);
    expect(screen.queryByText("Eliminar item?")).not.toBeInTheDocument();
  });

  it("mostra título, descrição e ações por defeito", () => {
    render(<ConfirmDialog {...base} />);
    expect(screen.getByText("Eliminar item?")).toBeInTheDocument();
    expect(screen.getByText("Esta ação é permanente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("chama onConfirm ao confirmar e onClose ao cancelar", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("usa labels de confirmação personalizados", () => {
    render(<ConfirmDialog {...base} confirmLabel="Apagar tudo" />);
    expect(screen.getByRole("button", { name: "Apagar tudo" })).toBeInTheDocument();
  });

  it("em estado pendente mostra pendingLabel e desativa as ações", () => {
    render(<ConfirmDialog {...base} isPending pendingLabel="A eliminar…" />);
    expect(screen.getByText("A eliminar…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
