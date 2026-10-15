/**
 * Barra do markdown: Negrito · Itálico · Lista. Funções puras sobre (texto, selecção) para a caixa com
 * foco; devolvem o texto novo e a selecção a repor. O negrito/itálico voltam a tirar-se se já estiverem.
 */
export type MdAction = "bold" | "italic" | "list";
export interface MdEdit {
  text: string;
  start: number;
  end: number;
}

function wrap(text: string, start: number, end: number, mark: string): MdEdit {
  const n = mark.length;
  const sel = text.slice(start, end);
  // Já embrulhado por fora da selecção: tira.
  if (text.slice(start - n, start) === mark && text.slice(end, end + n) === mark && start - n >= 0) {
    return { text: text.slice(0, start - n) + sel + text.slice(end + n), start: start - n, end: end - n };
  }
  // Já embrulhado por dentro da selecção: tira.
  if (sel.length >= 2 * n && sel.startsWith(mark) && sel.endsWith(mark)) {
    const inner = sel.slice(n, sel.length - n);
    return { text: text.slice(0, start) + inner + text.slice(end), start, end: start + inner.length };
  }
  return { text: text.slice(0, start) + mark + sel + mark + text.slice(end), start: start + n, end: end + n };
}

function list(text: string, start: number, end: number): MdEdit {
  const from = text.lastIndexOf("\n", start - 1) + 1;
  const nl = text.indexOf("\n", end);
  const to = nl < 0 ? text.length : nl;
  const lines = text.slice(from, to).split("\n");
  const allItems = lines.every((l) => l.startsWith("- "));
  const next = lines.map((l) => (allItems ? l.slice(2) : l.startsWith("- ") ? l : `- ${l}`)).join("\n");
  const delta = next.length - (to - from);
  return { text: text.slice(0, from) + next + text.slice(to), start: from, end: to + delta };
}

export function applyMd(text: string, start: number, end: number, action: MdAction): MdEdit {
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));
  if (action === "bold") return wrap(text, s, e, "**");
  if (action === "italic") return wrap(text, s, e, "*");
  return list(text, s, e);
}
