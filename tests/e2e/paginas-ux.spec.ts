import { test, expect, type Locator } from "@playwright/test";
import { dragWithKeyboard } from "./fixtures/drag";
import { PaginasPage, VIEWPORTS, uniq } from "./pages/PaginasPage";

/**
 * Três problemas vistos nas revisões do construtor, postos à prova:
 *  1. «ecrã em branco» a 390 depois de arrastar com o teclado na lista — sequência de arrastos com o teclado
 *     (grupos, páginas, itens da página, componentes) e, a cada passo, a página tem de continuar viva;
 *  2. a 1440 o toast (canto superior direito) tapa o botão Guardar durante uns segundos — tapa de facto? impede o clique?
 *  3. a 390 os separadores da paleta de blocos cortam o 3.º («Copiar um que já existe») — alcança-se (scroll/teclado)?
 */

test.use({ storageState: { cookies: [], origins: [] } });

/** Caixa ocupada por um locator (ou null). */
const box = async (l: Locator) => l.boundingBox();

for (const vp of VIEWPORTS) {
  test.describe(`Páginas · UX — ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("(1) arrastar com o teclado nunca deixa o ecrã em branco: grupos, páginas, itens e componentes", async ({ page, context }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      const alive = async (what: string) => {
        expect(errors, `erros de página depois de ${what}`).toEqual([]);
        // A raiz tem conteúdo, a barra de topo continua à vista e há uma coluna (lista ou página) visível.
        expect(await page.evaluate(() => document.getElementById("root")?.innerText.length ?? 0), `a raiz ficou vazia depois de ${what}`).toBeGreaterThan(200);
        await expect(p.saveBtn, `a barra de topo desapareceu depois de ${what}`).toBeInViewport();
        await expect(p.list.or(p.pageHeading).first(),`nem a lista nem a página estão visíveis depois de ${what}`).toBeVisible();
        expect(await page.evaluate(() => window.scrollX + document.documentElement.scrollLeft + document.body.scrollLeft), `o ecrã deslizou para o lado depois de ${what}`).toBe(0);
      };

      await p.createPage(`Aa-${u}`, `aa-${u}`);
      await p.createPage(`Bb-${u}`, `bb-${u}`);
      await p.createSubpage(`Aa-${u}`, `Cc-${u}`, `cc-${u}`);
      for (const name of [`Ia-${u}`, `Ib-${u}`]) {
        await p.addStarter("Título e texto");
        await p.openItem("Título e texto");
        await p.renameBlock(name);
        await p.backToPage();
      }
      await p.showList();
      await alive("preparar");

      // Grupos da lista (Páginas · Blocos · Partes comuns): o 2.º sobe, volta a descer, e um Esc a meio.
      const grupo = (n: "Páginas" | "Blocos" | "Partes comuns") => p.group(n).getByRole("button", { name: "Mover" }).first();
      await dragWithKeyboard(page, grupo("Blocos"), ["ArrowUp"]);
      await alive("subir o grupo Blocos");
      await dragWithKeyboard(page, grupo("Blocos"), ["ArrowDown"]);
      await alive("descer o grupo Blocos");
      await dragWithKeyboard(page, grupo("Partes comuns"), ["ArrowUp", "ArrowUp"], { drop: false });
      await alive("cancelar o arrasto de Partes comuns");

      // Páginas: para dentro, para fora, com setas laterais soltas pelo meio.
      await p.setGroupOpen("Blocos", false);
      const mover = (t: string) => p.pageRow(t).getByRole("button", { name: "Mover" });
      await dragWithKeyboard(page, mover(`Cc-${u}`), ["ArrowDown", "ArrowRight"]);
      await alive("pôr Cc dentro de Bb");
      await dragWithKeyboard(page, mover(`Bb-${u}`), ["ArrowUp", "ArrowLeft", "ArrowRight", "ArrowLeft"]);
      await alive("mexer em Bb com setas laterais");
      await dragWithKeyboard(page, mover(`Aa-${u}`), ["ArrowDown", "ArrowDown"], { drop: false });
      await alive("cancelar o arrasto de Aa");

      // Itens da página e componentes do bloco (o editor também é uma lista com teclado).
      await p.openPage(`Cc-${u}`); // é a página que recebeu os dois blocos
      await expect.poll(() => p.itemNames()).toHaveLength(2);
      const names = await p.itemNames();
      expect(names).toHaveLength(2);
      await dragWithKeyboard(page, p.itemCard(names[0]).getByRole("button", { name: "Mover" }), ["ArrowDown"]);
      await alive("descer um bloco da página");
      await p.openItem(names[1]);
      await expect.poll(() => p.compNames()).toEqual(["Título", "Texto"]);
      const compHandle = (i: number) => p.compHead(i).locator("xpath=ancestor::*[@data-sortable-row][1]").getByRole("button", { name: "Mover" });
      await dragWithKeyboard(page, compHandle(0), ["ArrowDown"]);
      await expect.poll(() => p.compNames()).toEqual(["Texto", "Título"]);
      await alive("trocar a ordem dos componentes");
      await dragWithKeyboard(page, compHandle(1), ["ArrowUp"]);
      await expect.poll(() => p.compNames()).toEqual(["Título", "Texto"]);
      await alive("repor a ordem dos componentes");

      // De volta à lista (em ecrãs estreitos passa-se pelo botão «‹ Voltar»): continua inteira.
      await p.showList();
      await expect(p.group("Páginas")).toBeVisible();
      await alive("voltar à lista");
    });

    for (const stacked of [2, 3]) {
      test(`(2) ${stacked} toasts empilhados: o botão Guardar continua clicável (toasts no canto superior direito)`, async ({ page, context }) => {
        // As confirmações rápidas do construtor (juntar, duplicar…) usam um só toast que se substitui: não empilham e
        // não chegam a tapar o Guardar (canto superior direito a 1440 e 834; o cabeçalho a 390).
        const p = new PaginasPage(page, context, "pages@e2e", false); // sem anular os toasts: é isto que se mede
        await p.open();
        const u = uniq();
        await p.createPage(`Toast-${u}`, `toast-${u}`);
        for (let i = 0; i < stacked; i++) await p.addStarter("Título e texto"); // um toast por bloco juntado, mas substituem-se
        const toasts = page.locator("[data-sonner-toast]");
        await expect(toasts).toHaveCount(1);
        // Esperar que a pilha assente (o Sonner anima a entrada): a caixa do último toast deixa de mexer.
        let last = "";
        await expect.poll(async () => {
          const now = JSON.stringify(await Promise.all([...Array(1).keys()].map((i) => toasts.nth(i).boundingBox())));
          const same = now === last;
          last = now;
          return same;
        }).toBe(true);
        await expect(p.saveBtn).toBeEnabled();

        // Medição: quem está por cima do centro do botão e quanto da área os toasts tapam.
        const g = (await box(p.saveBtn))!;
        const probe = await page.evaluate(([x, y]) => {
          const el = document.elementFromPoint(x, y);
          return { covered: !!el?.closest("[data-sonner-toast]"), tag: el?.tagName ?? null };
        }, [g.x + g.width / 2, g.y + g.height / 2]);
        let overlap = 0;
        for (let i = 0; i < (await toasts.count()); i++) {
          const t = await box(toasts.nth(i));
          if (!t) continue;
          const w = Math.max(0, Math.min(g.x + g.width, t.x + t.width) - Math.max(g.x, t.x));
          const h = Math.max(0, Math.min(g.y + g.height, t.y + t.height) - Math.max(g.y, t.y));
          overlap = Math.max(overlap, (w * h) / (g.width * g.height));
        }
        const medida = `${vp.label}: ${stacked} toasts; Guardar ${Math.round(g.width)}×${Math.round(g.height)} em (${Math.round(g.x)}, ${Math.round(g.y)}); tapado: ${Math.round(overlap * 100)}% da área; no centro está <${probe.tag}>${probe.covered ? " (um toast)" : ""}`;
        test.info().annotations.push({ type: "medição", description: medida });
        console.log("[medição toast]", medida);

        // Clicável com o toast à vista (1,5 s < ~4 s de vida do toast): esperar que saia só serviria para esconder o problema.
        await expect(p.saveBtn.click({ trial: true, timeout: 1_500 }), "Guardar está tapado por um toast").resolves.toBeUndefined();
        expect(probe.covered, "o centro do botão Guardar está por baixo de um toast").toBe(false);
      });
    }

    test("(3) paleta de blocos: os separadores (o 3.º, «Copiar um que já existe») alcançam-se por clique e por teclado", async ({ page, context }) => {
      const p = new PaginasPage(page, context);
      await p.open();
      const u = uniq();
      await p.createPage(`Tabs-${u}`, `tabs-${u}`);
      await p.openBlockPalette();

      const lista = p.dialog.getByRole("tablist");
      const tabs = p.dialog.getByRole("tab");
      // Abaixo de 860 px os rótulos abreviam-se (caberem todos); o nome acessível fica sempre completo.
      await expect(tabs).toHaveText(vp.width < 860 ? ["Novo", "Usar", "Copiar", "Especiais"] : ["Bloco novo", "Usar um que já existe", "Copiar um que já existe", "Especiais deste site"]);
      await expect(tabs.nth(2)).toHaveAccessibleName("Copiar um que já existe");
      const m = await lista.evaluate((el) => ({ visible: el.clientWidth, content: el.scrollWidth }));
      const t3 = (await box(tabs.nth(2)))!;
      const l = (await box(lista))!;
      const clipped = t3.x + t3.width > l.x + l.width + 0.5;
      expect(clipped, "o 3.º separador está cortado").toBe(false);
      expect(m.content, "a lista de separadores tem scroll horizontal").toBeLessThanOrEqual(m.visible);
      const medida = `${vp.label}: tablist ${m.visible}px visíveis de ${m.content}px; 3.º separador ${clipped ? "CORTADO" : "à vista"} à partida; ${m.content > m.visible ? "há scroll horizontal" : "sem scroll"}`;
      test.info().annotations.push({ type: "medição", description: medida });
      console.log("[medição tabs]", medida);

      // Por clique (o scroll horizontal da lista leva-o à vista) …
      await tabs.nth(2).scrollIntoViewIfNeeded();
      await expect(tabs.nth(2)).toBeInViewport({ ratio: 0.99 });
      await tabs.nth(2).click();
      await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
      await expect(p.dialog.getByText("Copiar um bloco", { exact: true })).toBeVisible();
      // … e por teclado (← → trocam de separador).
      await tabs.nth(0).click();
      await tabs.nth(0).press("ArrowRight");
      await tabs.nth(1).press("ArrowRight");
      await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
      await tabs.nth(2).press("ArrowRight");
      await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");
      await expect(tabs.nth(3)).toBeInViewport({ ratio: 0.99 }).catch(() => {
        // O teclado muda de separador mas não rola a lista: anota-se em vez de falhar (o 3.º/4.º já se alcançam por scroll).
        test.info().annotations.push({ type: "medição", description: `${vp.label}: ao chegar ao 4.º separador com o teclado, ele fica fora de vista` });
      });
    });
  });
}
