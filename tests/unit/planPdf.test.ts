import { describe, it, expect } from "vitest";
import { buildPlanPrintHtml, pickDensity, paginateWorkouts } from "../../src/lib/planPdf";
import type { GymProgram } from "../../src/gen/backoffice/types/GymProgram";
import type { GymWorkout } from "../../src/gen/backoffice/types/GymWorkout";
import type { GymWorkoutExercise } from "../../src/gen/backoffice/types/GymWorkoutExercise";

function ex(partial: Partial<GymWorkoutExercise> & Pick<GymWorkoutExercise, "id" | "name" | "group" | "sets" | "reps">): GymWorkoutExercise {
  return { rest: 60, ...partial };
}

function workout(partial: Partial<GymWorkout> & Pick<GymWorkout, "id" | "name" | "exercises">): GymWorkout {
  return { ...partial };
}

/** Gera N exercícios triviais (só para testar contagem/paginação, não conteúdo). */
function nExercises(n: number, prefix: string): GymWorkoutExercise[] {
  return Array.from({ length: n }, (_, i) => ex({ id: `${prefix}${i}`, name: `Exercício ${prefix}${i}`, group: "Peito", sets: 3, reps: 10 }));
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

describe("paginateWorkouts", () => {
  it("0 dias → 1 página, vazia", () => {
    const pages = paginateWorkouts([], "compacto");
    expect(pages).toEqual([[]]);
  });

  it("1 dia → 1 página só, com esse dia", () => {
    const w = workout({ id: "w1", name: "Push", exercises: nExercises(3, "a") });
    const pages = paginateWorkouts([w], "compacto");
    expect(pages).toEqual([[w]]);
  });

  it("plano pequeno (3 dias, poucos exercícios) → cabe tudo numa página", () => {
    const days = [0, 1, 2].map((i) =>
      workout({ id: `w${i}`, name: `Dia ${i}`, exercises: nExercises(2, `d${i}-`) }),
    );
    // custo total = 3 × (2 + 1.6) = 10.8, bem abaixo da capacidade "compacto" (17.6)
    const pages = paginateWorkouts(days, "compacto");
    expect(pages.length).toBe(1);
    expect(pages[0]).toEqual(days);
  });

  it("plano grande (7 dias cheios) → 2 páginas, a 1.ª cheia até à capacidade, dias inteiros", () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      workout({ id: `w${i}`, name: `Dia ${i}`, exercises: nExercises(4, `d${i}-`) }),
    );
    // custo por dia = 4 + 1.6 = 5.6; capacidade "compacto" = 17.6
    // página 1: 3 dias (16.8 ≤ 17.6); um 4.º dia estouraria (22.4 > 17.6)
    const pages = paginateWorkouts(days, "compacto");
    expect(pages.length).toBe(2);
    expect(pages[0]).toEqual(days.slice(0, 3));
    expect(pages[1]).toEqual(days.slice(3));
    // nenhum dia repartido: a concatenação das páginas reconstrói o plano inteiro, na ordem
    expect(pages.flat()).toEqual(days);
    const totalEx = pages.flat().reduce((sum, w) => sum + w.exercises.length, 0);
    expect(totalEx).toBe(28);
  });

  it("nunca balanceia metade/metade — enche a página 1 até à capacidade, mesmo com dias muito desiguais", () => {
    const big = workout({ id: "big", name: "Dia grande", exercises: nExercises(14, "big-") });
    const smalls = Array.from({ length: 6 }, (_, i) =>
      workout({ id: `s${i}`, name: `Dia ${i}`, exercises: nExercises(1, `s${i}-`) }),
    );
    const days = [big, ...smalls];
    // custo: big = 14+1.6 = 15.6; cada small = 1+1.6 = 2.6; capacidade "compacto" = 17.6.
    // pág.1: o dia grande sozinho (15.6) já ocupa quase tudo — o 1.º small levaria a
    // 18.2 > 17.6, por isso transborda logo a partir do 1.º small.
    const pages = paginateWorkouts(days, "compacto");
    expect(pages.length).toBe(2);
    // NÃO é floor(7/2)=3 na frente / 4 no verso (comportamento antigo, por CONTAGEM de
    // dias) — aqui só 1 dia cabe na frente e os 6 pequenos transbordam inteiros.
    expect(pages[0]).toEqual([big]);
    expect(pages[1]).toEqual(smalls);
    expect(pages.flat()).toEqual(days);
  });

  it("cada dia entra inteiro mesmo que sozinho exceda a capacidade (nunca corta/perde conteúdo)", () => {
    const huge = workout({ id: "huge", name: "Dia enorme", exercises: nExercises(50, "h-") });
    const other = workout({ id: "o1", name: "Dia 2", exercises: nExercises(1, "o-") });
    const pages = paginateWorkouts([huge, other], "compacto");
    // huge sozinho já excede a capacidade — mesmo assim entra completo na página 1,
    // e o resto transborda para a página 2 (nunca é cortado nem descartado)
    expect(pages[0]).toEqual([huge]);
    expect(pages[1]).toEqual([other]);
  });
});

describe("buildPlanPrintHtml — paginação", () => {
  it("plano pequeno (2 dias, poucos exercícios) → 1 única <article class=\"sheet\">, 'Página 1 de 1'", () => {
    const p = program({
      id: "p1", name: "Plano Curto", customerId: "c1",
      workouts: [
        workout({ id: "w0", name: "Dia A", daysOfWeek: [1], exercises: nExercises(3, "a-") }),
        workout({ id: "w1", name: "Dia B", daysOfWeek: [3], exercises: nExercises(3, "b-") }),
      ],
    });
    const html = buildPlanPrintHtml({ program: p, customerName: "Cliente", tenant: { name: "Ginásio Prado" } });
    const matches = html.match(/<article class="sheet">/g) ?? [];
    expect(matches.length).toBe(1);
    expect(html).toContain("Página 1 de 1");
    expect(html).not.toContain("verso");
    expect(html).not.toContain("Página 1 de 2");
  });

  it("plano sem dias → 1 única página com placeholder (nunca força um verso vazio)", () => {
    const p = program({ id: "p1", name: "Plano", customerId: "c1", workouts: [] });
    const html = buildPlanPrintHtml({ program: p, customerName: "Cliente", tenant: { name: "Ginásio Prado" } });
    const matches = html.match(/<article class="sheet">/g) ?? [];
    expect(matches.length).toBe(1);
    expect(html).toContain("Sem treinos neste plano.");
    expect(html).toContain("Página 1 de 1");
  });

  it("plano grande (7 dias cheios) → 2 páginas, a 1.ª cheia, cada dia inteiro numa só página", () => {
    const p = program({
      id: "p1", name: "Plano Cheio", customerId: "c1",
      workouts: Array.from({ length: 7 }, (_, i) =>
        workout({ id: `w${i}`, name: `Dia ${i}`, daysOfWeek: [i], exercises: nExercises(4, `d${i}-`) }),
      ),
    });
    const html = buildPlanPrintHtml({ program: p, customerName: "Cliente", tenant: { name: "Ginásio Prado" } });
    const matches = html.match(/<article class="sheet">/g) ?? [];
    expect(matches.length).toBe(2);
    expect(html).toContain("Página 1 de 2 · frente");
    expect(html).toContain("Página 2 de 2 · verso");
    // os 7 dias aparecem todos, cada um uma única vez (nenhum repartido/duplicado) —
    // `<h2>Dia N` é o início do título de secção do dia (nome do treino), único por dia.
    for (let i = 0; i < 7; i++) {
      const count = (html.match(new RegExp(`<h2>Dia ${i}(?:\\D|$)`, "g")) ?? []).length;
      expect(count).toBe(1);
    }
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
});
