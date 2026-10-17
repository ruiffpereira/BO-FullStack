import { type Page, type BrowserContext, type Locator, expect } from "@playwright/test";
import { loginAs } from "../fixtures/login";
import { withSessionRetry } from "../fixtures/session";

/**
 * Página `/equipa` (B41) vista pelo DONO do tenant: lista, convite e a ficha com a ÁRVORE de permissões
 * (`PermissionTree`). Os nomes acessíveis vêm do componente: a caixa de cada nó tem `aria-label` = nome do nó,
 * o chevron é "Abrir <nó>" / "Fechar <nó>" e o nível é uma tab "<nó>: só ver" / "<nó>: editar".
 */
export class EquipaPage {
  constructor(
    readonly page: Page,
    readonly context: BrowserContext,
    readonly owner: string,
  ) {}

  /** Entra como dono e abre `/equipa` (em qualquer largura: a rota existe, o menu do avatar não é preciso). */
  async open(): Promise<void> {
    await loginAs(this.context, this.owner);
    await withSessionRetry(
      this.page,
      this.context,
      this.owner,
      () => this.page.goto("/equipa"),
      async () => {
        await expect(this.page.getByRole("button", { name: "Convidar utilizador" })).toBeVisible({ timeout: 10_000 });
      },
    );
  }

  row(name: string): Locator {
    // Computador: linha da tabela; telemóvel: cartão (botão) — o mesmo nome acessível, só um deles está visível.
    return this.page
      .getByRole("row", { name: `Abrir ${name}` })
      .or(this.page.getByRole("button", { name: `Abrir ${name}`, exact: true }));
  }

  /** Abre a ficha de um membro (o diálogo tem o nome do membro). */
  async openMember(name: string): Promise<Locator> {
    await expect(this.row(name)).toBeVisible({ timeout: 10_000 });
    await this.row(name).click();
    const ficha = this.page.getByRole("dialog", { name });
    await expect(ficha).toBeVisible();
    return ficha;
  }

  node(scope: Locator, label: string): Locator {
    return scope.getByRole("checkbox", { name: label, exact: true });
  }

  async expand(scope: Locator, label: string): Promise<void> {
    const open = scope.getByRole("button", { name: `Abrir ${label}`, exact: true });
    if (await open.count()) await open.click();
    await expect(scope.getByRole("button", { name: `Fechar ${label}`, exact: true })).toBeVisible();
  }

  level(scope: Locator, label: string, level: "só ver" | "editar"): Locator {
    return scope.getByRole("tab", { name: `${label}: ${level}`, exact: true });
  }

  /** `true` se a caixa está no estado parcial (o `indeterminate` só existe por JS). */
  async isPartial(box: Locator): Promise<boolean> {
    return box.evaluate((el) => (el as HTMLInputElement).indeterminate);
  }
}
