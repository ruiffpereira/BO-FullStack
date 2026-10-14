import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY, canRedo, canUndo, createHistory, isAtSaved, markSaved, record, redo, undo,
} from "../../../src/pages/paginas/state/history";
import type { Work } from "../../../src/pages/paginas/state/types";
import { clone, sampleWork } from "./fixtures";

const rename = (w: Work, name: string): Work => ({ ...clone(w), blocks: w.blocks.map((b, i) => (i === 0 ? { ...b, name } : b)) });

describe("history", () => {
  it("começa no estado carregado, guardado, sem desfazer nem refazer", () => {
    const h = createHistory(sampleWork());
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(isAtSaved(h)).toBe(true);
  });

  it("record regista uma entrada por alteração; undo e redo percorrem-nas", () => {
    const w0 = sampleWork();
    const w1 = rename(w0, "A");
    const w2 = rename(w1, "B");
    let h = createHistory(w0);
    h = record(h, w1, null, 1000);
    h = record(h, w2, null, 2000);
    expect(h.stack).toHaveLength(3);

    const u = undo(h)!;
    expect(u.work.blocks[0].name).toBe("A");
    const u2 = undo(u.history)!;
    expect(u2.work.blocks[0].name).toBe("b1");
    expect(undo(u2.history)).toBeNull();
    const r = redo(u2.history)!;
    expect(r.work.blocks[0].name).toBe("A");
  });

  it("não regista quando nada mudou", () => {
    const w0 = sampleWork();
    const h = createHistory(w0);
    expect(record(h, clone(w0))).toBe(h);
  });

  it("junta escrita seguida no mesmo campo (até 1,5 s) numa só entrada", () => {
    const w0 = sampleWork();
    let h = createHistory(w0);
    h = record(h, rename(w0, "A"), "b1.name", 1000);
    h = record(h, rename(w0, "AB"), "b1.name", 1800);
    h = record(h, rename(w0, "ABC"), "b1.name", 2500);
    expect(h.stack).toHaveLength(2);
    expect(undo(h)!.work.blocks[0].name).toBe("b1");
  });

  it("não junta se passou mais de 1,5 s, se a chave muda ou se não há chave", () => {
    const w0 = sampleWork();
    let h = createHistory(w0);
    h = record(h, rename(w0, "A"), "k", 1000);
    h = record(h, rename(w0, "AB"), "k", 3000); // mais de 1,5 s
    expect(h.stack).toHaveLength(3);
    h = record(h, rename(w0, "ABC"), "outra", 3100); // outra chave
    expect(h.stack).toHaveLength(4);
    h = record(h, rename(w0, "ABCD"), null, 3200); // sem chave
    h = record(h, rename(w0, "ABCDE"), null, 3300);
    expect(h.stack).toHaveLength(6);
  });

  it("nunca funde na fotografia guardada (desfazer volta mesmo ao guardado)", () => {
    const w0 = sampleWork();
    let h = createHistory(w0);
    h = record(h, rename(w0, "A"), "k", 1000);
    h = markSaved(h, rename(w0, "A"));
    expect(isAtSaved(h)).toBe(true);
    h = record(h, rename(w0, "AB"), "k", 1100);
    expect(h.stack).toHaveLength(3); // não fundiu em "A"
    expect(isAtSaved(h)).toBe(false);
    expect(isAtSaved(undo(h)!.history)).toBe(true);
  });

  it("uma alteração depois de desfazer corta o futuro", () => {
    const w0 = sampleWork();
    let h = createHistory(w0);
    h = record(h, rename(w0, "A"), null, 1);
    h = record(h, rename(w0, "B"), null, 2);
    h = undo(h)!.history;
    h = record(h, rename(w0, "C"), null, 3);
    expect(canRedo(h)).toBe(false);
    expect(h.stack).toHaveLength(3);
  });

  it("limita a pilha a 200 e o ponto guardado deixa de ser alcançável", () => {
    const w0 = sampleWork();
    let h = createHistory(w0);
    for (let n = 1; n <= MAX_HISTORY + 20; n++) h = record(h, rename(w0, `n${n}`), null, n);
    expect(h.stack).toHaveLength(MAX_HISTORY);
    expect(h.i).toBe(MAX_HISTORY - 1);
    expect(isAtSaved(h)).toBe(false); // o carregado já saiu da pilha
    expect(undo(h)!.work.blocks[0].name).toBe(`n${MAX_HISTORY + 19}`);
  });

  it("markSaved passa a ser o ponto guardado e repõe a junção", () => {
    const w0 = sampleWork();
    const w1 = rename(w0, "A");
    let h = record(createHistory(w0), w1, "k", 1);
    expect(isAtSaved(h)).toBe(false);
    h = markSaved(h, w1);
    expect(isAtSaved(h)).toBe(true);
    expect(isAtSaved(undo(h)!.history)).toBe(false);
  });
});
