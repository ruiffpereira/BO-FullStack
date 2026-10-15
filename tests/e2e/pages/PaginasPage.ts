import { type BrowserContext, type Locator, type Page, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loginAs } from "../fixtures/login";
import { withSessionRetry } from "../fixtures/session";

/**
 * Page object do construtor de páginas (`/paginas`, B38).
 *
 * Larguras: a coluna da lista e a do centro só ficam lado a lado a partir de 860 px. Abaixo disso
 * (tablet 834 e telemóvel 390) vê-se um ecrã de cada vez — lista → página — com "‹ Voltar". Os métodos
 * `showList()` / `openPage()` escondem essa diferença para os specs serem iguais nas três larguras.
 *
 * Os specs partilham o tenant `pages@e2e` (BD recriada a cada corrida, mas não entre testes): cada
 * teste cria entidades com nomes únicos (`uniq()`) e só mexe nelas.
 */

export const VIEWPORTS = [
  { label: "computador 1440", width: 1440, height: 900 },
  { label: "tablet 834", width: 834, height: 1112 },
  { label: "telemóvel 390", width: 390, height: 844 },
] as const;

/** Sufixo curto, único por chamada (minúsculas e dígitos: serve de slug). */
export function uniq(): string {
  return `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Guarda uma captura para revisão a olho em `Backoffice/.capturas-f16/` (gitignored). */
export async function shot(page: Page, name: string): Promise<void> {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.capturas-f16");
  fs.mkdirSync(dir, { recursive: true });
  const w = page.viewportSize()?.width ?? 0;
  await page.screenshot({ path: path.join(dir, `${name}-${w}.png`) });
}

/** O nome acessível de uma linha da lista leva um " Falta traduzir" quando há traduções em falta. */
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rowName = (name: string): RegExp => new RegExp(`^${escapeRe(name)}( Falta traduzir)?$`);

export type GroupName = "Páginas" | "Blocos" | "Partes comuns";

export class PaginasPage {
  /**
   * `passThroughToasts` (por omissão): os toasts do Sonner (canto superior direito) tapam a barra de topo
   * (Desfazer/Refazer/Guardar) uns segundos e, ao chegarem a meio de um clique, engolem-no — ruído para
   * quem testa outra coisa. Fica com `pointer-events: none`; o teste que mede esse problema desliga-o.
   */
  constructor(
    readonly page: Page,
    readonly context: BrowserContext,
    readonly user: string = "pages@e2e",
    readonly passThroughToasts: boolean = true,
  ) {}

  /** Um ecrã de cada vez (lista OU centro). */
  get narrow(): boolean {
    return this.page.viewportSize()!.width < 860;
  }

  // ── abrir / recarregar ──────────────────────────────────────────────────────

  /** Entra no tenant e abre `/paginas`. Num site ainda vazio cria e guarda a página inicial (a 1.ª página é sempre a home). */
  async open(): Promise<void> {
    await loginAs(this.context, this.user);
    if (this.passThroughToasts) {
      await this.page.addInitScript(() => {
        const style = document.createElement("style");
        style.textContent = "[data-sonner-toaster], [data-sonner-toast] { pointer-events: none !important; }";
        document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
      });
    }
    await withSessionRetry(this.page, this.context, this.user, () => this.page.goto("/paginas"), () => this.expectReady());
    await this.ensureHome();
  }

  async ensureHome(): Promise<void> {
    await expect(this.group("Páginas")).toBeVisible();
    if (await this.group("Páginas").getByText("Ainda não há páginas.").isVisible()) {
      await this.newPageRaw();
      await this.save();
    }
  }

  /** Recarrega a página (só sem alterações por guardar: senão o `beforeunload` trava a navegação). */
  async reload(): Promise<void> {
    await withSessionRetry(this.page, this.context, this.user, () => this.page.reload(), () => this.expectReady());
  }

  async expectReady(): Promise<void> {
    await expect(this.history).toBeVisible({ timeout: 15_000 });
  }

  // ── barra de topo ───────────────────────────────────────────────────────────

  get history(): Locator {
    return this.page.getByRole("group", { name: "Histórico" });
  }
  get undoBtn(): Locator {
    return this.history.getByRole("button", { name: "Desfazer" });
  }
  get redoBtn(): Locator {
    return this.history.getByRole("button", { name: "Refazer" });
  }
  get saveBtn(): Locator {
    return this.page.getByRole("button", { name: "Guardar", exact: true });
  }
  /** "Alterações por guardar" · "A guardar…" · "No ar · hh:mm" · "Falhou…" (o resto dos `status` está vazio). */
  get status(): Locator {
    return this.page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /Alterações por guardar|A guardar|No ar|Guardado|A publicar|Falhou|Conta alterada|Não foi possível guardar/ });
  }
  /** "N por traduzir · Ver onde" (só aparece se falta traduzir). */
  get missingBtn(): Locator {
    return this.page.getByRole("button", { name: /por traduzir · Ver onde/ });
  }
  get seoSiteBtn(): Locator {
    return this.page.getByRole("button", { name: "SEO do site" });
  }

  /** Guarda e espera que o estado passe a "No ar" (modo runtime) sem alterações. */
  async save(): Promise<void> {
    await expect(this.saveBtn).toBeEnabled();
    await this.saveBtn.click();
    await expect(this.saveBtn).toBeDisabled({ timeout: 15_000 });
    await expect(this.status).toHaveText(/No ar/, { timeout: 15_000 });
  }

  // ── a lista (esquerda) ──────────────────────────────────────────────────────

  get list(): Locator {
    return this.page.getByRole("navigation", { name: "Páginas do site" });
  }
  group(name: GroupName): Locator {
    return this.list.getByRole("region", { name: new RegExp(`^${name}`) });
  }

  /** Em ecrãs estreitos pode estar-se num editor ou na página: volta, passo a passo, até à lista. */
  async showList(): Promise<void> {
    for (let i = 0; i < 4 && !(await this.list.isVisible()); i++) {
      const lista = this.page.getByRole("button", { name: "Voltar à lista" });
      if (await lista.isVisible()) await lista.click();
      else await this.page.getByRole("button", { name: /^Voltar à página/ }).first().click();
    }
    await expect(this.list).toBeVisible();
  }

  /** Abre/fecha um grupo (a lista é uma só coluna com scroll: fechar o que não interessa evita rolar a meio de um arrasto). */
  async setGroupOpen(name: GroupName, open: boolean): Promise<void> {
    await this.showList();
    const toggle = this.group(name).getByRole("button", { name: "Abrir ou fechar", exact: true }).first();
    if (((await toggle.getAttribute("aria-expanded")) === "true") !== open) await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", String(open));
  }

  pageRow(title: string): Locator {
    // Pelo botão principal (nome exacto): o texto da linha leva o endereço, que repete o da mãe nas subpáginas.
    return this.group("Páginas").locator("[data-sortable-row]").filter({ has: this.page.getByRole("button", { name: rowName(title) }) });
  }
  blockRow(name: string): Locator {
    return this.group("Blocos").locator("[data-sortable-row]").filter({ has: this.page.getByRole("button", { name: rowName(name) }) });
  }

  /** "Nova" no grupo Páginas: cria uma página de 1.º nível (fica seleccionada) e vai para ela. */
  async newPageRaw(): Promise<void> {
    await this.showList();
    await this.group("Páginas").getByRole("button", { name: "Nova página" }).click();
    await expect(this.pageHeading).toBeVisible();
  }

  /** Cria uma página de 1.º nível com este nome (nas duas línguas) e endereço. Fica seleccionada, no separador Conteúdo. */
  async createPage(title: string, slug?: string): Promise<void> {
    await this.newPageRaw();
    await this.identify(title, slug);
  }

  /** Cria uma subpágina dentro de `parentTitle` com este nome. */
  async createSubpage(parentTitle: string, title: string, slug?: string): Promise<void> {
    await this.showList();
    await this.pageRow(parentTitle).getByRole("button", { name: "Criar subpágina" }).click();
    await expect(this.pageHeading).toBeVisible();
    await this.identify(title, slug);
  }

  /** Dá nome (PT e EN) e endereço à página aberta, nas Definições, e volta ao Conteúdo. */
  async identify(title: string, slug?: string): Promise<void> {
    await this.openTab("Definições e SEO");
    await this.page.getByRole("textbox", { name: "Nome da página (PT)" }).fill(title);
    // Tenants de uma só língua não têm a caixa EN.
    const en = this.page.getByRole("textbox", { name: "Nome da página (EN)" });
    if ((await en.count()) > 0) await en.fill(title);
    if (slug) {
      const addr = this.page.getByRole("textbox", { name: "Endereço", exact: true });
      await addr.fill(slug);
      await addr.blur();
    }
    await this.openTab("Conteúdo");
    await expect(this.pageHeading).toHaveText(title);
  }

  /** Selecciona uma página da lista e mostra-a (em ecrãs estreitos passa para o centro). */
  async openPage(title: string): Promise<void> {
    await this.showList();
    await this.pageRow(title).getByRole("button", { name: rowName(title) }).click();
    await expect(this.pageHeading).toHaveText(title);
  }

  async openBlockFromLibrary(name: string): Promise<void> {
    await this.showList();
    await this.blockRow(name).getByRole("button", { name: rowName(name) }).click();
    await expect(this.page.getByRole("heading", { level: 2, name })).toBeVisible();
  }

  async openPart(part: "Topo" | "Rodapé"): Promise<void> {
    await this.showList();
    await this.group("Partes comuns").getByRole("button", { name: part, exact: true }).click();
    await expect(this.page.getByRole("heading", { level: 2, name: part })).toBeVisible();
  }

  // ── a página (centro) ───────────────────────────────────────────────────────

  /** O título da página aberta (os `h2` da topbar do Shell são outro nível/nome). */
  get pageHeading(): Locator {
    return this.page.getByRole("main").getByRole("heading", { level: 2 }).first();
  }

  async openTab(name: "Conteúdo" | "Definições e SEO"): Promise<void> {
    const tab = this.page.getByRole("tab", { name });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }

  /** Nomes (aria-label "Editar …") dos itens da página, por ordem. Topo e Rodapé ficam de fora. */
  async itemNames(): Promise<string[]> {
    const labels = await this.page
      .getByRole("main")
      .getByRole("button", { name: /^Editar / })
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
    return labels.map((l) => l.replace(/^Editar /, "")).filter((l) => l !== "topo do site" && l !== "rodapé do site");
  }

  itemCard(name: string): Locator {
    return this.page.getByRole("main").locator("[data-sortable-row]").filter({ has: this.page.getByRole("button", { name: `Editar ${name}`, exact: true }) });
  }

  async openItem(name: string): Promise<void> {
    await this.page.getByRole("button", { name: `Editar ${name}`, exact: true }).click();
    await expect(this.page.getByRole("heading", { level: 2, name })).toBeVisible();
  }

  /** Volta do editor de um bloco à página (o caminho "‹ <página>"). */
  async backToPage(): Promise<void> {
    await this.page.getByRole("button", { name: /^Voltar à página/ }).first().click();
    await expect(this.page.getByRole("tab", { name: "Conteúdo" })).toBeVisible();
  }

  // ── paleta de blocos ────────────────────────────────────────────────────────

  get dialog(): Locator {
    return this.page.getByRole("dialog");
  }

  /** "Adicionar bloco" no fim da página (ou o do estado vazio) e espera pela paleta. */
  async openBlockPalette(): Promise<void> {
    await this.page.getByRole("main").getByRole("button", { name: "Adicionar bloco", exact: true }).first().click();
    await expect(this.dialog.getByRole("tab", { name: "Bloco novo" })).toBeVisible();
  }

  async paletteTab(name: "Bloco novo" | "Usar um que já existe" | "Copiar um que já existe" | "Especiais deste site"): Promise<void> {
    const tab = this.dialog.getByRole("tab", { name });
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }

  /** Escolhe um cartão da paleta (título exacto) e espera que a paleta feche. */
  async pick(card: string | RegExp): Promise<void> {
    await this.dialog.getByRole("button", { name: card }).first().click();
    await expect(this.dialog).toHaveCount(0);
  }

  /** Bloco novo a partir de um ponto de partida, na página aberta. */
  async addStarter(starter: string): Promise<void> {
    await this.openBlockPalette();
    await this.pick(new RegExp(`^${starter}`));
  }

  // ── editor de bloco ─────────────────────────────────────────────────────────

  async renameBlock(name: string): Promise<void> {
    await this.page.getByRole("textbox", { name: "Nome do bloco" }).fill(name);
    await expect(this.page.getByRole("heading", { level: 2, name })).toBeVisible();
  }

  group2(label: string): Locator {
    return this.page.getByRole("group", { name: label, exact: true });
  }
  /** Botão de uma escolha (fundo, disposição, "onde fica", estilo, nível…). */
  choice(groupLabel: string, option: string | RegExp): Locator {
    return this.group2(groupLabel).getByRole("button", { name: option });
  }

  /** Linhas de componentes do editor de bloco, por ordem (rótulo do tipo). */
  async compNames(): Promise<string[]> {
    return (await this.page.getByRole("main").locator('b[id^="cp-"]').allTextContents()).map((t) => t.trim());
  }

  /** Cabeçalho (botão `aria-expanded`) da linha de componente n-ésima. */
  compHead(index: number): Locator {
    return this.page.getByRole("main").locator('b[id^="cp-"]').nth(index).locator("xpath=ancestor::button[1]");
  }

  async addComponent(type: string): Promise<void> {
    await this.page.getByRole("main").getByRole("button", { name: "Adicionar componente" }).click();
    await expect(this.dialog.getByRole("tab", { name: "Componente novo" })).toBeVisible();
    await this.dialog.getByRole("button", { name: new RegExp(`^${type}`) }).first().click();
    await expect(this.dialog).toHaveCount(0);
  }

  // ── desfazer / refazer ──────────────────────────────────────────────────────

  async undo(): Promise<void> {
    await this.undoBtn.click();
  }
  async redo(): Promise<void> {
    await this.redoBtn.click();
  }

  // ── traduções ───────────────────────────────────────────────────────────────

  /**
   * "Ver onde" até não haver nada por traduzir: cada clique leva ao 1.º campo em falta e foca a caixa;
   * escreve-se nela. Devolve, por ordem, os campos que foram levados a preencher (`data-fp` · língua).
   */
  async translateAll(text = "Translated"): Promise<{ path: string; locale: string }[]> {
    const visited: { path: string; locale: string }[] = [];
    while (await this.missingBtn.isVisible()) {
      const before = await this.missingBtn.textContent();
      await this.missingBtn.click();
      const focused = this.page.locator("[data-fp]:focus");
      await expect(focused).toBeVisible();
      visited.push({ path: (await focused.getAttribute("data-fp")) ?? "", locale: (await focused.getAttribute("data-fl")) ?? "" });
      await focused.fill(`${text} ${visited.length}`);
      // Cada tradução feita tem de fazer baixar (ou desaparecer) o contador.
      await expect(async () => {
        const now = (await this.missingBtn.isVisible()) ? await this.missingBtn.textContent() : "";
        expect(now).not.toBe(before);
      }).toPass({ timeout: 5_000 });
      if (visited.length > 40) throw new Error("translateAll: mais de 40 campos por traduzir — a andar em círculos?");
    }
    return visited;
  }
}
