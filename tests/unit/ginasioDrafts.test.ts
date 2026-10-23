import { describe, it, expect } from "vitest";
import {
  apiToSetRowDrafts,
  emptyPreset,
  emptySetRow,
  presetIsComplete,
  presetValues,
  setRowsResumo,
  setRowsToApi,
  weeksBetweenISO,
  addDaysISO,
} from "../../src/pages/ginasio/drafts";

describe("Ginásio — rascunhos de séries (draft ⇄ API)", () => {
  it("setRowsToApi: campos vazios viram 0; a série composta usa o 1.º passo", () => {
    const rows = [
      { ...emptySetRow(), reps: "", weight: "", rest: "" },
      {
        reps: "x",
        weight: "x",
        rest: "90",
        drop: true,
        steps: [
          { reps: "10", weight: "40", rest: "0" },
          { reps: "8", weight: "30", rest: "0" },
        ],
      },
    ];
    expect(setRowsToApi(rows)).toEqual([
      { drop: false, reps: 0, weight: 0, rest: 0, steps: [] },
      {
        drop: true,
        reps: 10,
        weight: 40,
        rest: 90,
        steps: [
          { reps: 10, weight: 40, rest: 0 },
          { reps: 8, weight: 30, rest: 0 },
        ],
      },
    ]);
  });

  it("apiToSetRowDrafts é o inverso (strings) e tolera null", () => {
    expect(apiToSetRowDrafts(null)).toEqual([]);
    const d = apiToSetRowDrafts([{ drop: false, reps: 12, weight: 20, rest: 60, steps: [] }]);
    expect(d).toEqual([{ reps: "12", weight: "20", rest: "60", drop: false, steps: [] }]);
  });

  it("setRowsResumo descreve a prescrição", () => {
    expect(setRowsResumo([])).toBe("–");
    expect(
      setRowsResumo([
        { drop: false, reps: 10, weight: 20, rest: 60, steps: [] },
        { drop: false, reps: 8, weight: 30, rest: 60, steps: [] },
      ]),
    ).toBe("2 séries (10 · 8) · 20-30kg");
  });
});

describe("Ginásio — presetIsComplete", () => {
  const base = emptyPreset();
  it("sem nome nunca está completo", () => {
    expect(presetIsComplete({ ...base, sets: "3", reps: "10" })).toBe(false);
  });
  it("força uniforme: séries e reps", () => {
    expect(presetIsComplete({ ...base, name: "Supino", sets: "3", reps: "10" })).toBe(true);
    expect(presetIsComplete({ ...base, name: "Supino", sets: "3" })).toBe(false);
  });
  it("tempo: duração > 0", () => {
    expect(presetIsComplete({ ...base, name: "Prancha", type: "time", duration: "30" })).toBe(true);
    expect(presetIsComplete({ ...base, name: "Prancha", type: "time", duration: "0" })).toBe(false);
  });
  it("série a série: todas as séries com reps (a composta pelos passos)", () => {
    const ok = { ...emptySetRow(), reps: "10" };
    expect(presetIsComplete({ ...base, name: "X", mode: "perSet", setRows: [ok] })).toBe(true);
    expect(presetIsComplete({ ...base, name: "X", mode: "perSet", setRows: [] })).toBe(false);
    const drop = { ...ok, drop: true, steps: [{ reps: "", weight: "0", rest: "0" }] };
    expect(presetIsComplete({ ...base, name: "X", mode: "perSet", setRows: [drop] })).toBe(false);
  });
});

describe("Ginásio — presetValues e datas", () => {
  it("presetValues aplica os valores por omissão", () => {
    expect(presetValues(undefined)).toMatchObject({ type: "strength", mode: "uniform", sets: 3, reps: 10, rest: 60 });
  });
  it("addDaysISO / weeksBetweenISO", () => {
    expect(addDaysISO("2026-07-01", 7)).toBe("2026-07-08");
    expect(weeksBetweenISO("2026-07-01", "2026-07-22")).toBe(3);
  });
});
