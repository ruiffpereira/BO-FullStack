import { describe, it, expect } from "vitest";
import { buildPlanPrintHtml, pickDensity, splitFrontBack } from "../../src/lib/planPdf";
import type { GymProgram } from "../../src/gen/backoffice/types/GymProgram";
import type { GymWorkout } from "../../src/gen/backoffice/types/GymWorkout";
import type { GymWorkoutExercise } from "../../src/gen/backoffice/types/GymWorkoutExercise";

function ex(partial: Partial<GymWorkoutExercise> & Pick<GymWorkoutExercise, "id" | "name" | "group" | "sets" | "reps">): GymWorkoutExercise {
  return { rest: 60, ...partial };
}

function workout(partial: Partial<GymWorkout> & Pick<GymWorkout, "id" | "name" | "exercises">): GymWorkout {
  return { ...partial };
}

function program(partial: Partial<GymProgram> & Pick<GymProgram, "id" | "name" | "customerId" | "workouts">): GymProgram {
  return { owner: "coach", ...partial };
}

describe("pickDensity", () => {
  it("poucos exercícios → normal", () => {
    expect(pickDensity(0)).toBe("normal");
    expect(pickDensity(16)).toBe("normal");
  });
  it("como a maqueta (24) → compacto", () => {
    expect(pickDensity(17)).toBe("compacto");
    expect(pickDensity(24)).toBe("compacto");
    expect(pickDensity(30)).toBe("compacto");
  });
  it("muitíssimos exercícios → ultra", () => {
    expect(pickDensity(31)).toBe("ultra");
    expect(pickDensity(56)).toBe("ultra");
  });
});

describe("splitFrontBack", () => {
  it("7 dias (caso da maqueta) → 3 na frente, 4 no verso", () => {
    const days = Array.from({ length: 7 }, (_, i) => i);
    const { front, back } = splitFrontBack(days);
    expect(front).toEqual([0, 1, 2]);
    expect(back).toEqual([3, 4, 5, 6]);
  });
  it("1 dia → tudo na frente, verso vazio", () => {
    const { front, back } = splitFrontBack([0]);
    expect(front).toEqual([0]);
    expect(back).toEqual([]);
  });
  it("0 dias → ambos vazios", () => {
    const { front, back } = splitFrontBack([]);
    expect(front).toEqual([]);
    expect(back).toEqual([]);
  });
  it("2 dias → 1 em cada", () => {
    const { front, back } = splitFrontBack([0, 1]);
    expect(front).toEqual([0]);
    expect(back).toEqual([1]);
  });
});

describe("buildPlanPrintHtml", () => {
  const colorOf = (name?: string | null) => (name === "Peito" ? "#3b82f6" : "#6B7280");

  it("uniform com peso → Alvo 'reps × pesokg', sem sub-linha", () => {
    const p = program({
      id: "p1",
      name: "Full Split",
      customerId: "c1",
      workouts: [
        workout({
          id: "w1",
          name: "Push",
          daysOfWeek: [1],
          exercises: [ex({ id: "e1", name: "Supino inclinado", group: "Peito", sets: 4, reps: 10, weight: 14 })],
        }),
      ],
    });
    const html = buildPlanPrintHtml({ program: p, customerName: "Miguel Antunes", tenant: { name: "Ginásio Prado" }, colorOf });
    expect(html).toContain("Supino inclinado");
    expect(html).toContain('<span class="num">10</span> <span class="unit">×</span> <span class="num">14</span><span class="unit">kg</span>');
    expect(html).not.toContain('<div class="exsub">');
  });

  it("uniform sem peso → Alvo 'reps × —'", () => {
    const p = program({
      id: "p1", name: "Plano", customerId: "c1",
      workouts: [workout({ id: "w1", name: "Core", dayLabel: "Dia 1", exercises: [ex({ id: "e1", name: "Elevação de pernas suspenso", group: "Abdómen", sets: 3, reps: 12 })] })],
    });
    const html = buildPlanPrintHtml({ program: p, customerName: "Cliente", tenant: {}, colorOf });
    expect(html).toContain('<span class="num">12</span> <span class="unit">×</span> <span class="dash">—</span>');
  });

  it("perSet (sem dropset) → sub-linha 'Série a série', Alvo '—'", () => {
    const p = program({
      id: "p1", name: "Plano", customerId: "c1",
      workouts: [workout({
        id: "w1", name: "Push", daysOfWeek: [1],
        exercises: [ex({
          id: "e1", name: "Elevações laterais", group: "Ombros", sets: 3, reps: 12, mode: "perSet",
          setRows: [
            { reps: 15, weight: 12.5, rest: 60 },
            { reps: 12, weight: 12.5, rest: 60 },
            { reps: 12, weight: 10, rest: 60 },
          ],
        })],
      })],
    });
    const html = buildPlanPrintHtml({ program: p, customerName: "Cliente", tenant: {}, colorOf });
    expect(html).toContain("Série a série:");
    expect(html).toContain("12,5·15 · 12,5·12 · 10·12");
    expect(html).toContain('<td class="col c-alvo"><span class="dash">—</span></td>');
  });

  it("dropset (drop:true + steps) → sub-linha 'Dropset' com cadeia ⭢", () => {
    const p = program({
      id: "p1", name: "Plano", customerId: "c1",
      workouts: [workout({
        id: "w1", name: "Push", daysOfWeek: [1],
        exercises: [ex({
          id: "e1", name: "Tríceps na corda", group: "Tríceps", sets: 3, reps: 12, mode: "perSet",
          setRows: [
            { drop: true, rest: 75, steps: [{ reps: 12, weight: 25 }, { reps: 10, weight: 17.5 }, { reps: 8, weight: 12.5 }] },
          ],
        })],
      })],
    });
    const html = buildPlanPrintHtml({ program: p, customerName: "Cliente", tenant: {}, colorOf });
    expect(html).toContain("Dropset:");
    expect(html).toContain("25·12 ⭢ 17,5·10 ⭢ 12,5·8");
  });

  it("tempo → Alvo em segundos + sub-linha 'Tempo: N × Ds · Rs descanso'", () => {
    const p = program({
      id: "p1", name: "Plano", customerId: "c1",
      workouts: [workout({
        id: "w1", name: "Core", daysOfWeek: [0],
        exercises: [ex({ id: "e1", name: "Prancha isométrica", group: "Abdómen", sets: 3, reps: 0, type: "time", duration: 45, rest: 30 })],
      })],
    });
    const html = buildPlanPrintHtml({ program: p, customerName: "Cliente", tenant: {}, colorOf });
    expect(html).toContain('<span class="num">45</span><span class="unit">s</span>');
    expect(html).toContain('<span class="k">Tempo:</span> 3 × 45s · 30s descanso');
  });

  it("notas do exercício aparecem em itálico (exnote)", () => {
    const p = program({
      id: "p1", name: "Plano", customerId: "c1",
      workouts: [workout({
        id: "w1", name: "Push", daysOfWeek: [1],
        exercises: [ex({ id: "e1", name: "Press militar", group: "Ombros", sets: 4, reps: 8, weight: 30, notes: "Cadência 2-0-1." })],
      })],
    });
    const html = buildPlanPrintHtml({ program: p, customerName: "Cliente", tenant: {}, colorOf });
    expect(html).toContain('<div class="exnote">Cadência 2-0-1.</div>');
  });

  it("sem startDate/endDate → pills Início/Fim omitidas; com datas → aparecem", () => {
    const base = { id: "p1", name: "Plano", customerId: "c1", workouts: [workout({ id: "w1", name: "Push", daysOfWeek: [1], exercises: [] })] };
    const semDatas = buildPlanPrintHtml({ program: program(base), customerName: "Cliente", tenant: {}, colorOf });
    expect(semDatas).not.toContain(">Início ");
    expect(semDatas).not.toContain(">Fim ");

    const comDatas = buildPlanPrintHtml({
      program: program({ ...base, startDate: "2026-07-07", endDate: "2026-09-01" }),
      customerName: "Cliente", tenant: {}, colorOf,
    });
    expect(comDatas).toContain(">Início ");
    expect(comDatas).toContain(">Fim ");
  });

  it("não rebenta sem campos opcionais (mínimo viável)", () => {
    const p = program({
      id: "p1", name: "Plano mínimo", customerId: "c1",
      workouts: [workout({ id: "w1", name: "Dia único", exercises: [ex({ id: "e1", name: "Agachamento", group: "Pernas", sets: 3, reps: 10 })] })],
    });
    expect(() => buildPlanPrintHtml({ program: p, customerName: "Cliente", tenant: {} })).not.toThrow();
  });

  it("gera 2 <article class=\"sheet\"> (frente + verso) sempre", () => {
    const p = program({ id: "p1", name: "Plano", customerId: "c1", workouts: [] });
    const html = buildPlanPrintHtml({ program: p, customerName: "Cliente", tenant: { name: "Ginásio Prado" } });
    const matches = html.match(/<article class="sheet">/g) ?? [];
    expect(matches.length).toBe(2);
    expect(html).toContain("Página 1 de 2 · frente");
    expect(html).toContain("Página 2 de 2 · verso");
  });
});
