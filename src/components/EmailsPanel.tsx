import { useState, useMemo, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { putCmsEntries } from "../gen/backoffice/hooks/usePutCmsEntries.js";
import { useEmailTemplates, type EmailTemplate } from "../hooks/useEmailTemplates";
import { Icon } from "../ui/icons.jsx";
import { RichTextEditor } from "./RichTextEditor";
import { useAuth } from "../context/AuthContext";

// ─── EmailCard ────────────────────────────────────────────────────────────────

function EmailCard({
  template,
  locales,
  defaultLocale,
  onSaved,
}: {
  template: EmailTemplate;
  locales: string[];
  defaultLocale: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeLocale, setActiveLocale] = useState(locales[0] ?? "pt");

  type LocaleForm = { subject: string; body: string };

  // Línguas sem valor próprio começam pré-preenchidas com a língua default
  // (ou o texto predefinido), para o cliente traduzir em vez de partir do zero.
  const buildInitial = (): Record<string, LocaleForm> => {
    const def = template.localeValues[defaultLocale];
    const fallbackSubject = def?.subject || template.defaultSubject;
    const fallbackBody = def?.body || template.defaultBody;
    const out: Record<string, LocaleForm> = {};
    for (const l of locales) {
      const v = template.localeValues[l];
      const hasOwn = !!(v?.subject || v?.body);
      out[l] = hasOwn
        ? { subject: v.subject ?? "", body: v.body ?? "" }
        : { subject: fallbackSubject, body: fallbackBody };
    }
    return out;
  };

  const [form, setForm] = useState<Record<string, LocaleForm>>(buildInitial);

  // Re-sync when server data refreshes
  useEffect(() => {
    setForm(buildInitial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  const isDirty = useMemo(
    () =>
      locales.some(
        (l) =>
          form[l]?.subject !== (template.localeValues[l]?.subject ?? "") ||
          form[l]?.body !== (template.localeValues[l]?.body ?? ""),
      ),
    [form, template.localeValues, locales],
  );

  const hasCustom = locales.some(
    (l) => template.localeValues[l]?.subject || template.localeValues[l]?.body,
  );

  const qc = useQueryClient();

  const saveMut = useMutation({
    mutationFn: async () => {
      for (const l of locales) {
        await putCmsEntries({
          key: template.subjectKey,
          locale: l,
          value: form[l]?.subject ?? "",
          type: "text",
        } as any);
        await putCmsEntries({
          key: template.bodyKey,
          locale: l,
          value: form[l]?.body ?? "",
          type: "richtext",
        } as any);
      }
    },
    onSuccess: () => {
      toast.success(`"${template.label}" guardado`);
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      onSaved();
    },
    onError: () => toast.error("Erro ao guardar email"),
  });

  const inputCls =
    "w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600";

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      {/* ── Accordion header ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
      >
        <div className="shrink-0 w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Icon name="mail" className="w-4 h-4 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
            {template.label}
          </p>
          {!open && (
            <p className="text-xs text-zinc-400 mt-0.5 truncate">
              {hasCustom
                ? (template.localeValues[locales[0]]?.subject || template.defaultSubject)
                : template.defaultSubject}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasCustom && !open && (
            <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">
              Personalizado
            </span>
          )}
          {locales.length > 1 && !open && (
            <div className="flex gap-1">
              {locales.map((l) => (
                <span
                  key={l}
                  className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                    template.localeValues[l]?.subject || template.localeValues[l]?.body
                      ? "bg-accent/10 text-accent"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {l.toUpperCase()}
                </span>
              ))}
            </div>
          )}
          <Icon
            name="chevronDown"
            className={`w-4 h-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 pt-4 pb-5 space-y-4">
          {/* Language tabs — only when > 1 locale */}
          {locales.length > 1 && (
            <div className="flex gap-1">
              {locales.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setActiveLocale(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeLocale === l
                      ? "bg-accent text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Assunto do email
            </label>
            <input
              type="text"
              value={form[activeLocale]?.subject ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  [activeLocale]: { ...f[activeLocale], subject: e.target.value },
                }))
              }
              placeholder={template.defaultSubject}
              className={inputCls}
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Corpo da mensagem
            </label>
            <RichTextEditor
              key={activeLocale}
              value={form[activeLocale]?.body ?? ""}
              onChange={(html) =>
                setForm((f) => ({
                  ...f,
                  [activeLocale]: { ...f[activeLocale], body: html },
                }))
              }
              placeholder={template.defaultBody}
            />
            <p className="text-xs text-zinc-400 mt-1">
              Se deixares em branco, é usado o texto predefinido.
            </p>
          </div>

          {/* Placeholders — click to insert */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Variáveis disponíveis <span className="font-normal">(clica para copiar)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {template.placeholders.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`{{${p}}}`);
                    toast.success(`{{${p}}} copiado`);
                  }}
                  className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-accent/10 hover:text-accent transition"
                  title={`Inserir {{${p}}} no corpo`}
                >
                  {`{{${p}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  [activeLocale]: { subject: "", body: "" },
                }))
              }
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition underline underline-offset-2"
              title="Remove o texto desta língua — o sistema usa o texto predefinido"
            >
              Repor predefinido
            </button>
            <button
              type="button"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !isDirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-accent text-white transition disabled:opacity-50"
            >
              {saveMut.isPending ? (
                <>
                  <Icon name="loader" className="w-4 h-4 animate-spin" />
                  A guardar…
                </>
              ) : (
                "Guardar"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EmailsPanel ──────────────────────────────────────────────────────────────

export function EmailsPanel() {
  const { hasPermission } = useAuth();
  const { data, isLoading } = useEmailTemplates();
  const locales = data?.locales ?? ["pt"];
  const defaultLocale = data?.defaultLocale ?? locales[0] ?? "pt";
  const templates = (data?.templates ?? []).filter(
    (t) => t.permissions.length === 0 || t.permissions.some((p) => hasPermission(p)),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400">
        <Icon name="loader" className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-2xl">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Templates de email
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Personaliza o assunto e corpo de cada email automático. Usa{" "}
          <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
            {"{{variavel}}"}
          </code>{" "}
          para inserir dados dinâmicos. Se deixares em branco, o sistema usa o texto predefinido.
        </p>
      </div>

      {templates.map((tpl) => (
        <EmailCard
          key={tpl.key}
          template={tpl}
          locales={locales}
          defaultLocale={defaultLocale}
          onSaved={() => {}}
        />
      ))}
    </div>
  );
}
