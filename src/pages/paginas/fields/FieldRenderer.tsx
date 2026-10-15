/**
 * Desenha UM campo do catálogo (ou de um especial do manifest) a partir da definição que vem da API.
 * Despacha SÓ por tipo de valor — text · md · choice · media · dest · pages · list — nunca por tipo de
 * componente: um formulário novo no catálogo aparece sem tocar aqui. Assinatura `(def, value, onChange, ctx)`.
 */
import type { FieldSpec } from "../state/types";
import { ChoiceField } from "./ChoiceField";
import { DestField } from "./DestField";
import { ListField } from "./ListField";
import { MediaField } from "./MediaField";
import { PagesField } from "./PagesField";
import { TextField } from "./TextField";
import type { FieldChange, FieldCtx } from "./types";

export interface FieldRendererProps {
  def: FieldSpec;
  value: unknown;
  onChange: FieldChange;
  ctx: FieldCtx;
}

export function FieldRenderer({ def, value, onChange, ctx }: FieldRendererProps) {
  switch (def.type) {
    case "text":
    case "md":
      return <TextField def={def} value={value} onChange={onChange} ctx={ctx} />;
    case "choice":
      return <ChoiceField def={def} value={value} onChange={onChange} ctx={ctx} />;
    case "media":
      return <MediaField def={def} value={value} onChange={onChange} ctx={ctx} />;
    case "dest":
      return <DestField def={def} value={value} onChange={onChange} ctx={ctx} />;
    case "pages":
      return <PagesField def={def} value={value} onChange={onChange} ctx={ctx} />;
    case "list":
      return <ListField def={def} value={value} onChange={onChange} ctx={ctx} />;
    default:
      return <p className="text-xs text-zinc-400">Campo «{ctx.name}» de um tipo que este editor ainda não conhece ({def.type}).</p>;
  }
}
