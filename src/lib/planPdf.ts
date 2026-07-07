/**
 * "PDF do plano" — ficha de cliente do Ginásio (Ginasio.tsx → ClienteProgresso).
 *
 * Gera um documento A4 horizontal, frente+verso, com o layout aprovado pelo
 * utilizador (maqueta em `.design/`), e imprime-o via CSS de impressão dentro
 * de um `<iframe>` escondido — sem dependências novas (nada de jspdf/react-pdf).
 * O utilizador usa "Guardar como PDF" no diálogo de impressão do browser.
 *
 * Fonte dos dados: o Programa ATIVO do cliente (`GymProgram`, já com
 * `mode`/`setRows`/`subGroup`/`daysOfWeek`/`dayLabel` — o mesmo objeto que o
 * editor de plano em ecrã cheio usa). Não há endpoint novo.
 */
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import type { GymProgram } from "../gen/backoffice/types/GymProgram.js";
import type { GymWorkout } from "../gen/backoffice/types/GymWorkout.js";
import type { GymWorkoutExercise } from "../gen/backoffice/types/GymWorkoutExercise.js";
import type { GymSetRow } from "../gen/backoffice/types/GymSetRow.js";

// ── Tipos públicos ────────────────────────────────────────────────────────

export type PlanPdfTenant = {
  /** Nome de negócio do tenant (`GET /users/me` → `name`) — usado como nome
   * do ginásio E como "Coach" (não há um campo de coach dedicado). */
  name?: string | null;
  logoUrl?: string | null;
};

export type PlanDensity = "normal" | "compacto" | "ultra";

export type BuildPlanPrintHtmlOptions = {
  program: GymProgram;
  customerName: string;
  tenant: PlanPdfTenant;
  /** Cor por grupo muscular (reutiliza `useGymGroups().colorOf` do Ginásio — cores reais do tenant, não a paleta fixa da maqueta). */
  colorOf?: (groupName?: string | null) => string;
  /** Data de "Gerado a" — default: agora. Parametrizável para testes. */
  generatedAt?: Date;
};

// ── Densidade (garantir 2 páginas p/ até 7 dias) ─────────────────────────
//
// Calibrado contra a maqueta aprovada (7 dias, 24 exercícios no total,
// 13 na frente/3 dias + 11 no verso/4 dias) — esse caso cabe exatamente no
// tamanho "compacto" (= a maqueta tal como está, sem escala). Menos
// exercícios no total → "normal" (maior, mais confortável). Mais do que a
// maqueta (planos muito preenchidos) → "ultra" (mais pequeno, ainda legível).
// Estes limiares são uma estimativa heurística (não medição real de altura
// de página) — ver nota no relatório da tarefa.
export function pickDensity(totalExercises: number): PlanDensity {
  if (totalExercises <= 16) return "normal";
  if (totalExercises <= 30) return "compacto";
  return "ultra";
}

const DENSITY_SCALE: Record<PlanDensity, number> = {
  normal: 1.14,
  compacto: 1,
  ultra: 0.84,
};

// ── Divisão frente/verso por dia (nunca corta um dia a meio) ─────────────
//
// A frente tem mais "chrome" (cabeçalho completo + título + meta + legenda),
// o verso é mais magro (barra de continuação) — por isso a frente fica com
// floor(D/2) dias e o verso com o resto (mesma proporção da maqueta: 7 dias
// → 3 na frente / 4 no verso). Com 0-1 dias, tudo fica na frente e o verso
// mostra só as notas do coach (mantém sempre o formato de 2 páginas).
export function splitFrontBack<T>(workouts: T[]): { front: T[]; back: T[] } {
  const total = workouts.length;
  if (total <= 1) return { front: workouts.slice(), back: [] };
  const frontCount = Math.floor(total / 2);
  return { front: workouts.slice(0, frontCount), back: workouts.slice(frontCount) };
}

// ── Helpers de formatação ─────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Número pt-PT (vírgula decimal), sem casas a mais (12.5 → "12,5", 10 → "10"). */
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function fmtDateIso(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return format(new Date(`${iso}T00:00:00`), "d MMM yyyy", { locale: pt });
  } catch {
    return null;
  }
}

const DEFAULT_DOT_COLOR = "#6B7280";
// Paleta da maqueta, usada como fallback só se não houver `colorOf` (cores
// reais do tenant via `useGymGroups().colorOf`, ver Ginasio.tsx).
const MOCKUP_GROUP_COLORS: Record<string, string> = {
  peito: "#3b82f6",
  costas: "#0ea5a4",
  ombros: "#f59e0b",
  triceps: "#8b5cf6",
  tríceps: "#8b5cf6",
  biceps: "#ec4899",
  bíceps: "#ec4899",
  pernas: "#ef4444",
  gluteos: "#f43f77",
  glúteos: "#f43f77",
  abdomen: "#06b6d4",
  abdómen: "#06b6d4",
};
function fallbackColorOf(name?: string | null): string {
  if (!name) return DEFAULT_DOT_COLOR;
  return MOCKUP_GROUP_COLORS[name.trim().toLowerCase()] ?? DEFAULT_DOT_COLOR;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dayLabelFor(workout: GymWorkout): string {
  if (workout.daysOfWeek && workout.daysOfWeek.length > 0) {
    return workout.daysOfWeek.map((d) => WEEKDAY_LABELS[d] ?? "?").join("/");
  }
  return workout.dayLabel || "—";
}

function groupsForWorkout(workout: GymWorkout): string[] {
  if (workout.muscleGroups && workout.muscleGroups.length > 0) {
    return Array.from(new Set(workout.muscleGroups));
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ex of workout.exercises ?? []) {
    if (ex.group && !seen.has(ex.group)) {
      seen.add(ex.group);
      out.push(ex.group);
    }
  }
  return out;
}

function setRowPair(row: { reps?: number; weight?: number }): string {
  const w = row.weight !== undefined && row.weight !== null ? fmtNum(row.weight) : "—";
  const r = row.reps !== undefined && row.reps !== null ? fmtNum(row.reps) : "—";
  return `${w}·${r}`;
}

/** Coluna "Alvo (reps × peso)": uniform → reps×peso (ou reps×— sem peso);
 * time → duração; perSet/dropset → "—" (o detalhe vive na sub-linha). */
function alvoHtml(ex: GymWorkoutExercise): string {
  if (ex.type === "time") {
    return ex.duration !== undefined && ex.duration !== null
      ? `<span class="num">${fmtNum(ex.duration)}</span><span class="unit">s</span>`
      : '<span class="dash">—</span>';
  }
  if (ex.mode === "perSet") {
    return '<span class="dash">—</span>';
  }
  const repsHtml = `<span class="num">${fmtNum(ex.reps)}</span>`;
  if (ex.weight) {
    return `${repsHtml} <span class="unit">×</span> <span class="num">${fmtNum(ex.weight)}</span><span class="unit">kg</span>`;
  }
  return `${repsHtml} <span class="unit">×</span> <span class="dash">—</span>`;
}

/** Sub-linha por baixo do nome: série-a-série, dropset, tempo, ou notas. */
function sublineHtml(ex: GymWorkoutExercise): string {
  const parts: string[] = [];
  if (ex.type === "time") {
    parts.push(
      `<div class="exsub"><span class="k">Tempo:</span> ${fmtNum(ex.sets)} × ${fmtNum(ex.duration)}s · ${fmtNum(ex.rest)}s descanso</div>`,
    );
  } else if (ex.mode === "perSet" && ex.setRows && ex.setRows.length > 0) {
    const rows: GymSetRow[] = ex.setRows;
    const hasDrop = rows.some((r) => r.drop);
    const chain = rows
      .map((r) =>
        r.drop && r.steps && r.steps.length > 0
          ? r.steps.map((s) => setRowPair(s)).join(" ⭢ ")
          : setRowPair(r),
      )
      .join(" · ");
    parts.push(`<div class="exsub"><span class="k">${hasDrop ? "Dropset" : "Série a série"}:</span> ${chain}</div>`);
  }
  if (ex.notes && ex.notes.trim()) {
    parts.push(`<div class="exnote">${esc(ex.notes.trim())}</div>`);
  }
  return parts.join("");
}

function exerciseRowHtml(ex: GymWorkoutExercise, num: number, colorOf: (name?: string | null) => string): string {
  const dot = `<span class="dot" style="background:${colorOf(ex.group)}"></span>`;
  const setsHtml = `<span class="num">${fmtNum(ex.sets)}</span>`;
  const restHtml =
    ex.rest !== undefined && ex.rest !== null
      ? `<span class="num">${fmtNum(ex.rest)}</span><span class="unit">s</span>`
      : '<span class="dash">—</span>';
  return `<tr>
    <td class="c-num">${num}</td>
    <td class="c-ex"><div class="exname">${dot}${esc(ex.name)}</div>${sublineHtml(ex)}</td>
    <td class="col c-sets">${setsHtml}</td>
    <td class="col c-alvo">${alvoHtml(ex)}</td>
    <td class="col c-rest">${restHtml}</td>
    <td class="logcell first"></td><td class="logcell"></td><td class="logcell"></td><td class="logcell"></td><td class="logcell"></td>
  </tr>`;
}

function theadHtml(): string {
  return `<thead><tr>
    <th class="c-num"></th><th class="ex">Exercício</th><th class="col c-sets">Séries</th><th class="col c-alvo">Alvo (reps × peso)</th><th class="col c-rest">Desc.</th>
    <th class="logcol first">Sem 1</th><th class="logcol">Sem 2</th><th class="logcol">Sem 3</th><th class="logcol">Sem 4</th><th class="logcol">Sem 5</th>
  </tr></thead>`;
}

function daySectionHtml(workout: GymWorkout, colorOf: (name?: string | null) => string): string {
  const groups = groupsForWorkout(workout);
  const titleSuffix = groups.length ? ` · ${groups.map((g) => esc(g)).join(", ")}` : "";
  const chips = groups
    .map((g) => `<span class="chip"><span class="dot" style="background:${colorOf(g)}"></span>${esc(g)}</span>`)
    .join("");
  const exercises = (workout.exercises ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const rows = exercises.length
    ? exercises.map((ex, i) => exerciseRowHtml(ex, i + 1, colorOf)).join("")
    : '<tr><td colspan="10" class="nodata">Sem exercícios.</td></tr>';
  return `<section class="day">
    <div class="day-head">
      <div class="left"><span class="daylabel">${esc(dayLabelFor(workout))}</span><h2>${esc(workout.name)}${titleSuffix}</h2></div>
      <div class="chips">${chips}</div>
    </div>
    <table>${theadHtml()}<tbody>${rows}</tbody></table>
  </section>`;
}

function metaPillsHtml(program: GymProgram, totalDays: number, coachName: string): string {
  const pills: string[] = [];
  pills.push(`<span class="pill"><b>${totalDays}</b> dia${totalDays === 1 ? "" : "s"} / semana</span>`);
  const inicio = fmtDateIso(program.startDate);
  const fim = fmtDateIso(program.endDate);
  if (inicio) pills.push(`<span class="pill">Início <b>${esc(inicio)}</b></span>`);
  if (fim) pills.push(`<span class="pill">Fim <b>${esc(fim)}</b></span>`);
  pills.push(`<span class="pill">Coach <b>${esc(coachName)}</b></span>`);
  return pills.join("");
}

// ── Documento completo ────────────────────────────────────────────────────

export function buildPlanPrintHtml(opts: BuildPlanPrintHtmlOptions): string {
  const { program, customerName, tenant } = opts;
  const colorOf = opts.colorOf ?? fallbackColorOf;
  const generatedAt = opts.generatedAt ?? new Date();
  const generatedAtLabel = format(generatedAt, "d MMM yyyy", { locale: pt });
  const gymName = (tenant.name && tenant.name.trim()) || "Ginásio";

  const workouts = (program.workouts ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const totalExercises = workouts.reduce((sum, w) => sum + (w.exercises?.length ?? 0), 0);
  const density = pickDensity(totalExercises);
  const { front, back } = splitFrontBack(workouts);

  const initials = gymName.trim().charAt(0).toUpperCase() || "G";
  const logoInner = tenant.logoUrl
    ? `<img src="${esc(tenant.logoUrl)}" alt="" />`
    : `<span class="logo-initial">${esc(initials)}</span>`;

  const frontDaysHtml = front.length
    ? front.map((w) => daySectionHtml(w, colorOf)).join("")
    : '<p class="nodata">Sem treinos neste plano.</p>';
  const backDaysHtml = back.length
    ? back.map((w) => daySectionHtml(w, colorOf)).join("")
    : '<p class="nodata">Sem mais treinos — bom trabalho!</p>';

  const notesText = program.note && program.note.trim()
    ? esc(program.note.trim())
    : "Dúvidas? Fala com o teu coach pelo chat da app.";

  const frontSheet = `<article class="sheet">
    <header class="mast">
      <div class="brandmark">
        <span class="logo">${logoInner}</span>
        <span><div class="name">${esc(gymName)}</div><div class="sub">Treino personalizado</div></span>
      </div>
      <div class="doc-tag"><div class="eyebrow">Plano de Treino</div><div class="gen">Gerado a ${esc(generatedAtLabel)}</div></div>
    </header>
    <div class="rule"></div>
    <div class="titleblock">
      <div><h1>${esc(program.name)}</h1><div class="client">${esc(customerName)}</div></div>
      <div class="meta">${metaPillsHtml(program, workouts.length, gymName)}</div>
    </div>
    <div class="days">${frontDaysHtml}</div>
    <footer class="foot">
      <div class="legend"><b>Como ler:</b> Séries × Reps × Peso · Descanso (s). &nbsp; <b>Série a série</b> = cada série com o seu peso·reps. &nbsp; <b>Dropset</b> (⭢) = baixar o peso sem descanso. &nbsp; <b>Sem 1–5</b>: escreve o peso que fizeste em cada semana.</div>
      <div class="pg"><div class="brandline">${esc(gymName)}</div>Página 1 de 2 · frente</div>
    </footer>
  </article>`;

  const backSheet = `<article class="sheet">
    <div class="contbar"><div class="l">${esc(program.name)} · <span>${esc(customerName)}</span></div><div class="r">Continuação · ${esc(generatedAtLabel)}</div></div>
    <div class="days">${backDaysHtml}</div>
    <footer class="foot">
      <div class="legend"><b>Notas do coach:</b> ${notesText}</div>
      <div class="pg"><div class="brandline">${esc(gymName)}</div>Página 2 de 2 · verso</div>
    </footer>
  </article>`;

  const title = `Plano de Treino — ${program.name} — ${customerName}`;

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>${buildPlanPdfCss(density)}</style>
</head>
<body class="pdf">
  <div class="wrap">
    ${frontSheet}
    ${backSheet}
  </div>
</body>
</html>`;
}

// ── CSS (layout aprovado — ver `.design/plano-a4.html`) ─────────────────
//
// Idêntico ao da maqueta, com as propriedades que definem a densidade
// vertical (fonte/padding das linhas da tabela e espaçamento entre dias)
// parametrizadas por `--pdf-scale`. `compacto` (=1) é a maqueta tal como
// está; `normal`/`ultra` escalam a partir daí.
function buildPlanPdfCss(density: PlanDensity): string {
  const k = DENSITY_SCALE[density];
  return `
  :root {
    --paper:#fff; --paper-alt:#f7f8f3; --ink:#16191c; --muted:#6f7768; --faint:#9aa08f;
    --hair:#e7e9e2; --hair-strong:#d3d7cb; --brand:#8dc63f; --brand-ink:#4f7a1c;
    --log-tint:#f2f7e6; --pdf-scale:${k};
  }
  *{ box-sizing:border-box; }
  body{ margin:0; background:#fff; color:var(--ink);
    font-family:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap{ display:flex; flex-direction:column; align-items:center; gap:0; }

  /* A4 landscape ≈ 1123×794px @96dpi */
  .sheet{ width:1123px; max-width:100%; min-height:794px; background:var(--paper); color:var(--ink);
    border-radius:0; padding:28px 40px 22px; display:flex; flex-direction:column; }
  .sheet + .sheet{ break-before:page; }

  .mast{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
  .brandmark{ display:flex; align-items:center; gap:11px; }
  .logo{ width:40px; height:40px; border-radius:11px; flex:none; display:flex; align-items:center; justify-content:center; overflow:hidden;
    background:linear-gradient(150deg,var(--brand),var(--brand-ink) 130%); box-shadow:inset 0 1px 0 rgba(255,255,255,.35); }
  .logo img{ width:100%; height:100%; object-fit:cover; }
  .logo-initial{ color:#fff; font-size:17px; font-weight:900; }
  .brandmark .name{ font-size:11.5px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; line-height:1.2; }
  .brandmark .sub{ font-size:10px; font-weight:600; color:var(--faint); letter-spacing:.05em; margin-top:2px; }
  .doc-tag{ text-align:right; }
  .doc-tag .eyebrow{ font-size:10px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:var(--brand-ink); }
  .doc-tag .gen{ font-size:10px; color:var(--faint); margin-top:3px; }
  .rule{ height:3px; background:var(--brand); border-radius:2px; margin-top:12px; }

  .titleblock{ margin-top:12px; display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; }
  .titleblock h1{ margin:0; font-size:22px; font-weight:900; letter-spacing:-.02em; line-height:1.05; }
  .titleblock .client{ margin-top:4px; font-size:13.5px; font-weight:700; color:var(--brand-ink); }
  .meta{ display:flex; flex-wrap:wrap; gap:7px; }
  .pill{ font-size:10.5px; font-weight:700; color:var(--muted); background:var(--paper-alt); border:1px solid var(--hair);
    padding:4px 9px; border-radius:999px; display:inline-flex; align-items:center; gap:5px; }
  .pill b{ color:var(--ink); font-weight:800; }

  .days{ margin-top:14px; display:flex; flex-direction:column; gap:calc(11px * var(--pdf-scale)); }
  .day{ break-inside:avoid; }
  .day-head{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:calc(4px * var(--pdf-scale)); }
  .day-head .left{ display:flex; align-items:baseline; gap:9px; min-width:0; }
  .daylabel{ font-size:9.5px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:#fff; background:var(--ink); padding:3px 7px; border-radius:5px; flex:none; }
  .day-head h2{ margin:0; font-size:calc(14px * var(--pdf-scale)); font-weight:800; letter-spacing:-.01em; }
  .chips{ display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }
  .chip{ font-size:calc(9.5px * var(--pdf-scale)); font-weight:700; color:var(--muted); display:inline-flex; align-items:center; gap:4px; }
  .dot{ width:7px; height:7px; border-radius:50%; flex:none; }

  table{ width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; table-layout:fixed; }
  thead th{ font-size:calc(9px * var(--pdf-scale)); font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--faint);
    text-align:right; padding:0 6px calc(4px * var(--pdf-scale)); border-bottom:1.5px solid var(--hair-strong); }
  thead th.ex{ text-align:left; padding-left:0; }
  thead th.logcol{ text-align:center; color:var(--brand-ink); font-size:calc(8.5px * var(--pdf-scale)); }
  thead th.logcol.first{ border-left:2px solid var(--hair-strong); }
  tbody td{ padding:calc(4px * var(--pdf-scale)) calc(6px * var(--pdf-scale)); border-bottom:1px solid var(--hair); vertical-align:top; }
  tbody tr:last-child td{ border-bottom:none; }
  .c-num{ width:20px; color:var(--faint); font-size:calc(10.5px * var(--pdf-scale)); font-weight:700; text-align:left; padding-left:0; padding-top:5px; }
  .c-ex{ text-align:left; padding-left:0; }
  .exname{ font-size:calc(11.5px * var(--pdf-scale)); font-weight:700; display:flex; align-items:center; gap:6px; line-height:1.2; }
  .exname .dot{ width:7px; height:7px; }
  .exsub{ font-size:calc(9.5px * var(--pdf-scale)); color:var(--muted); margin-top:1px; line-height:1.3; }
  .exsub .k{ color:var(--brand-ink); font-weight:800; }
  .exnote{ font-size:calc(9px * var(--pdf-scale)); color:var(--faint); font-style:italic; margin-top:1px; }
  .nodata{ font-size:12px; color:var(--faint); padding:10px 0; }
  .col{ text-align:right; white-space:nowrap; }
  .c-sets{ width:38px; } .c-alvo{ width:92px; } .c-rest{ width:44px; }
  .num{ font-size:calc(11.5px * var(--pdf-scale)); font-weight:800; } .unit{ font-size:calc(9px * var(--pdf-scale)); color:var(--faint); font-weight:600; }
  .dash{ color:var(--hair-strong); font-weight:700; }
  .logcell{ width:84px; background:var(--log-tint); border-left:1px solid #e4ecd4; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .logcell.first{ border-left:2px solid var(--hair-strong); }

  .foot{ margin-top:auto; padding-top:11px; display:flex; align-items:flex-end; justify-content:space-between; gap:12px; }
  .foot .legend{ font-size:9px; color:var(--faint); line-height:1.55; max-width:74%; }
  .foot .legend b{ color:var(--muted); }
  .foot .pg{ font-size:9.5px; color:var(--faint); font-weight:700; text-align:right; }
  .foot .pg .brandline{ color:var(--brand-ink); font-weight:800; }

  .contbar{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding-bottom:8px; border-bottom:2px solid var(--hair-strong); }
  .contbar .l{ font-size:12.5px; font-weight:800; } .contbar .l span{ color:var(--brand-ink); }
  .contbar .r{ font-size:10px; color:var(--faint); font-weight:700; }

  @page{ size:A4 landscape; margin:9mm; }
  @media print{
    body{ background:#fff; }
    .sheet{ width:auto; max-width:none; min-height:auto; padding:0; }
    .day{ break-inside:avoid; }
  }
  `;
}

// ── Impressão via iframe escondido ────────────────────────────────────────

/**
 * Escreve o HTML num `<iframe>` fora do ecrã e chama `print()` — evita
 * popup-blockers (nenhuma nova janela/aba) e não sofre com o CSS da app
 * (documento 100% self-contained). O iframe é removido depois de imprimir.
 */
export function printPlan(html: string): void {
  if (typeof document === "undefined") return;
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    cleanup();
    return;
  }

  const triggerPrint = () => {
    try {
      win.focus();
      win.addEventListener("afterprint", cleanup);
      win.print();
    } finally {
      // Fallback: alguns browsers/OS não disparam `afterprint` de forma
      // fiável (ex.: alguns fluxos de "Guardar como PDF") — garante que o
      // iframe não fica pendurado para sempre.
      window.setTimeout(cleanup, 60000);
    }
  };

  // Espera o load do documento (fontes/logo) antes de abrir o diálogo.
  window.setTimeout(triggerPrint, 150);
}
