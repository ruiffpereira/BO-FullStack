/**
 * `dest` ("Leva para"): um `Select` com Páginas · Secções (blocos com âncora) · Documentos e
 * "Outro endereço…" (caixa com validação https/http/mailto/tel). Formas guardadas (§3.1):
 * `{kind:"page",pageId}` · `{kind:"anchor",blockId}` · `{kind:"file",media}` · `{kind:"url",href}`.
 */
import { useId } from "react";
import { Input, Select } from "../../../ui/ui.jsx";
import type { FieldSpec } from "../state/types";
import { isObj, issuesAt, issuesUnder, normalizeMedia } from "./ctx";
import { HREF_HINT, isValidHref } from "./href";
import { fieldLabel } from "./labels";
import { FieldShell } from "./shared";
import type { FieldChange, FieldCtx, FieldDocument } from "./types";

interface Props {
  def: FieldSpec;
  value: unknown;
  onChange: FieldChange;
  ctx: FieldCtx;
}

const URL_KEY = "url";
const OTHER_DOC = "d:?";

/** Que opção do `Select` corresponde ao valor guardado. */
function keyOf(value: unknown, ctx: FieldCtx): string {
  if (!isObj(value)) return "";
  if (value.kind === "page" && typeof value.pageId === "string") return `p:${value.pageId}`;
  if (value.kind === "anchor" && typeof value.blockId === "string") return `a:${value.blockId}`;
  if (value.kind === "url") return URL_KEY;
  if (value.kind === "file") {
    const url = normalizeMedia(value.media).values[ctx.base];
    const doc = ctx.documents.find((d) => d.media.values[ctx.base] === url);
    return doc ? `d:${doc.id}` : OTHER_DOC;
  }
  return "";
}

export function DestField({ def, value, onChange, ctx }: Props) {
  const uid = useId();
  const label = fieldLabel(ctx.name, def);
  const key = keyOf(value, ctx);
  const own = issuesAt(ctx);
  const rest = issuesUnder(ctx).filter((i) => i.path !== ctx.path);
  const href = isObj(value) && value.kind === "url" && typeof value.href === "string" ? value.href : "";
  const hrefBad = key === URL_KEY && href !== "" && !isValidHref(href);

  const pageOpts = ctx.pages;
  const known = (id: string) => pageOpts.some((p) => p.id === id);
  const missingPage = isObj(value) && value.kind === "page" && typeof value.pageId === "string" && !known(value.pageId);
  const missingAnchor = isObj(value) && value.kind === "anchor" && typeof value.blockId === "string" && !ctx.anchors.some((a) => a.blockId === value.blockId);

  const select = (k: string) => {
    if (k === "") return onChange(undefined);
    if (k === URL_KEY) return onChange({ kind: "url", href: "" });
    if (k.startsWith("p:")) return onChange({ kind: "page", pageId: k.slice(2) });
    if (k.startsWith("a:")) return onChange({ kind: "anchor", blockId: k.slice(2) });
    const doc: FieldDocument | undefined = ctx.documents.find((d) => `d:${d.id}` === k);
    if (doc) onChange({ kind: "file", media: { same: doc.media.same, values: { ...doc.media.values } } });
  };

  return (
    <FieldShell label={label} htmlFor={`${uid}-f`} issues={[...own, ...rest]}>
      <Select id={`${uid}-f`} value={key} disabled={ctx.disabled} onChange={(e) => select(e.target.value)} className="min-h-10">
        <option value="">Escolher…</option>
        <optgroup label="Páginas">
          {pageOpts.map((p) => (
            <option key={p.id} value={`p:${p.id}`}>
              Página · {p.title}
              {p.status === "draft" ? " (rascunho)" : ""}
            </option>
          ))}
          {missingPage ? <option value={key}>Página que já não existe</option> : null}
        </optgroup>
        {ctx.anchors.length > 0 || missingAnchor ? (
          <optgroup label="Secções">
            {ctx.anchors.map((a) => (
              <option key={a.blockId} value={`a:${a.blockId}`}>
                Secção · {a.name}
                {a.pageTitle ? ` (${a.pageTitle})` : ""}
              </option>
            ))}
            {missingAnchor ? <option value={key}>Secção que já não existe</option> : null}
          </optgroup>
        ) : null}
        {ctx.documents.length > 0 || key === OTHER_DOC ? (
          <optgroup label="Documentos">
            {ctx.documents.map((d) => (
              <option key={d.id} value={`d:${d.id}`}>
                Documento · {d.name}
              </option>
            ))}
            {key === OTHER_DOC ? <option value={OTHER_DOC}>Documento (ficheiro)</option> : null}
          </optgroup>
        ) : null}
        <option value={URL_KEY}>Outro endereço…</option>
      </Select>
      {key === URL_KEY ? (
        <div className="mt-1.5">
          <Input
            type="text"
            inputMode="url"
            aria-label={`${label}: endereço`}
            aria-invalid={hrefBad || undefined}
            placeholder="https://"
            value={href}
            disabled={ctx.disabled}
            className={`min-h-10 ${hrefBad ? "!border-red-400 dark:!border-red-500/70" : ""}`}
            onChange={(e) => onChange({ kind: "url", href: e.target.value }, ctx.path)}
          />
          {hrefBad ? (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              {HREF_HINT}
            </p>
          ) : null}
        </div>
      ) : null}
    </FieldShell>
  );
}
