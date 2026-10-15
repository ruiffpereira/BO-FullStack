/**
 * Miniatura de um bloco, gerada dos próprios componentes: a disposição em colunas, a cor do fundo e um
 * traço por componente na sua coluna. Sem imagens nem dependências — só caixas. É decorativa
 * (`aria-hidden`): o nome e o resumo do bloco estão sempre ao lado, em texto.
 *
 * A cor do fundo vem do manifest só como `id`; as cores dos ids habituais (claro/escuro/marca) são
 * reconhecidas e as outras recebem um tom estável pelo id — o que interessa é distinguir fundos.
 */
import type { CSSProperties, ReactNode } from "react";

type Rec = Record<string, unknown>;
export interface ThumbBlock {
  layout?: number | string | null;
  bg?: string | null;
  comps?: unknown[] | null;
}

const TONES = [
  "bg-emerald-100 text-emerald-700/70",
  "bg-amber-100 text-amber-700/70",
  "bg-violet-100 text-violet-700/70",
  "bg-sky-100 text-sky-700/70",
  "bg-rose-100 text-rose-700/70",
];

/** Classes (fundo + cor dos traços) para um id de fundo. */
export function thumbTone(bg: string | null | undefined): string {
  const id = (bg ?? "claro").toLowerCase();
  if (/escur|dark|preto|black|noite/.test(id)) return "bg-zinc-800 text-zinc-300";
  if (/marca|brand|azul|primar|accent/.test(id)) return "bg-accent text-white/80";
  if (/claro|light|branco|white|^$/.test(id)) return "bg-zinc-100 text-zinc-400 dark:bg-zinc-200";
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/** O traço de cada tipo de componente: altura (px do desenho) e largura (%). */
function stroke(type: string): { h: number; w: number; round?: boolean; soft?: boolean } {
  switch (type) {
    case "titulo": return { h: 4, w: 70 };
    case "etiqueta": return { h: 2, w: 24 };
    case "botao": return { h: 5, w: 34, round: true };
    case "imagem": case "galeria": case "video": case "mapa": return { h: 12, w: 100, soft: true };
    case "logotipos": case "redes": case "linguas": return { h: 3, w: 60 };
    case "espaco": return { h: 3, w: 0 };
    default: return { h: 2, w: 100 }; // texto, listas, preços, formulário…
  }
}

function Glyph({ type }: { type: string }) {
  const s = stroke(type);
  if (!s.w) return <i className="block" style={{ height: s.h }} />;
  const style: CSSProperties = { height: s.h, width: `${s.w}%` };
  return <i className={`block shrink-0 bg-current ${s.round ? "rounded-full" : "rounded-[1px]"} ${s.soft ? "opacity-40" : ""}`} style={style} />;
}

const asComps = (list: unknown[] | null | undefined): { type: string; col: string }[] =>
  (Array.isArray(list) ? list : [])
    .filter((c): c is Rec => typeof c === "object" && c !== null)
    .map((c) => ({ type: typeof c.type === "string" ? c.type : "", col: String(c.col ?? "all") }));

export function BlockThumb({ block, big = false, className = "" }: { block: ThumbBlock; big?: boolean; className?: string }) {
  const n = Math.min(3, Math.max(1, Number(block.layout) || 1));
  const comps = asComps(block.comps);
  const stack = (list: typeof comps): ReactNode => list.map((c, i) => <Glyph key={i} type={c.type} />);

  let inner: ReactNode;
  if (comps.length === 0) {
    inner = <i className="block rounded-[1px] bg-current opacity-50" style={{ height: 2, width: "30%" }} />;
  } else if (n === 1) {
    inner = stack(comps);
  } else {
    const full = comps.filter((c) => c.col === "all");
    inner = (
      <>
        {stack(full)}
        <div className="flex min-h-0 flex-1 items-start gap-1.5">
          {Array.from({ length: n }, (_, k) => (
            <div key={k} className="flex min-w-0 flex-1 flex-col gap-[3px]">{stack(comps.filter((c) => c.col === String(k + 1)))}</div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${big ? "h-[72px] w-24" : "h-11 w-14"} shrink-0 overflow-hidden rounded-md border border-zinc-200/80 dark:border-zinc-700/60 ${thumbTone(block.bg)} ${className}`}
    >
      <div className="flex h-full flex-col gap-[3px] p-1.5">{inner}</div>
    </div>
  );
}
