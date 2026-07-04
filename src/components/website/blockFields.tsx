import { useState } from "react";
import { Input, Toggle, Button, IconButton } from "../../ui/ui.jsx";
import { FileUpload } from "../FileUpload";
import type { FieldSchema, PrimitiveField } from "../../lib/blockCatalog";

/**
 * Editores de campo partilhados pelo formulário rico (`RichBlockForm`) e pelo
 * editor genérico chave/valor (`GenericContentEditor`) do gestor de blocos por
 * página (T24). Tudo opera sobre `block.settings.content[locale]` (objeto
 * simples) — nunca toca em `contentRef` (ligação ao CMS, fora de âmbito).
 */

const inputCls =
  "w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition";

// ── Campo primitivo (texto/url/boolean/lista-em-textarea) ──────────────────────

export function PrimitiveFieldInput({
  field,
  value,
  onChange,
  disabled,
  onPendingFile,
}: {
  field: PrimitiveField;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
  /** Só usado por campos `image`: regista (ou limpa, com `null`) o ficheiro escolhido — o upload real só acontece ao Guardar (upload diferido, evita ficheiros órfãos). */
  onPendingFile?: (file: File | null) => void;
}) {
  if (field.type === "image") {
    return (
      <ImageFieldInput field={field} value={value} onChange={onChange} onPendingFile={onPendingFile} disabled={disabled} />
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
        <Toggle checked={!!value} onChange={(next: boolean) => onChange(next)} disabled={disabled} size="sm" />
        {field.label}
      </label>
    );
  }

  if (field.type === "textareaLines") {
    const asText = Array.isArray(value) ? (value as string[]).join("\n") : "";
    return (
      <label className="block">
        <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          {field.label}
        </span>
        <textarea
          aria-label={field.label}
          value={asText}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? [] : e.target.value.split("\n"))}
          rows={4}
          className={inputCls}
        />
        {field.hint && <span className="block text-xs text-zinc-400 mt-1">{field.hint}</span>}
      </label>
    );
  }

  return (
    <Input
      label={field.label}
      icon={field.type === "url" ? "link" : undefined}
      hint={field.hint}
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      onChange={(e: any) => onChange(e.target.value)}
    />
  );
}

// ── Campo de imagem (upload OU colar URL) ──────────────────────────────────────

/**
 * Campo `image`: uploader (`FileUpload`, módulo "website") em modo **diferido**
 * — o ficheiro escolhido fica só localmente (preview blob:); o upload real só
 * acontece ao Guardar o modal (`BlockContentModal.handleSave`, via
 * `onPendingFile`), para não deixar ficheiros órfãos no storage se o modal for
 * cancelado. Mantém a alternativa de colar um URL manualmente (o valor
 * persistido continua a ser sempre uma string de URL).
 */
function ImageFieldInput({
  field,
  value,
  onChange,
  onPendingFile,
  disabled,
}: {
  field: PrimitiveField;
  value: unknown;
  onChange: (next: unknown) => void;
  onPendingFile?: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [pasteMode, setPasteMode] = useState(false);
  const strValue = typeof value === "string" ? value : "";

  return (
    <div>
      <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
        {field.label}
      </span>
      <FileUpload
        module="website"
        currentUrl={strValue || null}
        deferred
        disabled={disabled}
        onFileSelected={(file) => onPendingFile?.(file)}
        onDeleted={() => {
          onChange("");
          onPendingFile?.(null);
        }}
        label="Carregar imagem"
      />
      {pasteMode ? (
        <Input
          className="mt-2"
          placeholder="https://…/imagem.jpg"
          icon="link"
          value={strValue}
          disabled={disabled}
          onChange={(e: any) => {
            onChange(e.target.value);
            onPendingFile?.(null);
          }}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPasteMode(true)}
          className="mt-1.5 text-xs text-zinc-400 hover:text-accent underline underline-offset-2 disabled:opacity-50"
        >
          ou cola um URL
        </button>
      )}
      {field.hint && <span className="block text-xs text-zinc-400 mt-1">{field.hint}</span>}
    </div>
  );
}

// ── Lista de strings (parágrafos, horários, …) ─────────────────────────────────

export function StringListEditor({
  label,
  value,
  onChange,
  itemLabel = "item",
  disabled,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  itemLabel?: string;
  disabled?: boolean;
}) {
  const rows = value ?? [];

  const setAt = (i: number, v: string) => {
    const next = [...rows];
    next[i] = v;
    onChange(next);
  };
  const removeAt = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const moveAt = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...rows, ""]);

  return (
    <div>
      <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">{label}</span>
      <div className="space-y-2">
        {rows.map((v, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              aria-label={`${label} ${i + 1}`}
              value={v}
              disabled={disabled}
              onChange={(e) => setAt(i, e.target.value)}
              className={`flex-1 ${inputCls}`}
            />
            <IconButton
              icon="arrowUp"
              label={`Mover ${itemLabel} para cima`}
              disabled={disabled || i === 0}
              onClick={() => moveAt(i, -1)}
            />
            <IconButton
              icon="arrowDown"
              label={`Mover ${itemLabel} para baixo`}
              disabled={disabled || i === rows.length - 1}
              onClick={() => moveAt(i, 1)}
            />
            <IconButton
              icon="trash"
              label={`Remover ${itemLabel}`}
              disabled={disabled}
              onClick={() => removeAt(i)}
              className="hover:text-red-500"
            />
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" icon="plus" className="mt-2" disabled={disabled} onClick={add}>
        Adicionar {itemLabel}
      </Button>
    </div>
  );
}

// ── Lista de objetos (itens/imagens/planos, …) ─────────────────────────────────

export function ItemsArrayEditor({
  label,
  value,
  onChange,
  itemFields,
  itemLabel = "item",
  disabled,
  onPendingFile,
}: {
  label: string;
  value: Record<string, unknown>[];
  onChange: (next: Record<string, unknown>[]) => void;
  itemFields: PrimitiveField[];
  itemLabel?: string;
  disabled?: boolean;
  /** Idem `PrimitiveFieldInput.onPendingFile`, mas por item — identifica o item pelo índice + chave do sub-campo. */
  onPendingFile?: (itemIndex: number, subKey: string, file: File | null) => void;
}) {
  const rows = value ?? [];

  const emptyItem = (): Record<string, unknown> =>
    Object.fromEntries(
      itemFields.map((f) => [f.key, f.type === "boolean" ? false : f.type === "textareaLines" ? [] : ""]),
    );

  const setField = (i: number, key: string, v: unknown) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  };
  const removeAt = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const moveAt = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...rows, emptyItem()]);

  return (
    <div>
      <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">{label}</span>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                {itemLabel} {i + 1}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <IconButton
                  icon="arrowUp"
                  label={`Mover ${itemLabel} para cima`}
                  disabled={disabled || i === 0}
                  onClick={() => moveAt(i, -1)}
                />
                <IconButton
                  icon="arrowDown"
                  label={`Mover ${itemLabel} para baixo`}
                  disabled={disabled || i === rows.length - 1}
                  onClick={() => moveAt(i, 1)}
                />
                <IconButton
                  icon="trash"
                  label={`Remover ${itemLabel}`}
                  disabled={disabled}
                  onClick={() => removeAt(i)}
                  className="hover:text-red-500"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {itemFields.map((f) => (
                <div
                  key={f.key}
                  className={f.type === "textareaLines" || f.type === "image" ? "sm:col-span-2" : ""}
                >
                  <PrimitiveFieldInput
                    field={f}
                    value={row[f.key]}
                    onChange={(v) => setField(i, f.key, v)}
                    disabled={disabled}
                    onPendingFile={f.type === "image" ? (file) => onPendingFile?.(i, f.key, file) : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" icon="plus" className="mt-2" disabled={disabled} onClick={add}>
        Adicionar {itemLabel}
      </Button>
    </div>
  );
}

// ── Formulário rico (composição dos campos de um schema) ──────────────────────

export function RichBlockForm({
  fields,
  content,
  onChange,
  disabled,
  onPendingFile,
}: {
  fields: FieldSchema[];
  content: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
  /**
   * Upload diferido dos campos `image` (incl. sub-campos de `items`): recebe o
   * "caminho" do campo (`fieldKey` ou `fieldKey|itemIndex|subKey`) + o
   * ficheiro escolhido (ou `null` para limpar). Quem chama (`BlockContentModal`)
   * é responsável por fazer o upload real ao Guardar.
   */
  onPendingFile?: (path: string, file: File | null) => void;
}) {
  const set = (key: string, v: unknown) => onChange({ ...content, [key]: v });

  return (
    <div className="space-y-4">
      {fields.map((f) => {
        if (f.type === "stringList") {
          return (
            <StringListEditor
              key={f.key}
              label={f.label}
              value={(content[f.key] as string[]) ?? []}
              onChange={(next) => set(f.key, next)}
              itemLabel={f.itemLabel}
              disabled={disabled}
            />
          );
        }
        if (f.type === "items") {
          return (
            <ItemsArrayEditor
              key={f.key}
              label={f.label}
              value={(content[f.key] as Record<string, unknown>[]) ?? []}
              onChange={(next) => set(f.key, next)}
              itemFields={f.itemFields}
              itemLabel={f.itemLabel}
              disabled={disabled}
              onPendingFile={(itemIndex, subKey, file) => onPendingFile?.(`${f.key}|${itemIndex}|${subKey}`, file)}
            />
          );
        }
        return (
          <PrimitiveFieldInput
            key={f.key}
            field={f}
            value={content[f.key]}
            onChange={(v) => set(f.key, v)}
            disabled={disabled}
            onPendingFile={f.type === "image" ? (file) => onPendingFile?.(f.key, file) : undefined}
          />
        );
      })}
    </div>
  );
}

// ── Editor genérico chave/valor (tipos funcionais + qualquer tipo desconhecido) ─

interface KVRow {
  id: string;
  key: string;
  raw: string;
  /** Valores objeto/array editam-se como JSON num textarea. */
  isJson: boolean;
  jsonError?: string;
}

function toRows(content: Record<string, unknown>): KVRow[] {
  return Object.entries(content).map(([key, value], i) => {
    const isJson = typeof value === "object" && value !== null;
    return {
      id: `row-${i}-${key}`,
      key,
      raw: isJson ? JSON.stringify(value, null, 2) : value == null ? "" : String(value),
      isJson,
    };
  });
}

function rowsToContent(rows: KVRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    if (r.isJson) {
      try {
        out[k] = JSON.parse(r.raw);
      } catch {
        // JSON inválido: preserva o texto em bruto em vez de perder o rascunho.
        out[k] = r.raw;
      }
    } else {
      out[k] = r.raw;
    }
  }
  return out;
}

export function GenericContentEditor({
  initialContent,
  onChange,
  disabled,
}: {
  initialContent: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<KVRow[]>(() => toRows(initialContent));

  const commit = (next: KVRow[]) => {
    setRows(next);
    onChange(rowsToContent(next));
  };

  const setKey = (i: number, key: string) => {
    commit(rows.map((r, idx) => (idx === i ? { ...r, key } : r)));
  };

  const setRaw = (i: number, raw: string) => {
    const next = [...rows];
    const row = { ...next[i], raw };
    if (row.isJson) {
      try {
        JSON.parse(raw);
        row.jsonError = undefined;
      } catch {
        row.jsonError = "JSON inválido — mantido em rascunho, não aplicado.";
      }
    }
    next[i] = row;
    commit(next);
  };

  const removeAt = (i: number) => commit(rows.filter((_, idx) => idx !== i));
  const add = () =>
    commit([...rows, { id: `row-new-${Date.now()}-${rows.length}`, key: "", raw: "", isJson: false }]);

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">
        Editor genérico (chave/valor). Listas ou objetos editam-se como JSON.
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-start gap-1.5">
            <input
              aria-label="Chave"
              value={r.key}
              disabled={disabled}
              onChange={(e) => setKey(i, e.target.value)}
              placeholder="chave"
              className={`w-32 shrink-0 font-mono ${inputCls}`}
            />
            <div className="flex-1 min-w-0">
              {r.isJson ? (
                <textarea
                  aria-label="Valor (JSON)"
                  value={r.raw}
                  disabled={disabled}
                  onChange={(e) => setRaw(i, e.target.value)}
                  rows={3}
                  className={`font-mono text-xs ${inputCls}`}
                />
              ) : (
                <input
                  aria-label="Valor"
                  value={r.raw}
                  disabled={disabled}
                  onChange={(e) => setRaw(i, e.target.value)}
                  className={inputCls}
                />
              )}
              {r.jsonError && <p className="text-xs text-red-500 mt-1">{r.jsonError}</p>}
            </div>
            <IconButton
              icon="trash"
              label="Remover linha"
              disabled={disabled}
              onClick={() => removeAt(i)}
              className="hover:text-red-500"
            />
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" icon="plus" className="mt-2" disabled={disabled} onClick={add}>
        Adicionar linha
      </Button>
    </div>
  );
}
