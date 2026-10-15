import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Arrastar com o dnd-kit do construtor (`SortableTree`): rato (pega "Mover", arranca depois de 6 px) e
 * teclado (Espaço pega, setas escolhem o sítio, → põe dentro, ← tira, Espaço larga, Esc cancela).
 * Sem esperas fixas: o rato mexe-se em passos (o dnd-kit precisa de vários `pointermove`) e o teclado
 * sincroniza com os anúncios do leitor de ecrã (`DndLiveRegion`) e com a frame seguinte.
 */

export type Where = "before" | "inside" | "after";

const frame = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

const FRACTION: Record<Where, number> = { before: 0.12, inside: 0.5, after: 0.88 };

async function center(l: Locator): Promise<{ x: number; y: number; w: number; h: number; top: number }> {
  const b = await l.boundingBox();
  if (!b) throw new Error("drag: elemento sem caixa (fora do ecrã ou escondido)");
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, top: b.y };
}

/** Arrasta a pega `handle` para cima da linha `target`: antes (linha azul em cima), dentro (contorno) ou depois. */
export async function dragWithMouse(page: Page, handle: Locator, target: Locator, where: Where): Promise<void> {
  await handle.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const from = await center(handle);
  const to = await center(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 4 });
  // Perto da borda da área com scroll o dnd-kit desloca-a sozinho (autoscroll) e o alvo foge debaixo do rato:
  // volta a apontar ao alvo até ele deixar de se mexer, e só então larga.
  let prevTop: number | null = null;
  for (let i = 0; i < 10; i++) {
    const t = await center(target);
    await page.mouse.move(t.x, t.top + t.h * FRACTION[where], { steps: i === 0 ? 25 : 3 });
    await frame(page);
    if (prevTop !== null && Math.abs(prevTop - t.top) < 0.5) break;
    prevTop = t.top;
  }
  await page.mouse.up();
  await clicksFlowAgain(page);
}

/**
 * O dnd-kit engole os `click` durante uns ms depois de largar (para o arrasto não "clicar" no que está por baixo).
 * Sem esperar, um clique logo a seguir (de um teste, nunca de uma pessoa) perde-se. Em vez de dormir, sonda-se:
 * dispara-se um `click` inócuo no `body` até chegar a um ouvinte no `document`.
 */
async function clicksFlowAgain(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const probe = () => resolve(true);
            document.addEventListener("click", probe, { once: true });
            document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            document.removeEventListener("click", probe);
            resolve(false);
          }),
      ),
    )
    .toBe(true);
}

/** As regiões vivas do dnd-kit (uma por `DndContext`) com os anúncios para leitores de ecrã. */
export function announcer(page: Page): Locator {
  return page.locator('[id^="DndLiveRegion"]');
}

/** Texto de cada região viva (cada uma guarda a última mensagem para sempre). */
const liveTexts = (page: Page): Promise<string[]> => announcer(page).evaluateAll((els) => els.map((e) => e.textContent ?? ""));

/**
 * Pega na linha da `handle` com Espaço, carrega nas `keys` (ex.: `["ArrowDown", "ArrowRight"]`) e larga com
 * Espaço (ou cancela com Esc se `drop` for false). Devolve o último anúncio ("… foi largado depois de …").
 * Os anúncios acompanham o gesto: em repouso cada região só tem a mensagem final do último arrasto ("foi largado…",
 * "ficou no mesmo sítio", "Movimento cancelado…"); "Pegou em…"/"está antes de…" só existem a meio do gesto.
 */
export async function dragWithKeyboard(
  page: Page,
  handle: Locator,
  keys: string[],
  opts: { drop?: boolean } = {},
): Promise<string> {
  const drop = opts.drop ?? true;
  await handle.scrollIntoViewIfNeeded();
  await handle.focus();
  await expect(handle).toBeFocused();
  await page.keyboard.press("Space");
  await expect.poll(async () => (await liveTexts(page)).some((t) => /Pegou em|está /.test(t)), { message: "o arrasto não arrancou" }).toBe(true);
  for (const k of keys) {
    const before = (await liveTexts(page)).join("|");
    await page.keyboard.press(k);
    if (k === "ArrowUp" || k === "ArrowDown") {
      // ↑/↓ mudam o alvo ("… está antes de Y"): esperar pelo anúncio (o dnd-kit rola a área com scroll suave e só
      // depois recalcula). Nos extremos da lista o alvo não muda — aí segue-se ao fim do tempo.
      await expect
        .poll(async () => (await liveTexts(page)).join("|") !== before, { timeout: 1_500 })
        .toBe(true)
        .catch(() => undefined);
    }
    await frame(page);
  }
  const during = await liveTexts(page);
  await page.keyboard.press(drop ? "Space" : "Escape");
  const end = drop ? /foi largado|ficou no mesmo sítio/ : /Movimento cancelado/;
  let last = "";
  await expect
    .poll(async () => {
      const now = await liveTexts(page);
      last = now.find((t, i) => t !== during[i] && end.test(t)) ?? "";
      return last;
    }, { message: "o arrasto não terminou" })
    .not.toBe("");
  return last;
}
