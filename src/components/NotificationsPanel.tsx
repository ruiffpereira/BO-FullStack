import { useState, useMemo, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { putCmsEntries } from "../gen/backoffice/hooks/usePutCmsEntries.js";
import {
  useNotificationTemplates,
  type NotificationTemplate,
} from "../hooks/useNotificationTemplates";
import { Icon } from "../ui/icons.jsx";
import { useAuth } from "../context/AuthContext";

// ─── NotifCard ──────────────────────────────────────────────────────────────

function NotifCard({
  template,
  locales,
  defaultLocale,
}: {
  template: NotificationTemplate;
  locales: string[];
  defaultLocale: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeLocale, setActiveLocale] = useState(locales[0] ?? "pt");

  type LocaleForm = { title: string; body: string };

  // Línguas sem valor próprio começam pré-preenchidas com a default (ou o texto
  // predefinido) para o cliente traduzir em vez de partir do zero.
  const buildInitial = (): Record<string, LocaleForm> => {
    const def = template.localeValues[defaultLocale];
    const fallbackTitle = def?.title || template.defaultTitle;
    const fallbackBody = def?.body || template.defaultBody;
    const out: Record<string, LocaleForm> = {};
    for (const l of locales) {
      const v = template.localeValues[l];
      const hasOwn = !!(v?.title || v?.body);
      out[l] = hasOwn
        ? { title: v.title ?? "", body: v.body ?? "" }
        : { title: fallbackTitle, body: fallbackBody };
    }
    return out;
  };

  const [form, setForm] = useState<Record<string, LocaleForm>>(buildInitial);

  useEffect(() => {
    setForm(buildInitial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  const isDirty = useMemo(
    () =>
      locales.some(
        (l) =>
          form[l]?.title !== (template.localeValues[l]?.title ?? "") ||
          form[l]?.body !== (template.localeValues[l]?.body ?? ""),
      ),
    [form, template.localeValues, locales],
  );

  const hasCustom = locales.some(
    (l) => template.localeValues[l]?.title || template.localeValues[l]?.body,
  );

  const qc = useQueryClient();

  const saveMut = useMutation({
    mutationFn: async () => {
      for (const l of locales) {
        await putCmsEntries({
          key: template.titleKey,
          locale: l,
          value: form[l]?.title ?? "",
          type: "text",
        } as any);
        await putCmsEntries({
          key: template.bodyKey,
          locale: l,
          value: form[l]?.body ?? "",
          type: "text",
        } as any);
      }
    },
    onSuccess: () => {
      toast.success(`"${template.label}" guardado`);
      qc.invalidateQueries({ queryKey: ["notification-templates"] });
    },
    onError: () => toast.error("Erro ao guardar notificação"),
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
          <Icon name="bell" className="w-4 h-4 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
            {template.label}
          </p>
          {!open && (
            <p className="text-xs text-zinc-400 mt-0.5 truncate">
              {hasCustom
                ? template.localeValues[locales[0]]?.title || template.defaultTitle
                : template.defaultTitle}
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
                    template.localeValues[l]?.title || template.localeValues[l]?.body
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

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Título da notificação
            </label>
            <input
              type="text"
              value={form[activeLocale]?.title ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  [activeLocale]: { ...f[activeLocale], title: e.target.value },
                }))
              }
              placeholder={template.defaultTitle}
              className={inputCls}
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Mensagem (1 linha)
            </label>
            <textarea
              rows={2}
              value={form[activeLocale]?.body ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  [activeLocale]: { ...f[activeLocale], body: e.target.value },
                }))
              }
              placeholder={template.defaultBody}
              className={inputCls}
            />
            <p className="text-xs text-zinc-400 mt-1">
              Se deixares em branco, é usado o texto predefinido.
            </p>
          </div>

          {/* Placeholders — click to copy */}
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
                  title={`Inserir {{${p}}} na mensagem`}
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
                  [activeLocale]: { title: "", body: "" },
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

// ─── NotificationsPanel ───────────────────────────────────────────────────────

export function NotificationsPanel() {
  const { hasPermission } = useAuth();
  const { data, isLoading } = useNotificationTemplates();
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
          Notificações ao cliente
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Personaliza o título e a mensagem das notificações enviadas aos clientes
          (app + push). Usa{" "}
          <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
            {"{{variavel}}"}
          </code>{" "}
          para inserir dados dinâmicos. Se deixares em branco, é usado o texto predefinido.
        </p>
      </div>

      {templates.map((tpl) => (
        <NotifCard
          key={tpl.key}
          template={tpl}
          locales={locales}
          defaultLocale={defaultLocale}
        />
      ))}
    </div>
  );
}
