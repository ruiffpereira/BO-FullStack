import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox } from "../../src/components/Combobox";

const options = [
  { value: "a", label: "Apple" },
  { value: "b", label: "Banana" },
  { value: "c", label: "Cherry" },
];

describe("Combobox", () => {
  it("mostra o placeholder quando não há valor", () => {
    render(<Combobox value="" onChange={() => {}} options={options} placeholder="Escolher fruta" />);
    expect(screen.getByText("Escolher fruta")).toBeInTheDocument();
  });

  it("mostra o label da opção selecionada", () => {
    render(<Combobox value="b" onChange={() => {}} options={options} />);
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("abre o menu e lista todas as opções", async () => {
    const user = userEvent.setup();
    render(<Combobox value="" onChange={() => {}} options={options} />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cherry" })).toBeInTheDocument();
  });

  it("filtra as opções pela pesquisa", async () => {
    const user = userEvent.setup();
    render(<Combobox value="" onChange={() => {}} options={options} searchPlaceholder="Pesquisar fruta" />);
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText("Pesquisar fruta"), "ban");
    expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Apple" })).not.toBeInTheDocument();
  });

  it('mostra "Sem resultados" quando nada corresponde', async () => {
    const user = userEvent.setup();
    render(<Combobox value="" onChange={() => {}} options={options} />);
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByRole("textbox"), "zzz");
    expect(screen.getByText("Sem resultados")).toBeInTheDocument();
  });

  it("chama onChange com o value ao escolher uma opção", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Combobox value="" onChange={onChange} options={options} />);
    await user.click(screen.getByRole("button"));
    // A opção é um <li role="option"> com um <button> interno — clicar no botão.
    await user.click(screen.getByRole("button", { name: "Cherry" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("não abre o menu quando disabled", async () => {
    const user = userEvent.setup();
    render(<Combobox value="" onChange={() => {}} options={options} disabled />);
    await user.click(screen.getByRole("button"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
