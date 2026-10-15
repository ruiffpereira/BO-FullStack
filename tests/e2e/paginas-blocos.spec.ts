import { test, expect, type Locator } from "@playwright/test";
import { dragWithKeyboard, dragWithMouse } from "./fixtures/drag";
import { PaginasPage, VIEWPORTS, uniq } from "./pages/PaginasPage";

/**
 * Construtor de páginas — blocos e componentes (F12/F14) nas três larguras, com o manifest da
 * Winterplateau (`pages@e2e`): ponto de partida · usar · copiar · componente novo e copiado · estilo,
 * coluna, fundo e disposição · arrastar componentes, blocos (na página e na biblioteca) · especiais ·
 * Topo/Rodapé · apagar bloco em uso (recusado). Só o primeiro teste grava (os outros trabalham na cópia
 * de trabalho e desaparecem ao fechar), para a biblioteca partilhada não crescer à toa.
 */

test.use({ storageState: { cookies: [], origins: [] } });

/** Escreve (PT e EN) no campo de texto aberto. */
async function fillBoth(p: PaginasPage, label: string, text: string): Promise<void> {
  await p.page.getByRole("textbox", { name: `${label} (PT)` }).fill(text);
  await p.page.getByRole("textbox", { name: `${label} (EN)` }).fill(text);
}

/** A linha ordenável (`data-sortable-row`) de um componente do editor. */
const compRow = (p: PaginasPage, index: number): Locator => p.compHead(index).locator("xpath=ancestor::*[@data-sortable-row][1]");

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · blocos — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("bloco novo por ponto de partida; componentes novo e copiado; estilo, coluna, fundo e disposição; arrastar; desfazer; gravar e recarregar", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const [pg, bl] = [`Blocos-${u}`, `Bl-${u}`];

      await p.createPage(pg, `blocos-${u}`);
      await expect(page.getByText("Esta página ainda não tem blocos.")).toBeVisible();
      await p.addStarter("Título e texto");
      await expect.poll(() => p.itemNames()).toEqual(["Título e texto"]);
      await p.openItem("Título e texto");
      await p.renameBlock(bl);
      await expect.poll(() => p.compNames()).toEqual(["Título", "Texto"]);

      // Estilo e nível do título (os estilos vêm do manifest da Winterplateau).
      await p.compHead(0).click();
      await fillBoth(p, "Texto", `Titulo-${u}`);
      await expect(p.choice("Estilo", /Destaque/)).toHaveAttribute("aria-pressed", "true");
      await p.choice("Estilo", /Frase grande/).click();
      await expect(p.choice("Estilo", /Frase grande/)).toHaveAttribute("aria-pressed", "true");
      await expect(p.compHead(0)).toContainText("Frase grande");
      await p.choice("Nível (para o Google)", "H1").click();
      await expect(p.compHead(0)).toContainText("H1");

      // Corpo do texto.
      await p.compHead(1).click();
      await fillBoth(p, "Texto", `Corpo-${u}`);

      // Fundo (3 do manifest) e disposição; a coluna só se escolhe com mais de uma.
      await expect(p.choice("Fundo", "Claro")).toHaveAttribute("aria-pressed", "true");
      await expect(p.group2("Fundo").getByRole("button")).toHaveText(["Claro", "Escuro", "Azul da marca"]);
      await p.choice("Fundo", "Escuro").click();
      await expect(p.choice("Fundo", "Escuro")).toHaveAttribute("aria-pressed", "true");
      await expect(p.group2("Onde fica")).toHaveCount(0);
      await p.choice("Disposição", "2 colunas").click();
      await expect(p.choice("Disposição", "2 colunas")).toHaveAttribute("aria-pressed", "true");
      await expect(p.group2("Onde fica").getByRole("button")).toHaveText(["Toda a largura", "Coluna 1", "Coluna 2"]);
      await p.choice("Onde fica", "Coluna 2").click();
      await expect(p.choice("Onde fica", "Coluna 2")).toHaveAttribute("aria-pressed", "true");
      await expect(p.compHead(1)).toContainText("Coluna 2");

      // Componente novo (Etiqueta) — nasce aberto, com o 1.º estilo do manifest se houver.
      await p.addComponent("Etiqueta");
      await expect.poll(() => p.compNames()).toEqual(["Título", "Texto", "Etiqueta"]);
      await fillBoth(p, "Texto", `Etiq-${u}`);

      // Componente copiado: a paleta procura por texto em todos os blocos; fica independente do original.
      await page.getByRole("main").getByRole("button", { name: "Adicionar componente" }).click();
      await p.dialog.getByRole("tab", { name: "Copiar um que já existe" }).click();
      await p.dialog.getByRole("textbox", { name: "Procurar componente" }).fill(`Titulo-${u}`);
      await p.pick(new RegExp(`Título.*Titulo-${u}`));
      await expect.poll(() => p.compNames()).toEqual(["Título", "Texto", "Etiqueta", "Título"]);
      await expect(p.compHead(3)).toContainText(`Titulo-${u}`);
      await fillBoth(p, "Texto", `Copia-${u}`);
      await expect(p.compHead(3)).toContainText(`Copia-${u}`);
      await expect(p.compHead(0)).toContainText(`Titulo-${u}`); // o original não mudou

      // Arrastar componentes: a etiqueta sobe para o princípio (com o rato).
      await p.compHead(3).click(); // fecha a aberta
      await dragWithMouse(page, compRow(p, 2).getByRole("button", { name: "Mover" }), compRow(p, 0), "before");
      await expect.poll(() => p.compNames()).toEqual(["Etiqueta", "Título", "Texto", "Título"]);
      // …e desfazer/refazer repõem a ordem.
      await p.undo();
      await expect.poll(() => p.compNames()).toEqual(["Título", "Texto", "Etiqueta", "Título"]);
      await p.redo();
      await expect.poll(() => p.compNames()).toEqual(["Etiqueta", "Título", "Texto", "Título"]);

      // Gravar, recarregar e confirmar que tudo persistiu.
      await p.backToPage();
      await p.save();
      await p.reload();
      await p.openPage(pg);
      await p.openItem(bl);
      await expect.poll(() => p.compNames()).toEqual(["Etiqueta", "Título", "Texto", "Título"]);
      await expect(p.choice("Fundo", "Escuro")).toHaveAttribute("aria-pressed", "true");
      await expect(p.choice("Disposição", "2 colunas")).toHaveAttribute("aria-pressed", "true");
      await expect(p.compHead(1)).toContainText("Frase grande");
      await expect(p.compHead(1)).toContainText("H1");
      await expect(p.compHead(2)).toContainText("Coluna 2");
    });

    test("usar partilha o mesmo bloco, copiar cria um independente e «cópia só nesta página» separa", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const [pgA, pgB, pgC, bl] = [`PgA-${u}`, `PgB-${u}`, `PgC-${u}`, `Bl-${u}`];

      await p.createPage(pgA, `pga-${u}`);
      await p.addStarter("Título e texto");
      await p.openItem("Título e texto");
      await p.renameBlock(bl);
      await p.backToPage();

      // Usar: o MESMO bloco em duas páginas.
      await p.createPage(pgB, `pgb-${u}`);
      await p.openBlockPalette();
      await p.paletteTab("Usar um que já existe");
      await p.pick(new RegExp(`^${bl}`));
      await expect.poll(() => p.itemNames()).toEqual([bl]);
      await expect(p.itemCard(bl)).toContainText("Partilhado em 2");
      await p.openItem(bl);
      await expect(page.getByRole("note").filter({ hasText: "Este bloco está em 2 páginas" })).toContainText(`${pgA}, ${pgB}`);
      await p.backToPage();
      await p.showList();
      await expect(p.blockRow(bl)).toContainText("em 2");

      // Copiar: um bloco novo, independente (nome com «(cópia)», sem partilha).
      await p.createPage(pgC, `pgc-${u}`);
      await p.openBlockPalette();
      await p.paletteTab("Copiar um que já existe");
      await p.pick(new RegExp(`^${bl}`));
      await expect.poll(() => p.itemNames()).toEqual([`${bl} (cópia)`]);
      await expect(p.itemCard(`${bl} (cópia)`)).not.toContainText("Partilhado");
      await p.showList();
      await expect(p.blockRow(bl)).toContainText("em 2");
      await expect(p.blockRow(`${bl} (cópia)`)).toContainText("em 1");

      // «Usar uma cópia só nesta página»: a pgB deixa de partilhar com a pgA.
      await p.openPage(pgB);
      await page.getByRole("button", { name: `Mais opções de ${bl}` }).click();
      await page.getByRole("menuitem", { name: "Usar uma cópia só nesta página" }).click();
      await expect.poll(() => p.itemNames()).toEqual([`${bl} (cópia)`]);
      await expect(p.itemCard(`${bl} (cópia)`)).not.toContainText("Partilhado");
      await p.showList();
      await expect(p.blockRow(bl)).toContainText("em 1");
    });

    test("arrasta blocos na página (rato e teclado) e na biblioteca para uma pasta e de volta", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const [pg, a, b, c, pasta] = [`Arr-${u}`, `A-${u}`, `B-${u}`, `C-${u}`, `Pasta-${u}`];

      await p.createPage(pg, `arr-${u}`);
      for (const name of [a, b, c]) {
        await p.addStarter("Em branco");
        await p.openItem("Bloco novo");
        await p.renameBlock(name);
        await p.backToPage();
      }
      await expect.poll(() => p.itemNames()).toEqual([a, b, c]);

      // Rato: C passa para antes de A.
      const handleOf = (name: string) => p.itemCard(name).getByRole("button", { name: "Mover" });
      await dragWithMouse(page, handleOf(c), p.itemCard(a), "before");
      await expect.poll(() => p.itemNames()).toEqual([c, a, b]);
      // Teclado: B sobe um lugar (Espaço, ↑, Espaço).
      await dragWithKeyboard(page, handleOf(b), ["ArrowUp"]);
      await expect.poll(() => p.itemNames()).toEqual([c, b, a]);
      await p.undo();
      await expect.poll(() => p.itemNames()).toEqual([c, a, b]);

      // Biblioteca: uma pasta nova, o bloco A para dentro (a pasta deixa de se poder apagar) e de volta.
      await p.showList();
      await p.setGroupOpen("Páginas", false);
      await p.setGroupOpen("Partes comuns", false);
      await p.group("Blocos").getByRole("button", { name: "Nova pasta" }).click();
      await page.getByRole("textbox", { name: "Nome da pasta" }).fill(pasta);
      await page.keyboard.press("Enter");
      await expect(p.blockRow(pasta)).toBeVisible();
      const apagarPasta = p.blockRow(pasta).getByRole("button", { name: "Apagar pasta" });
      await expect(apagarPasta).toBeEnabled();

      await dragWithMouse(page, p.blockRow(a).getByRole("button", { name: "Mover" }), p.blockRow(pasta), "inside");
      await expect(apagarPasta).toBeDisabled();
      await expect(p.blockRow(pasta)).toContainText("1");

      const semPasta = p.group("Blocos").locator("[data-sortable-row]").filter({ hasText: "Sem pasta" }).first();
      await dragWithMouse(page, p.blockRow(a).getByRole("button", { name: "Mover" }), semPasta, "inside");
      await expect(apagarPasta).toBeEnabled();
      await apagarPasta.click();
      await expect(p.blockRow(pasta)).toHaveCount(0);
    });

    test("apagar bloco: recusado enquanto está numa página; depois de o retirar, apaga com confirmação", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const [pg, bl] = [`Del-${u}`, `Del-bl-${u}`];

      await p.createPage(pg, `del-${u}`);
      await p.addStarter("Em branco");
      await p.openItem("Bloco novo");
      await p.renameBlock(bl);
      await p.backToPage();

      // Em uso: o botão está bloqueado e a razão está à vista.
      await p.openBlockFromLibrary(bl);
      const apagar = page.getByRole("button", { name: "Apagar bloco" });
      await expect(apagar).toBeDisabled();
      await expect(apagar).toHaveAttribute("title", "Está em 1 página");
      await expect(page.getByText("Enquanto estiver numa página, este bloco não pode ser apagado.")).toBeVisible();
      // «Onde é usado» leva à página que o usa.
      await page.getByRole("button", { name: `Ir para ${pg}` }).click();
      await expect(p.pageHeading).toHaveText(pg);

      // Retirar da página (com confirmação) deixa-o sem uso…
      await page.getByRole("button", { name: `Mais opções de ${bl}` }).click();
      await page.getByRole("menuitem", { name: "Retirar desta página" }).click();
      await p.dialog.getByRole("button", { name: "Retirar", exact: true }).click();
      await expect(p.dialog).toHaveCount(0);
      await expect.poll(() => p.itemNames()).toEqual([]);
      await p.showList();
      await expect(p.blockRow(bl)).toContainText("Sem uso");

      // …e agora apaga-se (pede confirmação).
      await p.openBlockFromLibrary(bl);
      await expect(apagar).toBeEnabled();
      await apagar.click();
      await expect(page.getByText(`Apagar o bloco «${bl}» de vez?`)).toBeVisible();
      await page.getByRole("button", { name: "Apagar", exact: true }).click();
      await p.showList();
      await expect(p.blockRow(bl)).toHaveCount(0);
    });

    test("especiais do manifest: adicionar, esconder nesta página e duplicar", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      await p.createPage(`Esp-${u}`, `esp-${u}`);

      await p.openBlockPalette();
      await p.paletteTab("Especiais deste site");
      await expect(p.dialog.getByRole("button", { name: /^Edifício 3D/ })).toBeVisible();
      await expect(p.dialog.getByRole("button", { name: /^Faixa a passar/ })).toBeVisible();
      await p.pick(/^Edifício 3D/);
      await expect.poll(() => p.itemNames()).toEqual(["Edifício 3D"]);
      await expect(p.itemCard("Edifício 3D")).toContainText("Especial");

      // Editor do especial: só os campos do manifest (a «Etiqueta» do edifício), sem componentes nem disposição.
      await p.openItem("Edifício 3D");
      await expect(page.getByRole("textbox", { name: "Etiqueta (PT)" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Adicionar componente" })).toHaveCount(0);
      await page.getByRole("button", { name: "Esconder aqui" }).click();
      await page.getByRole("button", { name: "Duplicar", exact: true }).click();
      await expect.poll(() => p.itemNames()).toEqual(["Edifício 3D", "Edifício 3D"]);
      // O duplicado herda o «escondido» do original (como nos blocos).
      await expect(page.getByRole("main").getByText("Escondido aqui")).toHaveCount(2);
    });

    test("Topo e Rodapé: o manifest limita os componentes que se podem juntar", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const cards = async (part: "Topo" | "Rodapé"): Promise<string[]> => {
        await p.openPart(part);
        await page.getByRole("main").getByRole("button", { name: "Adicionar secção" }).click();
        await expect(p.dialog.getByRole("tab", { name: "Componente novo" })).toBeVisible();
        const names = await p.dialog.locator("b").allTextContents();
        await page.keyboard.press("Escape");
        await expect(p.dialog).toHaveCount(0);
        return names.map((n) => n.trim());
      };
      // Winterplateau: topo = imagem, menu, botão, línguas; rodapé = texto, menu, contacto, redes, imagem (sem logótipos).
      expect((await cards("Topo")).sort()).toEqual(["Botão", "Imagem", "Menu", "Selector de línguas"].sort());
      expect((await cards("Rodapé")).sort()).toEqual(["Contactos", "Imagem", "Menu", "Redes sociais", "Texto"].sort());
    });
  });
}
