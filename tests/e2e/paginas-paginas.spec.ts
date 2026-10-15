import { test, expect } from "@playwright/test";
import { dragWithKeyboard, dragWithMouse } from "./fixtures/drag";
import { PaginasPage, VIEWPORTS, uniq } from "./pages/PaginasPage";

/**
 * Construtor de páginas — a lista de Páginas (F11/F15) nas três larguras: criar página e subpágina,
 * arrastar a subpágina para outra mãe (rato e teclado), gravar e recarregar, desfazer/refazer e apagar
 * (recusado enquanto há subpágina ou ligação; livre apaga).
 *
 * Tenant `pages@e2e` (pt+en, partilhado entre testes): cada teste cria páginas com nome único e só
 * mexe nelas. A BD é semeada de novo a cada corrida; o 1.º teste cria a home (`PaginasPage.open`).
 */

test.use({ storageState: { cookies: [], origins: [] } });

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · lista — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("cria página e subpágina, arrasta a subpágina para outra mãe (rato), grava e recarrega", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const [mae, outra, filha] = [`Mae-${u}`, `Outra-${u}`, `Filha-${u}`];

      await p.createPage(mae, `mae-${u}`);
      await p.createPage(outra, `outra-${u}`);
      await p.createSubpage(mae, filha, `filha-${u}`);
      await p.showList();
      await expect(p.pageRow(filha)).toContainText(`/mae-${u}/filha-${u}`);
      await expect(p.status).toHaveText("Alterações por guardar");
      // Grava já: o arrasto seguinte é sobre páginas que o servidor conhece (só aí há endereço antigo a redireccionar).
      await p.save();

      // Só interessam as páginas: fechar os outros grupos evita rolar a lista a meio do arrasto.
      await p.setGroupOpen("Blocos", false);
      await p.setGroupOpen("Partes comuns", false);
      await dragWithMouse(page, p.pageRow(filha).getByRole("button", { name: "Mover" }), p.pageRow(outra), "inside");
      await expect(p.pageRow(filha)).toContainText(`/outra-${u}/filha-${u}`);
      await expect(p.pageRow(filha)).not.toContainText(`/mae-${u}/`);
      await expect(p.status).toHaveText("Alterações por guardar");

      // As Definições avisam que o endereço antigo continua a funcionar.
      await p.openPage(filha);
      await p.openTab("Definições e SEO");
      await expect(page.getByText("O endereço antigo vai continuar a funcionar")).toBeVisible();
      await expect(page.getByText(`/mae-${u}/filha-${u} → /outra-${u}/filha-${u}`)).toBeVisible();

      await p.save();
      await p.reload();
      await p.setGroupOpen("Blocos", false);
      await expect(p.pageRow(filha)).toContainText(`/outra-${u}/filha-${u}`);
      await expect(p.pageRow(mae)).toContainText(`/mae-${u}`);

      // O endereço antigo da subpágina passa a redireccionar (CONTRATO §6.5): aparece nas Definições, só de leitura.
      await p.openPage(filha);
      await p.openTab("Definições e SEO");
      await expect(page.getByText("Endereços antigos")).toBeVisible();
      await expect(page.locator("code").getByText(`/mae-${u}/filha-${u}`, { exact: true })).toBeVisible();
      await expect(page.locator("code").getByText(`/en/mae-${u}/filha-${u}`, { exact: true })).toBeVisible();
    });

    test("arrasta com o teclado (Espaço + setas): põe dentro, cancela com Esc e desfaz", async ({ page, context }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const [aa, bb] = [`Aa-${u}`, `Bb-${u}`];
      await p.createPage(aa, `aa-${u}`);
      await p.createPage(bb, `bb-${u}`);
      await p.showList();
      await p.setGroupOpen("Blocos", false);
      await p.setGroupOpen("Partes comuns", false);
      const handle = () => p.pageRow(bb).getByRole("button", { name: "Mover" });

      // Esc cancela: nada muda.
      const cancelled = await dragWithKeyboard(page, handle(), ["ArrowUp"], { drop: false });
      expect(cancelled).toContain("Movimento cancelado");
      await expect(p.pageRow(bb)).toContainText(`/bb-${u}`);

      // ↑ escolhe a página de cima, → põe lá dentro, Espaço larga.
      const dropped = await dragWithKeyboard(page, handle(), ["ArrowUp", "ArrowRight"]);
      expect(dropped).toContain(`${bb} foi largado dentro de ${aa}`);
      await expect(p.pageRow(bb)).toContainText(`/aa-${u}/bb-${u}`);

      // Depois do arrasto com o teclado a lista continua inteira (nada de ecrã em branco).
      await expect(p.list).toBeVisible();
      await expect(p.group("Páginas")).toBeVisible();
      await expect(p.saveBtn).toBeEnabled();

      // Desfazer / refazer repõem e voltam a pôr.
      await p.undo();
      await expect(p.pageRow(bb)).toContainText(`/bb-${u}`);
      await expect(p.pageRow(bb)).not.toContainText(`/aa-${u}/`);
      await p.redo();
      await expect(p.pageRow(bb)).toContainText(`/aa-${u}/bb-${u}`);
      expect(errors, "o arrasto com o teclado não pode rebentar a página").toEqual([]);
    });

    test("desfazer e refazer: criar página, mudar o nome e voltar atrás (botões e Ctrl+Z)", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      await expect(p.undoBtn).toBeDisabled();
      await expect(p.redoBtn).toBeDisabled();

      await p.newPageRaw();
      await expect(p.undoBtn).toBeEnabled();
      await expect(p.pageHeading).toHaveText("Nova página");
      await p.identify(`Hist-${u}`, `hist-${u}`);
      await p.showList();
      await expect(p.pageRow(`Hist-${u}`)).toBeVisible();

      // Botão: desfaz tudo, passo a passo, até ao princípio da pilha (a página nova também sai).
      for (let i = 0; i < 12 && (await p.undoBtn.isEnabled()); i++) await p.undoBtn.click();
      await expect(p.undoBtn).toBeDisabled();
      await expect(p.saveBtn).toBeDisabled();
      await expect(p.redoBtn).toBeEnabled();
      await p.showList();
      await expect(p.pageRow(`Hist-${u}`)).toHaveCount(0);

      // Atalhos (fora das caixas de texto): Ctrl+Shift+Z refaz um passo; Ctrl+Z desfaz-o.
      await page.keyboard.press("Control+Shift+Z");
      await expect(p.undoBtn).toBeEnabled();
      await page.keyboard.press("Control+Z");
      await expect(p.undoBtn).toBeDisabled();

      // Refazer tudo volta a mostrar a página, com o nome e o endereço que se lhe deu.
      for (let i = 0; i < 12 && (await p.redoBtn.isEnabled()); i++) await p.redoBtn.click();
      await expect(p.redoBtn).toBeDisabled();
      await expect(p.pageRow(`Hist-${u}`)).toContainText(`/hist-${u}`);
      await expect(p.saveBtn).toBeEnabled();
    });

    test("apagar página: recusado com subpágina ou ligação (motivos clicáveis); livre apaga e persiste", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const [pai, filho, alvo, origem, livre] = [`Pai-${u}`, `Filho-${u}`, `Alvo-${u}`, `Origem-${u}`, `Livre-${u}`];

      await p.createPage(pai, `pai-${u}`);
      await p.createSubpage(pai, filho, `filho-${u}`);
      await p.createPage(alvo, `alvo-${u}`);
      await p.createPage(livre, `livre-${u}`);
      // Uma página com um botão que leva para `alvo` (referência).
      await p.createPage(origem, `origem-${u}`);
      await p.addStarter("Em branco");
      await p.itemNames().then((n) => expect(n.length).toBeGreaterThan(0));
      await p.openItem("Bloco novo");
      await p.renameBlock(`Chamada-${u}`);
      await p.addComponent("Botão");
      await page.getByRole("textbox", { name: "Texto do botão (PT)" }).fill("Ver alvo");
      await page.getByRole("textbox", { name: "Texto do botão (EN)" }).fill("See target");
      await page.getByLabel("Leva para").selectOption({ label: `Página · ${alvo} (rascunho)` });

      // 1) Mãe com subpágina: recusado, e o motivo leva à subpágina.
      await p.openPage(pai);
      await p.openTab("Definições e SEO");
      const apagar = page.getByRole("region", { name: "Apagar página" });
      await expect(apagar.getByRole("button", { name: "Apagar página" })).toBeDisabled();
      await expect(apagar.getByText("Esta página não pode ser apagada enquanto:")).toBeVisible();
      await apagar.getByRole("button", { name: filho }).click();
      await expect(p.pageHeading).toHaveText(filho);

      // 2) Página referenciada por um botão: recusado, e o motivo leva ao bloco que a referencia.
      await p.openPage(alvo);
      await p.openTab("Definições e SEO");
      await expect(apagar.getByRole("button", { name: "Apagar página" })).toBeDisabled();
      await expect(apagar.getByText("Tem uma ligação para ela no bloco")).toBeVisible();
      await apagar.getByRole("button", { name: `Chamada-${u}` }).click();
      await expect(page.getByRole("heading", { level: 2, name: `Chamada-${u}` })).toBeVisible();

      // 3) Página livre: apaga (com confirmação), grava e continua apagada depois de recarregar.
      await p.openPage(livre);
      await p.openTab("Definições e SEO");
      await apagar.getByRole("button", { name: "Apagar página" }).click();
      await apagar.getByRole("button", { name: "Apagar", exact: true }).click();
      await p.showList();
      await expect(p.pageRow(livre)).toHaveCount(0);
      await p.save();
      await p.reload();
      await expect(p.pageRow(alvo)).toBeVisible();
      await expect(p.pageRow(livre)).toHaveCount(0);
    });
  });
}
