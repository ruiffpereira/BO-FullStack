/**
 * Acções de linha escondidas até ao hover — mas NUNCA invisíveis em toque ou teclado (a 834 e a 390 não há hover).
 * Uso: `className={REVEAL_ON_HOVER}` num elemento DENTRO de um pai com `group`. `group-focus-within` mostra-as
 * quando um botão recebe foco (Tab); `[@media(hover:none)]` mostra-as sempre em dispositivos sem hover.
 * Não escrever `opacity-0 group-hover:opacity-100` à mão (o teste `revealHover.test.ts` apanha-o).
 */
export const REVEAL_ON_HOVER =
  'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100'

/** Variante para elementos que em repouso ficam esbatidos em vez de invisíveis (ex.: pega de arrastar a 40%). */
export const REVEAL_DIM_ON_HOVER =
  'opacity-0 group-hover:opacity-40 group-focus-within:opacity-40 [@media(hover:none)]:opacity-40'
