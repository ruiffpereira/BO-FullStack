import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const upload = vi.hoisted(() => ({ image: vi.fn(), video: vi.fn(), pdf: vi.fn() }));
vi.mock("../../../src/gen/backoffice/hooks/useUploadImage.js", () => ({ uploadImage: upload.image }));
vi.mock("../../../src/gen/backoffice/hooks/useUploadVideo.js", () => ({ uploadVideo: upload.video }));
vi.mock("../../../src/gen/backoffice/hooks/useUploadPdf.js", () => ({ uploadPdf: upload.pdf }));

import { FieldRenderer } from "../../../src/pages/paginas/fields/FieldRenderer";
import { FieldsForm } from "../../../src/pages/paginas/fields/FieldsForm";
import { buildFieldCtx, orderedLanguages } from "../../../src/pages/paginas/fields/ctx";
import { editKey, setFieldValue } from "../../../src/pages/paginas/fields/edit";
import { isValidHref } from "../../../src/pages/paginas/fields/href";
import { applyMd } from "../../../src/pages/paginas/fields/md";
import type { FieldCtx } from "../../../src/pages/paginas/fields/types";
import { clearPending, pendingEntry } from "../../../src/pages/paginas/state/pending";
import { initState, reduce } from "../../../src/pages/paginas/state/store";
import type { FieldSpec, Issue } from "../../../src/pages/paginas/state/types";
import { block, sampleWork } from "./fixtures";

const mkCtx = (over: Partial<FieldCtx> = {}): FieldCtx => ({
  languages: ["pt", "en", "fr"],
  base: "pt",
  pages: [
    { id: "p1", title: "Início", path: "/", status: "published", isHome: true },
    { id: "p2", title: "Obras", path: "/obras", status: "published", isHome: false },
    { id: "p3", title: "Equipa", path: "/equipa", status: "draft", isHome: false },
    { id: "p4", title: "Contactos", path: "/contactos", status: "published", isHome: false },
  ],
  anchors: [{ blockId: "b9", name: "Contactos", anchor: "contactos", pageTitle: "Início" }],
  documents: [{ id: "d1", name: "Catálogo", media: { same: true, values: { pt: "https://cdn/catalogo.pdf" } } }],
  icons: [{ id: "escudo", label: "Escudo" }],
  issues: [],
  name: "text",
  path: "comps.c1.v.text",
  ...over,
});

const issue = (over: Partial<Issue>): Issue => ({ code: "BAD", entity: "block", id: "b1", message: "Problema do servidor.", ...over });

/** Campo controlado: o valor sobe por `onChange` e volta a descer, como no editor. */
function Controlled({ def, initial, ctx, spy }: { def: FieldSpec; initial?: unknown; ctx: FieldCtx; spy?: (v: unknown, key?: string) => void }) {
  const [v, setV] = useState<unknown>(initial);
  return (
    <FieldRenderer
      def={def}
      value={v}
      ctx={ctx}
      onChange={(nv, key) => {
        spy?.(nv, key);
        setV(nv);
      }}
    />
  );
}

beforeEach(() => {
  clearPending();
  upload.image.mockReset();
  upload.video.mockReset();
  upload.pdf.mockReset();
});

describe("text / md · com i18n", () => {
  const def: FieldSpec = { type: "text", i18n: true, max: 40 };

  it("uma caixa por língua DO TENANT, a base primeiro (nunca pt/en/fr fixos)", () => {
    const ctx = mkCtx({ languages: orderedLanguages({ languages: ["en", "es", "pt"], defaultLanguage: "pt" }) });
    render(<Controlled def={def} ctx={ctx} />);
    expect(screen.getAllByRole("textbox").map((e) => e.getAttribute("aria-label"))).toEqual(["Texto (PT)", "Texto (EN)", "Texto (ES)"]);
    expect(screen.queryByLabelText("Texto (FR)")).not.toBeInTheDocument();
  });

  it("falta tradução: caixa amarela 'Por traduzir' e contador", () => {
    render(<Controlled def={def} initial={{ pt: "Olá" }} ctx={mkCtx()} />);
    expect(screen.getByText("2 por traduzir")).toBeInTheDocument();
    expect(screen.getByLabelText("Texto (EN)")).toHaveAttribute("placeholder", "Por traduzir");
    expect(screen.getByLabelText("Texto (PT)")).toHaveAttribute("placeholder", "");
  });

  it("completo: 'Traduzido'; base vazia nunca falta nada", () => {
    const { unmount } = render(<Controlled def={def} initial={{ pt: "Olá", en: "Hi", fr: "Salut" }} ctx={mkCtx()} />);
    expect(screen.getByText("Traduzido")).toBeInTheDocument();
    unmount();
    render(<Controlled def={def} initial={{}} ctx={mkCtx()} />);
    expect(screen.queryByText(/por traduzir/)).not.toBeInTheDocument();
  });

  it("escrever sobe o objeto por língua, com o path como chave de junção", async () => {
    const spy = vi.fn();
    render(<Controlled def={def} initial={{ pt: "Olá" }} ctx={mkCtx()} spy={spy} />);
    await userEvent.type(screen.getByLabelText("Texto (EN)"), "Hi");
    expect(spy).toHaveBeenLastCalledWith({ pt: "Olá", en: "Hi" }, "comps.c1.v.text");
    expect(screen.getByText("1 por traduzir")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Texto (EN)"));
    expect(spy).toHaveBeenLastCalledWith({ pt: "Olá" }, "comps.c1.v.text");
  });

  it("mostra o issue do 422 na língua certa, só se o path for deste campo", () => {
    const ctx = mkCtx({
      issues: [
        issue({ path: "comps.c1.v.text", locale: "en", message: "Texto em inglês demasiado longo." }),
        issue({ path: "comps.c1.v.outro", message: "Isto é de outro campo." }),
      ],
    });
    render(<Controlled def={def} initial={{ pt: "a", en: "b" }} ctx={ctx} />);
    expect(screen.getByText("Texto em inglês demasiado longo.")).toBeInTheDocument();
    expect(screen.queryByText("Isto é de outro campo.")).not.toBeInTheDocument();
  });

  it("uma só língua no tenant: sem selos nem contador", () => {
    render(<Controlled def={def} ctx={mkCtx({ languages: ["pt"] })} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByText(/Traduzido|por traduzir/)).not.toBeInTheDocument();
  });
});

describe("text / md · sem i18n", () => {
  it("uma caixa, 'Igual em todas as línguas', valor string", async () => {
    const spy = vi.fn();
    render(<Controlled def={{ type: "text" }} ctx={mkCtx({ name: "price", path: "comps.c1.v.price" })} spy={spy} />);
    expect(screen.getByText("Igual em todas as línguas")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    await userEvent.type(screen.getByRole("textbox", { name: "Preço" }), "9");
    expect(spy).toHaveBeenLastCalledWith("9", "comps.c1.v.price");
  });

  it("issue sem locale aparece debaixo da caixa", () => {
    const ctx = mkCtx({ name: "price", path: "comps.c1.v.price", issues: [issue({ path: "comps.c1.v.price", message: "Preço inválido." })] });
    render(<Controlled def={{ type: "text" }} ctx={ctx} />);
    expect(screen.getByText("Preço inválido.")).toBeInTheDocument();
  });
});

describe("md · barra Negrito · Itálico · Lista", () => {
  it("actua na seleção da caixa", () => {
    render(<Controlled def={{ type: "md" }} initial="olá mundo" ctx={mkCtx({ name: "body", path: "comps.c1.v.body" })} />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.focus(ta);
    ta.setSelectionRange(0, 3);
    fireEvent.click(screen.getByRole("button", { name: "Negrito" }));
    expect(ta.value).toBe("**olá** mundo");
  });

  it("com i18n actua na caixa que tem o foco, não nas outras", () => {
    render(<Controlled def={{ type: "md", i18n: true }} initial={{ pt: "um", en: "two" }} ctx={mkCtx({ name: "body", path: "comps.c1.v.body" })} />);
    const en = screen.getByLabelText("Texto (EN)") as HTMLTextAreaElement;
    fireEvent.focus(en);
    en.setSelectionRange(0, 3);
    fireEvent.click(screen.getByRole("button", { name: "Itálico" }));
    expect(en.value).toBe("*two*");
    expect((screen.getByLabelText("Texto (PT)") as HTMLTextAreaElement).value).toBe("um");
  });

  it("applyMd: negrito liga e desliga, lista prefixa cada linha", () => {
    expect(applyMd("abc", 0, 3, "bold")).toEqual({ text: "**abc**", start: 2, end: 5 });
    expect(applyMd("**abc**", 2, 5, "bold").text).toBe("abc");
    expect(applyMd("", 0, 0, "italic")).toEqual({ text: "**", start: 1, end: 1 });
    expect(applyMd("a\nb", 0, 3, "list").text).toBe("- a\n- b");
    expect(applyMd("- a\n- b", 0, 7, "list").text).toBe("a\nb");
  });
});

describe("choice", () => {
  it("≤ 5 opções: botões segmentados; o valor por omissão vem premido", async () => {
    const spy = vi.fn();
    const def: FieldSpec = { type: "choice", options: ["left", "center", "right"], default: "left" };
    render(<Controlled def={def} ctx={mkCtx({ name: "align", path: "comps.c1.v.align" })} spy={spy} />);
    expect(screen.getByRole("button", { name: "Esquerda" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Centro" }));
    expect(spy).toHaveBeenCalledWith("center", undefined);
    expect(screen.getByRole("button", { name: "Centro" })).toHaveAttribute("aria-pressed", "true");
  });

  it("mais de 5 (ou do manifest): Select", async () => {
    const spy = vi.fn();
    const ctx = mkCtx({ name: "icon", path: "comps.c1.v.icon", icons: ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, label: `Ícone ${id}` })) });
    render(<Controlled def={{ type: "choice", optionsFrom: "icons" }} ctx={ctx} spy={spy} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Ícone" }), "c");
    expect(spy).toHaveBeenCalledWith("c", undefined);
  });

  it("mostra o issue do campo", () => {
    const ctx = mkCtx({ name: "level", path: "comps.c1.v.level", issues: [issue({ path: "comps.c1.v.level", message: "Nível inválido." })] });
    render(<Controlled def={{ type: "choice", options: ["h1", "h2"] }} ctx={ctx} />);
    expect(screen.getByText("Nível inválido.")).toBeInTheDocument();
  });
});

describe("media · upload diferido", () => {
  const imgCtx = (over: Partial<FieldCtx> = {}) => mkCtx({ name: "image", path: "comps.c1.v.image", ...over });
  const png = () => new File(["x"], "foto.png", { type: "image/png" });

  it("por omissão 'a mesma em todas as línguas': uma linha, sem selos", () => {
    render(<Controlled def={{ type: "media", kind: "image" }} ctx={imgCtx()} />);
    expect(screen.getByText("Igual em todas as línguas")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma imagem")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "A mesma imagem em todas as línguas" })).toBeChecked();
  });

  it("escolher NÃO envia: guarda um marcador blob:, o File fica no registo e a linha diz 'Por carregar'", () => {
    const spy = vi.fn();
    render(<Controlled def={{ type: "media", kind: "image" }} ctx={imgCtx()} spy={spy} />);
    const file = png();
    fireEvent.change(screen.getByLabelText("Ficheiro de Imagem"), { target: { files: [file] } });
    const value = spy.mock.calls[0][0] as { same: boolean; values: Record<string, string> };
    expect(value.same).toBe(true);
    expect(value.values.pt).toMatch(/^blob:/);
    expect(pendingEntry(value.values.pt)).toMatchObject({ file, kind: "image" });
    expect(screen.getByText("Por carregar")).toBeInTheDocument();
    expect(screen.getByText("foto.png")).toBeInTheDocument();
    expect(upload.image).not.toHaveBeenCalled();
  });

  it("recusa o tipo errado (PDF numa imagem) e ficheiros grandes, sem tocar no valor", () => {
    const spy = vi.fn();
    render(<Controlled def={{ type: "media", kind: "image" }} ctx={imgCtx()} spy={spy} />);
    fireEvent.change(screen.getByLabelText("Ficheiro de Imagem"), { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Ficheiro não aceite");
    expect(spy).not.toHaveBeenCalled();
  });

  it("kind 'file' aceita PDF e regista-o como file", () => {
    const spy = vi.fn();
    render(<Controlled def={{ type: "media", kind: "file" }} ctx={imgCtx({ name: "file", path: "comps.c1.v.file" })} spy={spy} />);
    fireEvent.change(screen.getByLabelText("Ficheiro de Ficheiro"), { target: { files: [new File(["%PDF-"], "cat.pdf", { type: "application/pdf" })] } });
    const url = (spy.mock.calls[0][0] as { values: Record<string, string> }).values.pt;
    expect(pendingEntry(url)?.kind).toBe("file");
  });

  it("uma por língua: linhas por língua, falta amarela e contador 'por traduzir'", async () => {
    const spy = vi.fn();
    render(<Controlled def={{ type: "media", kind: "image" }} initial={{ same: true, values: { pt: "https://cdn/a.webp" } }} ctx={imgCtx()} spy={spy} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "A mesma imagem em todas as línguas" }));
    expect(spy).toHaveBeenLastCalledWith({ same: false, values: { pt: "https://cdn/a.webp" } }, undefined);
    expect(screen.getByText("2 por traduzir")).toBeInTheDocument();
    expect(screen.getAllByText("Por traduzir")).toHaveLength(2);
    // voltar a "a mesma" deixa só a base
    await userEvent.click(screen.getByRole("checkbox", { name: "A mesma imagem em todas as línguas" }));
    expect(spy).toHaveBeenLastCalledWith({ same: true, values: { pt: "https://cdn/a.webp" } }, undefined);
  });

  it("remover tira o valor; issue por língua aparece na linha certa", async () => {
    const spy = vi.fn();
    const ctx = imgCtx({ issues: [issue({ path: "comps.c1.v.image", locale: "en", message: "Imagem de outro tenant." })] });
    render(<Controlled def={{ type: "media", kind: "image" }} initial={{ same: false, values: { pt: "https://cdn/a.webp", en: "https://cdn/b.webp", fr: "https://cdn/c.webp" } }} ctx={ctx} spy={spy} />);
    expect(screen.getByText("Imagem de outro tenant.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remover imagem (FR)" }));
    expect(spy).toHaveBeenLastCalledWith({ same: false, values: { pt: "https://cdn/a.webp", en: "https://cdn/b.webp" } }, undefined);
  });
});

describe("dest · Leva para", () => {
  const ctx = (over: Partial<FieldCtx> = {}) => mkCtx({ name: "dest", path: "comps.c1.v.dest", ...over });
  const def: FieldSpec = { type: "dest" };

  it("oferece Páginas · Secções · Documentos · Outro endereço (rascunhos assinalados)", () => {
    render(<Controlled def={def} ctx={ctx()} />);
    const sel = screen.getByRole("combobox", { name: "Leva para" });
    const labels = within(sel).getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual([
      "Escolher…",
      "Página · Início",
      "Página · Obras",
      "Página · Equipa (rascunho)",
      "Página · Contactos",
      "Secção · Contactos (Início)",
      "Documento · Catálogo",
      "Outro endereço…",
    ]);
  });

  it("escolhe página, secção e documento com a forma do contrato", async () => {
    const spy = vi.fn();
    render(<Controlled def={def} ctx={ctx()} spy={spy} />);
    const sel = screen.getByRole("combobox", { name: "Leva para" });
    await userEvent.selectOptions(sel, "p:p2");
    expect(spy).toHaveBeenLastCalledWith({ kind: "page", pageId: "p2" }, undefined);
    await userEvent.selectOptions(sel, "a:b9");
    expect(spy).toHaveBeenLastCalledWith({ kind: "anchor", blockId: "b9" }, undefined);
    await userEvent.selectOptions(sel, "d:d1");
    expect(spy).toHaveBeenLastCalledWith({ kind: "file", media: { same: true, values: { pt: "https://cdn/catalogo.pdf" } } }, undefined);
  });

  it("'Outro endereço…' valida https/http/mailto/tel", async () => {
    render(<Controlled def={def} ctx={ctx()} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Leva para" }), "url");
    const box = screen.getByRole("textbox", { name: "Leva para: endereço" });
    await userEvent.type(box, "javascript:alert(1)");
    expect(screen.getByRole("alert")).toHaveTextContent("https://");
    await userEvent.clear(box);
    await userEvent.type(box, "mailto:ola@x.pt");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(["https://a.pt", "http://a.pt", "mailto:a@b.pt", "tel:+351912345678", "/obras", "#contactos"].every(isValidHref)).toBe(true);
    expect(["javascript:alert(1)", "ftp://x", "www.x.pt", "", " https://x"].some(isValidHref)).toBe(false);
  });

  it("valor guardado aparece escolhido; issue no path do campo", () => {
    const c = ctx({ issues: [issue({ path: "comps.c1.v.dest", message: "A página não existe." })] });
    render(<Controlled def={def} initial={{ kind: "page", pageId: "p2" }} ctx={c} />);
    expect(screen.getByRole("combobox", { name: "Leva para" })).toHaveValue("p:p2");
    expect(screen.getByText("A página não existe.")).toBeInTheDocument();
  });
});

describe("pages", () => {
  const ctx = mkCtx({ name: "pick", path: "comps.c1.v.pick" });
  const def: FieldSpec = { type: "pages", min: 1, max: 2 };

  it("caixas de seleção, contador 'N de máx', rascunhos assinalados, home fora", () => {
    render(<Controlled def={def} initial={["p2"]} ctx={ctx} />);
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Início/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Rascunho · só aparece quando for publicada/)).toBeInTheDocument();
  });

  it("no máximo as restantes ficam desligadas; desmarcar liberta", async () => {
    const spy = vi.fn();
    render(<Controlled def={def} initial={["p2"]} ctx={ctx} spy={spy} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Equipa/ }));
    expect(spy).toHaveBeenLastCalledWith(["p2", "p3"], undefined);
    expect(screen.getByRole("checkbox", { name: /Contactos/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /Obras/ }));
    expect(spy).toHaveBeenLastCalledWith(["p3"], undefined);
    expect(screen.getByRole("checkbox", { name: /Contactos/ })).toBeEnabled();
  });

  it("mostra o issue do campo", () => {
    render(<Controlled def={def} ctx={{ ...ctx, issues: [issue({ path: "comps.c1.v.pick", message: "Máximo 2 páginas." })] }} />);
    expect(screen.getByText("Máximo 2 páginas.")).toBeInTheDocument();
  });
});

describe("list", () => {
  const def: FieldSpec = { type: "list", min: 1, max: 2, of: { text: { type: "text", i18n: true } } };
  const ctx = (over: Partial<FieldCtx> = {}) => mkCtx({ name: "items", path: "comps.c1.v.items", ...over });
  const rows = [{ _id: "k1", text: { pt: "Primeiro", en: "First", fr: "Premier" } }];

  it("conta, e respeita min (remover desligado) e max (adicionar desligado)", async () => {
    const spy = vi.fn();
    render(<Controlled def={def} initial={rows} ctx={ctx()} spy={spy} />);
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover Primeiro" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Adicionar item" }));
    const next = spy.mock.calls[0][0] as { _id: string }[];
    expect(next).toHaveLength(2);
    expect(next[1]._id).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(screen.getByRole("button", { name: "Adicionar item" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remover Primeiro" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Remover Primeiro" }));
    expect(spy).toHaveBeenLastCalledWith([expect.objectContaining({ _id: next[1]._id })], undefined);
  });

  it("o item abre e fecha; escrever sobe a lista com o path com o _id como chave", async () => {
    const spy = vi.fn();
    render(<Controlled def={def} initial={rows} ctx={ctx()} spy={spy} />);
    expect(screen.queryByLabelText("Texto (EN)")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Primeiro" }));
    await userEvent.type(screen.getByLabelText("Texto (EN)"), "!");
    expect(spy).toHaveBeenLastCalledWith([{ _id: "k1", text: { pt: "Primeiro", en: "First!", fr: "Premier" } }], "comps.c1.v.items.k1.text");
    await userEvent.click(screen.getByRole("button", { name: "Primeiro" }));
    expect(screen.queryByLabelText("Texto (EN)")).not.toBeInTheDocument();
  });

  it("falta tradução num item mostra o selo na linha", () => {
    render(<Controlled def={def} initial={[{ _id: "k1", text: { pt: "Só PT" } }]} ctx={ctx()} />);
    expect(screen.getByText("Por traduzir")).toBeInTheDocument();
  });

  it("issue dentro de um item: abre o item, mostra a mensagem no campo e o selo 'Problema'", () => {
    const c = ctx({ issues: [issue({ path: "comps.c1.v.items.k1.text", locale: "fr", message: "Falta o francês." })] });
    render(<Controlled def={def} initial={rows} ctx={c} />);
    expect(screen.getByText("Falta o francês.")).toBeInTheDocument();
    expect(screen.getByText("Problema")).toBeInTheDocument();
    expect(screen.getByLabelText("Texto (FR)")).toBeInTheDocument();
  });

  it("issue da própria lista (min/max) aparece debaixo dela", () => {
    render(<Controlled def={def} initial={rows} ctx={ctx({ issues: [issue({ path: "comps.c1.v.items", message: "Máximo 2 itens." })] })} />);
    expect(screen.getByText("Máximo 2 itens.")).toBeInTheDocument();
  });
});

describe("FieldsForm / FieldRenderer", () => {
  it("campos seo ficam numa caixa 'Google (SEO)' no fim", () => {
    const fields = { alt: { type: "text", i18n: true, seo: true }, caption: { type: "text", i18n: true }, level: { type: "choice", options: ["h1", "h2"], seo: true } } as const;
    const { container } = render(<FieldsForm fields={fields as never} values={{}} onField={() => {}} ctx={mkCtx({ name: "", path: "comps.c1.v" })} />);
    const box = screen.getByRole("region", { name: "Google (SEO)" });
    expect(container.firstElementChild?.lastElementChild).toBe(box);
    expect(within(box).getByLabelText("Descrição da imagem (PT)")).toBeInTheDocument();
    expect(within(box).getByRole("group", { name: "Nível (para o Google)" })).toBeInTheDocument();
    expect(within(box).queryByLabelText("Legenda (PT)")).not.toBeInTheDocument();
  });

  it("despacha só pelo tipo de valor: um tipo desconhecido não rebenta", () => {
    render(<FieldRenderer def={{ type: "mistério" }} value={undefined} onChange={() => {}} ctx={mkCtx()} />);
    expect(screen.getByText(/ainda não conhece/)).toBeInTheDocument();
  });

  it("onField leva o nome do campo e a chave", async () => {
    const onField = vi.fn();
    render(<FieldsForm fields={{ price: { type: "text" } }} values={{ price: "" }} onField={onField} ctx={mkCtx({ name: "", path: "comps.c1.v" })} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Preço" }), "5");
    expect(onField).toHaveBeenCalledWith("price", "5", "comps.c1.v.price");
  });
});

describe("ligação ao reducer", () => {
  it("buildFieldCtx: línguas do tenant com a base primeiro, páginas com estado, âncoras e documentos", () => {
    const work = sampleWork();
    work.blocks = [
      block("b1", { anchor: "contactos", name: "Contactos" }),
      block("b2", { comps: [{ id: "c9", type: "documentos", style: "normal", col: "all", v: { items: [{ _id: "r1", name: { pt: "Catálogo" }, file: { same: true, values: { pt: "https://cdn/c.pdf" } } }] } }] }),
    ];
    const catalog = { components: [{ type: "documentos", label: "Documentos", fields: { items: { type: "list", of: { name: { type: "text", i18n: true }, file: { type: "media", kind: "file" } } } } }] };
    const c = buildFieldCtx({ work, lang: { languages: ["en", "pt"], defaultLanguage: "pt" }, catalog: catalog as never, manifest: { icons: [{ id: "x", label: "X" }] }, issues: [] });
    expect(c.languages).toEqual(["pt", "en"]);
    expect(c.pages.find((p) => p.id === "p-obras")).toMatchObject({ status: "draft", path: "/p-obras" });
    expect(c.anchors).toEqual([expect.objectContaining({ blockId: "b1", anchor: "contactos" })]);
    expect(c.documents).toEqual([{ id: "b:b2/c9/r1", name: "Catálogo", media: { same: true, values: { pt: "https://cdn/c.pdf" } } }]);
    expect(c.icons).toEqual([{ id: "x", label: "X" }]);
  });

  it("setFieldValue escreve no componente certo do bloco e devolve o mesmo trabalho se o alvo não existe", () => {
    const work = sampleWork();
    work.blocks[0].comps = [{ id: "c1", type: "titulo", style: "normal", col: "all", v: { text: { pt: "A" } } }];
    const target = { entity: "block", id: "b1", compId: "c1" } as const;
    const next = setFieldValue(work, target, "level", "h3");
    expect(next.blocks[0].comps[0]).toMatchObject({ v: { text: { pt: "A" }, level: "h3" } });
    expect(work.blocks[0].comps[0]).toMatchObject({ v: { text: { pt: "A" } } });
    expect(setFieldValue(work, { ...target, compId: "nope" }, "level", "h3")).toBe(work);
    expect(setFieldValue(work, { entity: "block", id: "x", compId: "c1" }, "level", "h3")).toBe(work);
  });

  it("chave de junção por campo: escrever seguido no mesmo campo é UMA entrada do desfazer; outro campo, outra", () => {
    const work = sampleWork();
    work.blocks[0].comps = [{ id: "c1", type: "titulo", style: "normal", col: "all", v: {} }];
    const t = { entity: "block", id: "b1", compId: "c1" } as const;
    const type = (s: ReturnType<typeof initState>, name: string, text: string, now: number) =>
      reduce(s, { type: "edit", update: (w) => setFieldValue(w, t, name, text), key: editKey(t, `comps.c1.v.${name}`), now });

    let s = initState(work, 1);
    s = type(s, "a", "o", 1000);
    s = type(s, "a", "ol", 1100);
    s = type(s, "a", "olá", 1200);
    expect(s.history.stack).toHaveLength(2); // original + UMA entrada
    s = type(s, "b", "x", 1300); // outro campo, logo a seguir: entrada nova
    expect(s.history.stack).toHaveLength(3);
    s = reduce(s, { type: "undo" });
    expect(s.work.blocks[0].comps[0]).toMatchObject({ v: { a: "olá" } });
    s = reduce(s, { type: "undo" });
    expect((s.work.blocks[0].comps[0] as { v: object }).v).toEqual({});
    // gesto discreto (sem key) nunca se junta
    expect(editKey(t)).toBeUndefined();
  });
});
