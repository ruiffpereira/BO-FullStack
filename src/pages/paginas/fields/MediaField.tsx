/**
 * `media`: "A mesma em todas as línguas" (por omissão) ou uma por língua. Upload DIFERIDO: escolher um
 * ficheiro não envia nada — o valor guarda um marcador `blob:` (o `File` fica em `state/pending.ts`) e a
 * linha mostra "Por carregar"; o envio acontece no Guardar. Imagem · vídeo · PDF (`kind: "file"`).
 *
 * Não usa o `FileUpload` partilhado: esse tem uma só pré-visualização com estado próprio (não acompanha
 * o desfazer nem a troca de língua) e recusa tudo o que não é imagem; aqui há uma linha por língua,
 * PDF e vídeo, e o estado vive no valor do campo. O princípio (preview local, envio ao Guardar) é o mesmo.
 */
import { useId, useRef, useState } from "react";
import { Button } from "../../../ui/ui.jsx";
import { Icon } from "../../../ui/icons.jsx";
import { missingLocales } from "../state/missing";
import { isPendingUrl, pendingEntry, registerPending, type MediaKind } from "../state/pending";
import type { FieldSpec } from "../state/types";
import { issuesUnder, localeIssues, normalizeMedia } from "./ctx";
import { fieldLabel } from "./labels";
import { FieldShell, Issues, LangBadge, Side, missCls, warnText } from "./shared";
import type { FieldChange, FieldCtx, MediaValue } from "./types";

interface Props {
  def: FieldSpec;
  value: unknown;
  onChange: FieldChange;
  ctx: FieldCtx;
}

interface KindInfo {
  accept: string;
  types: string[];
  maxBytes: number;
  hint: string;
  same: string;
  none: string;
  noun: string;
}
const MB = 1024 * 1024;
const KINDS: Record<MediaKind, KindInfo> = {
  image: { accept: "image/jpeg,image/png,image/webp", types: ["image/jpeg", "image/png", "image/webp"], maxBytes: 10 * MB, hint: "JPEG, PNG ou WebP", same: "A mesma imagem em todas as línguas", none: "Nenhuma imagem", noun: "imagem" },
  video: { accept: "video/mp4,video/webm,video/quicktime", types: ["video/mp4", "video/webm", "video/quicktime"], maxBytes: 100 * MB, hint: "MP4, WebM ou MOV até 100 MB", same: "O mesmo vídeo em todas as línguas", none: "Nenhum vídeo", noun: "vídeo" },
  file: { accept: "application/pdf", types: ["application/pdf"], maxBytes: 20 * MB, hint: "PDF até 20 MB", same: "O mesmo ficheiro em todas as línguas", none: "Nenhum ficheiro", noun: "PDF" },
};
const kindOf = (def: FieldSpec): MediaKind => (def.kind === "file" || def.kind === "video" ? def.kind : "image");

const baseName = (url: string): string => {
  const last = url.split("?")[0].split("/").pop() || url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

interface SlotProps {
  kind: MediaKind;
  url: string;
  /** Selo da língua (`null` = a mesma em todas). */
  lang: string | null;
  miss: boolean;
  disabled?: boolean;
  label: string;
  /** `path` do campo (o "Ver onde" foca o botão de carregar). */
  path: string;
  onPick: (file: File) => void;
  onClear: () => void;
}

function Slot({ kind, url, lang, miss, disabled, label, path, onPick, onClear }: SlotProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const info = KINDS[kind];
  const pending = isPendingUrl(url);
  const name = pending ? pendingEntry(url)?.file.name ?? "Ficheiro escolhido" : url ? baseName(url) : "";
  const suffix = lang ? ` (${lang.toUpperCase()})` : "";

  const choose = (file: File | undefined) => {
    if (!file) return;
    if (!info.types.includes(file.type)) return setError(`Ficheiro não aceite. ${info.hint}.`);
    if (file.size > info.maxBytes) return setError(`O ficheiro é grande demais. ${info.hint}.`);
    setError(null);
    onPick(file);
  };

  return (
    <div>
      <div className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 ${miss ? missCls : "border-zinc-200 dark:border-zinc-700"}`}>
        {lang ? <LangBadge lang={lang} missing={miss} /> : null}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-[11px] font-bold text-zinc-400 dark:bg-zinc-800">
          {url && kind === "image" ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : kind === "file" ? (
            "PDF"
          ) : (
            <Icon name={kind === "video" ? "play" : "image"} className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1 basis-32">
          <div className="truncate text-sm text-zinc-800 dark:text-zinc-100">
            {name || <span className={miss ? warnText : "text-zinc-400"}>{miss ? "Por traduzir" : info.none}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
            {pending ? <span className={`font-semibold ${warnText}`}>Por carregar</span> : null}
            <span>{info.hint}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon="upload"
            className="min-h-10"
            disabled={disabled}
            data-fp={path}
            data-fl={lang ?? ""}
            aria-label={`${url ? "Trocar" : "Carregar"} ${info.noun}${suffix}`}
            onClick={() => input.current?.click()}
          >
            {url ? "Trocar" : "Carregar"}
          </Button>
          {url ? (
            <button
              type="button"
              aria-label={`Remover ${info.noun}${suffix}`}
              disabled={disabled}
              onClick={onClear}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept={info.accept}
          aria-label={`Ficheiro de ${label}${suffix}`}
          className="hidden"
          onChange={(e) => {
            choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function MediaField({ def, value, onChange, ctx }: Props) {
  const uid = useId();
  const kind = kindOf(def);
  const info = KINDS[kind];
  const label = fieldLabel(ctx.name, def);
  const media: MediaValue = normalizeMedia(value);
  const all = issuesUnder(ctx);
  const missing = missingLocales(media, { type: "media" }, ctx.languages, ctx.base);
  const multi = ctx.languages.length > 1;

  const setUrl = (lang: string, url: string | null) => {
    const values = { ...media.values };
    if (url) values[lang] = url;
    else delete values[lang];
    onChange({ same: media.same, values });
  };
  const pick = (lang: string) => (file: File) => setUrl(lang, registerPending(file, kind));
  // `same:true` guarda só a base (§3.1); `same:false` parte da base e deixa as outras por preencher.
  const toggleSame = (same: boolean) =>
    onChange({ same, values: same ? (media.values[ctx.base] ? { [ctx.base]: media.values[ctx.base] } : {}) : { ...media.values } });

  const labelId = `${uid}-l`;
  return (
    <FieldShell
      label={label}
      labelId={labelId}
      right={
        !multi ? null : media.same ? (
          <Side>Igual em todas as línguas</Side>
        ) : missing.length ? (
          <Side warn>{missing.length} por traduzir</Side>
        ) : (
          <Side>Uma por língua</Side>
        )
      }
      issues={all.filter((i) => !i.locale)}
    >
      <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
        {media.same || !multi ? (
          <Slot
            kind={kind}
            url={media.values[ctx.base] ?? ""}
            lang={null}
            miss={false}
            disabled={ctx.disabled}
            label={label}
            path={ctx.path}
            onPick={pick(ctx.base)}
            onClear={() => setUrl(ctx.base, null)}
          />
        ) : (
          ctx.languages.map((lang) => (
            <div key={lang}>
              <Slot
                kind={kind}
                url={media.values[lang] ?? ""}
                lang={lang}
                miss={missing.includes(lang)}
                disabled={ctx.disabled}
                label={label}
                path={ctx.path}
                onPick={pick(lang)}
                onClear={() => setUrl(lang, null)}
              />
              <Issues list={localeIssues(all, lang)} className="mt-1" />
            </div>
          ))
        )}
      </div>
      {multi ? (
        <label className="mt-1 flex min-h-10 cursor-pointer items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={media.same}
            disabled={ctx.disabled}
            onChange={(e) => toggleSame(e.target.checked)}
          />
          {info.same}
        </label>
      ) : null}
    </FieldShell>
  );
}
