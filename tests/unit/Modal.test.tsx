import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../../src/ui/ui";

/**
 * Regressão (produção, 2026-09-28): a modal "bloqueava" à 1.ª letra. O efeito
 * do `Modal` tinha o `onClose` nas deps, e o pai passa `() => setOpen(false)`
 * — nova a cada render. Cada letra re-renderizava o pai, o efeito corria outra
 * vez e o foco saía do input. O e2e não o via: o `fill()` do Playwright escreve
 * tudo num só evento; aqui o `user.type` escreve tecla a tecla, como uma pessoa.
 */
function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <Modal
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Editar"
      >
        <input aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("o input mantém o foco enquanto se escreve (onClose inline no pai)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const input = screen.getByLabelText("Nome");
    await user.click(input);
    await user.type(input, "Ginásio");
    expect(input).toHaveValue("Ginásio");
    expect(input).toHaveFocus();
  });

  it("o Esc chama o onClose mais recente e fecha", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.type(screen.getByLabelText("Nome"), "abc");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
