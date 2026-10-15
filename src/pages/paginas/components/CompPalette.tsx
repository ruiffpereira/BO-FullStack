/**
 * Paleta de componentes (F14), com dois separadores:
 *  - **Componente novo** — os do catálogo, em grupos; no Topo/Rodapé só os que a parte aceita.
 *    Nasce com o 1.º estilo do manifest e os valores por omissão do catálogo (o título nasce H2).
 *  - **Copiar um que já existe** — todos os componentes de todos os blocos e partes, com pesquisa.
 *    Fica uma cópia com ids novos (nos componentes e nos itens de listas).
 * Reutiliza o cartão e as notas da paleta de blocos. Tudo passa por `apply(op)`.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input, Modal, Tabs } from "../../../ui/ui.jsx";
import { useBuilder } from "../state/store";
import { allowedTypes, buildAddComp, buildCopyComp, compHolders, compSummary } from "../state/blocks";
import type { Comp, Holder } from "../state/ops";
import type { CatalogComponent, Manifest } from "../state/types";
import { BlockThumb } from "./BlockThumb";
import { Card, Head, Note } from "./BlockPalette";

/** Só texto de interface: como agrupar os componentes do núcleo. O que não estiver aqui vai para "Outros". */
const GROUPS: [string, string[]][] = [
  ["Texto e botões", ["titulo", "etiqueta", "texto", "botao", "lista", "numeros"]],
  ["Imagens e ficheiros", ["imagem", "galeria", "video", "logotipos", "documentos", "mapa"]],
  ["Secções prontas", ["iconetexto", "precos", "citacoes", "paginas", "formulario", "contacto", "menu", "redes", "linguas", "espaco"]],
  ["Para o Google (SEO)", ["faq", "negocio", "avaliacoes"]],
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const styleLabel = (m: Manifest | null, c: Comp) => m?.styles?.[c.type]?.find((s) => s.id === c.style)?.label;
const one = (type: string) => ({ layout: 1, bg: "claro", comps: [{ type, col: "all" }] });

interface Props {
  holder: Holder;
  /** Nome do bloco/parte (para o título). */
  name: string;
  /** Posição onde entra. */
  at: number;
  onClose: () => void;
  onPicked: (compId: string) => void;
}

export function CompPalette({ holder, name, at, onClose, onPicked }: Props) {
  const { state, catalog, manifest, lang, apply } = useBuilder();
  const part = holder.kind === "part" ? holder.id : null;
  const allowed = allowedTypes(part, catalog, manifest);
  const [tab, setTab] = useState<"new" | "copy">("new");
  const [query, setQuery] = useState("");

  const defs = useMemo(() => (catalog?.components ?? []).filter((c) => !allowed || allowed.includes(c.type)), [catalog, allowed]);
  const groups = useMemo((): [string, CatalogComponent[]][] => {
    if (part) return [[part === "topo" ? "Para o topo" : "Para o rodapé", defs]];
    const known = new Set(GROUPS.flatMap(([, t]) => t));
    const out = GROUPS.map(([g, types]): [string, CatalogComponent[]] => [g, types.map((t) => defs.find((d) => d.type === t)).filter((d): d is CatalogComponent => !!d)]);
    out.push(["Outros", defs.filter((d) => !known.has(d.type))]);
    return out.filter(([, list]) => list.length > 0);
  }, [defs, part]);

  const labelOf = (type: string) => catalog?.components.find((c) => c.type === type)?.label ?? type;
  const q = fold(query.trim());
  const holders = useMemo(() => compHolders(state.work), [state.work]);

  const done = (op: { comp: Comp } | null, message: string) => {
    if (!op) return;
    apply(op as never);
    toast.success(message);
    onPicked(op.comp.id);
    onClose();
  };

  let body;
  if (tab === "new") {
    body = groups.map(([g, list]) => (
      <div key={g} className="contents">
        <Head title={g} />
        {list.map((d) => {
          const n = manifest?.styles?.[d.type]?.length ?? 0;
          return (
            <Card
              key={d.type}
              thumb={<BlockThumb block={one(d.type)} />}
              title={d.label}
              sub={n > 1 ? `${n} estilos` : "Sem estilos para escolher"}
              onClick={() => done(buildAddComp(holder, at, d.type, catalog, manifest), `«${d.label}» juntado.`)}
            />
          );
        })}
      </div>
    ));
  } else {
    const shown = holders
      .map((h) => ({
        ...h,
        comps: h.comps.filter((c) => {
          if (allowed && !allowed.includes(c.type)) return false;
          if (!q) return true;
          return [h.name, labelOf(c.type), compSummary(c, catalog, lang.defaultLanguage)].some((t) => fold(t).includes(q));
        }),
      }))
      .filter((h) => h.comps.length > 0);
    body = shown.length ? (
      shown.map((h) => (
        <div key={h.key} className="contents">
          <Head title={h.name} />
          {h.comps.map((c) => (
            <Card
              key={c.id}
              thumb={<BlockThumb block={{ layout: 1, bg: h.bg, comps: [{ type: c.type, col: "all" }] }} />}
              title={`${labelOf(c.type)}${styleLabel(manifest, c) ? ` · ${styleLabel(manifest, c)}` : ""}`}
              sub={compSummary(c, catalog, lang.defaultLanguage) || "Por preencher"}
              onClick={() => done(buildCopyComp(holder, at, c, catalog, manifest), "Cópia juntada. Mudar uma não muda a outra.")}
            />
          ))}
        </div>
      ))
    ) : (
      <Note>Nenhum componente encontrado.</Note>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      title={`Adicionar a «${name}»`}
      subtitle={part ? `Só aparece o que faz sentido ${part === "topo" ? "no topo" : "no rodapé"}.` : "Cada componente vem com os estilos que já existem no site."}
    >
      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "new", label: "Componente novo" },
            { id: "copy", label: "Copiar um que já existe" },
          ]}
          value={tab}
          onChange={(id: string) => { setTab(id as "new" | "copy"); setQuery(""); }}
        />
      </div>
      {tab === "copy" && (
        <div className="mb-3">
          <Input icon="search" aria-label="Procurar componente" placeholder="Procurar por bloco ou por texto" value={query} onChange={(e: { target: { value: string } }) => setQuery(e.target.value)} className="min-h-10" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{body}</div>
    </Modal>
  );
}
