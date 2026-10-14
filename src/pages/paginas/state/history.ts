/**
 * Desfazer / refazer por fotografias JSON da cópia de trabalho (PLANO F10).
 *
 * `stack[i]` é o estado ATUAL; `record()` é chamado depois de cada alteração. Escrever seguido no
 * mesmo campo (mesma `key`, a menos de 1,5 s da anterior) conta como UMA entrada. Nunca se funde
 * numa fotografia que coincide com o ponto "guardado" — senão desfazer não voltaria ao guardado.
 * Funções puras: devolvem sempre um histórico novo.
 */
import type { Work } from "./types";

export const MAX_HISTORY = 200;
export const MERGE_WINDOW_MS = 1500;

export interface History {
  stack: string[];
  i: number;
  /** Fotografia do último estado guardado no servidor (ou o carregado). */
  savedSnap: string;
  lastKey: string | null;
  lastAt: number;
}

export const snapshot = (work: Work): string => JSON.stringify(work);

export function createHistory(work: Work): History {
  const s = snapshot(work);
  return { stack: [s], i: 0, savedSnap: s, lastKey: null, lastAt: 0 };
}

/** Regista o estado `work` (já alterado). `key` junta teclas seguidas no mesmo campo. */
export function record(h: History, work: Work, key?: string | null, now: number = Date.now()): History {
  const s = snapshot(work);
  if (s === h.stack[h.i]) return h; // nada mudou de facto
  const k = key ?? null;
  if (k && k === h.lastKey && now - h.lastAt < MERGE_WINDOW_MS && h.stack[h.i] !== h.savedSnap) {
    const stack = h.stack.slice();
    stack[h.i] = s;
    return { ...h, stack, lastAt: now };
  }
  let stack = h.stack.slice(0, h.i + 1);
  stack.push(s);
  if (stack.length > MAX_HISTORY) stack = stack.slice(stack.length - MAX_HISTORY);
  return { ...h, stack, i: stack.length - 1, lastKey: k, lastAt: now };
}

export const canUndo = (h: History): boolean => h.i > 0;
export const canRedo = (h: History): boolean => h.i < h.stack.length - 1;
/** O estado atual é o último guardado? (fotografia a fotografia, não por posição na pilha) */
export const isAtSaved = (h: History): boolean => h.stack[h.i] === h.savedSnap;

function move(h: History, i: number): { history: History; work: Work } {
  return { history: { ...h, i, lastKey: null, lastAt: 0 }, work: JSON.parse(h.stack[i]) as Work };
}

export function undo(h: History): { history: History; work: Work } | null {
  return canUndo(h) ? move(h, h.i - 1) : null;
}

export function redo(h: History): { history: History; work: Work } | null {
  return canRedo(h) ? move(h, h.i + 1) : null;
}

/** Marca `work` como o ponto "guardado" (depois de um `save` bem-sucedido). */
export function markSaved(h: History, work: Work): History {
  return { ...h, savedSnap: snapshot(work), lastKey: null, lastAt: 0 };
}
