import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { keepPreviousData } from "@tanstack/react-query";
import { Badge, Button, Card, EmptyState, Input, Modal, Select } from "../ui/ui.jsx";
import { GuardButton } from "../components/GuardButton";
import { confirmDialog } from "../components/confirm";
import { MailPager } from "../components/correio/MailThreadList";
import { usePageSubtitle } from "../context/PageMetaContext";
import { useInvalidateMail } from "../hooks/useMail";
import { useGetMailContacts } from "../gen/backoffice/hooks/useGetMailContacts.js";
import { getMailContactsExport } from "../gen/backoffice/hooks/useGetMailContactsExport.js";
import { usePatchMailContactsContactid } from "../gen/backoffice/hooks/usePatchMailContactsContactid.js";
import { usePostMailContactsContactidUnsubscribe } from "../gen/backoffice/hooks/usePostMailContactsContactidUnsubscribe.js";
import { usePostMailContactsImport } from "../gen/backoffice/hooks/usePostMailContactsImport.js";
import type { MailContact } from "../gen/backoffice/types/MailContact.js";
import type { MailContactImportResult } from "../gen/backoffice/types/MailContactImportResult.js";
import {
  CONTACT_SKIP_REASON,
  CONTACT_SOURCE,
  CONTACT_STATUS,
  countCsvRows,
  downloadTextFile,
  mailErrorMessage,
  parseTags,
  type ContactStatus,
} from "../lib/mail";

const PAGE_LIMIT = 25;

const STATUS_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Todos os estados" },
  { value: "subscribed", label: "Subscrito" },
  { value: "unsubscribed", label: "Não subscrito" },
  { value: "unsubscribed_by_user", label: "Anulou" },
  { value: "bounced", label: "Bloqueado — email inválido" },
  { value: "complained", label: "Bloqueado — queixa de spam" },
];

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-PT") : "—");

/** Lê o ficheiro como texto (FileReader: funciona em todos os ambientes, `File.text()` nem sempre). */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

/** Correio → Contactos (B42 · fase 8): quem aceitou receber novidades, de onde veio e quando. Folha `correio.contactos`. */
export function CorreioContactos() {
  const invalidate = useInvalidateMail();
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<MailContact | null>(null);
  const [exporting, setExporting] = useState(false);

  // Pesquisa e etiqueta com atraso curto (cada tecla não pode ser um pedido).
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setTag(tagInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [qInput, tagInput]);
  useEffect(() => setPage(1), [q, tag, status, source]);

  const filters = {
    ...(status ? { status: status as any } : {}),
    ...(source ? { source: source as any } : {}),
    ...(q ? { q } : {}),
    ...(tag ? { tag } : {}),
  };
  const contactsQ = useGetMailContacts(
    { ...filters, page, limit: PAGE_LIMIT },
    { query: { retry: false, placeholderData: keepPreviousData } },
  );
  const items = contactsQ.data?.items ?? [];
  const total = contactsQ.data?.total ?? 0;
  const counts = contactsQ.data?.counts;
  const blocked = (counts?.bounced ?? 0) + (counts?.complained ?? 0);
  const filtered = !!(status || source || q || tag);

  usePageSubtitle(contactsQ.data ? `${counts ? Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) : total} contactos` : null);

  const unsubscribeM = usePostMailContactsContactidUnsubscribe({
    mutation: {
      onSuccess: () => {
        toast.success("Subscrição anulada.");
        invalidate();
      },
      onError: (e: unknown) => toast.error(mailErrorMessage(e)),
    },
  });

  const unsubscribe = async (c: MailContact) => {
    const ok = await confirmDialog({
      title: "Anular a subscrição?",
      message: `${c.email} deixa de receber campanhas. Faz isto quando a pessoa to pede; só ela pode voltar a subscrever.`,
      confirmLabel: "Anular subscrição",
      danger: true,
    });
    if (ok && c.contactId) unsubscribeM.mutate({ contactId: c.contactId });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = await getMailContactsExport(filters);
      const day = new Date().toISOString().slice(0, 10);
      downloadTextFile(`contactos-${day}.csv`, typeof csv === "string" ? csv : String(csv ?? ""));
    } catch (e) {
      toast.error(mailErrorMessage(e, "Não foi possível exportar."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3" data-testid="correio-contactos">
      {/* Contadores */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="contacts-counts">
        {[
          { key: "subscribed", label: "Subscritos", value: counts?.subscribed },
          { key: "unsubscribed", label: "Não subscritos", value: counts?.unsubscribed },
          { key: "unsubscribed_by_user", label: "Anularam", value: counts?.unsubscribed_by_user },
          { key: "blocked", label: "Bloqueados", value: counts ? blocked : undefined },
        ].map((c) => (
          <Card key={c.key} className="px-3 py-2.5" data-testid={`contacts-count-${c.key}`}>
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className="text-lg font-semibold tabular-nums">{c.value ?? "—"}</p>
          </Card>
        ))}
      </div>

      {/* Barra: pesquisa, filtros, acções */}
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[12rem]">
          <Input
            icon="search"
            aria-label="Pesquisar contactos"
            placeholder="Pesquisar por email ou nome"
            value={qInput}
            onChange={(e: any) => setQInput(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="w-full sm:w-52">
          <Select aria-label="Estado" value={status} onChange={(e: any) => setStatus(e.target.value)}>
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-40">
          <Select aria-label="Origem" value={source} onChange={(e: any) => setSource(e.target.value)}>
            <option value="">Todas as origens</option>
            {Object.entries(CONTACT_SOURCE).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-40">
          <Input
            aria-label="Etiqueta"
            placeholder="Etiqueta"
            value={tagInput}
            onChange={(e: any) => setTagInput(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Button variant="outline" icon="arrowDown" isLoading={exporting} disabled={exporting} onClick={exportCsv}>
          Exportar
        </Button>
        <GuardButton icon="upload" onClick={() => setImportOpen(true)}>
          Importar CSV
        </GuardButton>
      </div>

      {/* Lista */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        {contactsQ.isLoading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : contactsQ.isError ? (
          <div className="p-4 space-y-2 text-sm text-red-600 dark:text-red-400">
            <p>{mailErrorMessage(contactsQ.error, "Não foi possível carregar os contactos.")}</p>
            <Button size="sm" variant="outline" onClick={() => contactsQ.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex" data-testid="contacts-empty">
            <EmptyState
              icon="mail"
              title={filtered ? "Nada encontrado" : "Ainda sem contactos"}
              desc={
                filtered
                  ? "Experimenta outros filtros."
                  : "Os contactos aparecem aqui quando um cliente aceita novidades (site, app ou balcão) ou quando importas um CSV."
              }
            />
          </div>
        ) : (
          <>
            <div
              className="hidden md:grid shrink-0 grid-cols-[minmax(0,2fr)_9rem_7rem_6rem_minmax(11rem,auto)] gap-3 border-b border-zinc-100 dark:border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
              aria-hidden="true"
            >
              <span>Contacto</span>
              <span>Estado</span>
              <span>Origem</span>
              <span>Data</span>
              <span />
            </div>
            <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60" aria-label="Contactos">
              {items.map((c) => {
                const st = CONTACT_STATUS[(c.status ?? "unsubscribed") as ContactStatus] ?? CONTACT_STATUS.unsubscribed;
                return (
                  <li
                    key={c.contactId}
                    data-testid="contact-row"
                    className="flex flex-col gap-2 px-3 py-2.5 md:grid md:grid-cols-[minmax(0,2fr)_9rem_7rem_6rem_minmax(11rem,auto)] md:items-center md:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.email}</p>
                      {c.name ? <p className="text-xs text-zinc-500 truncate">{c.name}</p> : null}
                      {(c.tags ?? []).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1" data-testid="contact-tags">
                          {(c.tags ?? []).map((t) => (
                            <Badge key={t} tone="neutral">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div data-testid="contact-status" title={st.hint}>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">{CONTACT_SOURCE[c.source ?? ""] ?? "—"}</span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-300 tabular-nums">
                      {fmtDate(c.status === "subscribed" ? c.subscribedAt : (c.unsubscribedAt ?? c.createdAt))}
                    </span>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <GuardButton size="sm" variant="outline" aria-label={`Etiquetas de ${c.email}`} onClick={() => setEditing(c)}>
                        Etiquetas
                      </GuardButton>
                      {c.status === "subscribed" && (
                        <GuardButton
                          size="sm"
                          variant="outline"
                          aria-label={`Anular subscrição de ${c.email}`}
                          disabled={unsubscribeM.isPending}
                          onClick={() => unsubscribe(c)}
                        >
                          Anular subscrição
                        </GuardButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <MailPager page={page} limit={contactsQ.data?.limit ?? PAGE_LIMIT} total={total} onPage={setPage} />
          </>
        )}
      </div>

      <ContactEditModal contact={editing} onClose={() => setEditing(null)} onSaved={invalidate} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={invalidate} />
    </div>
  );
}

/** Nome, etiquetas e língua de um contacto. O estado de subscrição nunca se muda por aqui (a API não deixa). */
function ContactEditModal({
  contact,
  onClose,
  onSaved,
}: {
  contact: MailContact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [language, setLanguage] = useState("");
  useEffect(() => {
    if (!contact) return;
    setName(contact.name ?? "");
    setTags((contact.tags ?? []).join(", "));
    setLanguage(contact.language ?? "");
  }, [contact]);

  const patchM = usePatchMailContactsContactid({
    mutation: {
      onSuccess: () => {
        toast.success("Contacto guardado.");
        onSaved();
        onClose();
      },
      onError: (e: unknown) => toast.error(mailErrorMessage(e)),
    },
  });

  const save = () => {
    if (!contact?.contactId) return;
    patchM.mutate({
      contactId: contact.contactId,
      data: {
        name: name.trim() || null,
        tags: parseTags(tags),
        ...(language.trim() ? { language: language.trim() } : {}),
      },
    });
  };

  return (
    <Modal
      open={!!contact}
      onClose={onClose}
      title="Etiquetas e dados"
      subtitle={contact?.email}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <GuardButton isLoading={patchM.isPending} disabled={patchM.isPending} onClick={save}>
            Guardar
          </GuardButton>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Nome" value={name} onChange={(e: any) => setName(e.target.value)} autoComplete="off" />
        <Input
          label="Etiquetas"
          value={tags}
          onChange={(e: any) => setTags(e.target.value)}
          hint="Separadas por vírgula (ex.: vip, verão)."
          autoComplete="off"
        />
        <Input
          label="Língua"
          value={language}
          onChange={(e: any) => setLanguage(e.target.value)}
          hint="Código da língua do contacto (ex.: pt, en)."
          autoComplete="off"
        />
      </div>
    </Modal>
  );
}

/**
 * Importar CSV em 3 passos: ficheiro → confirmação de consentimento (obrigatória) → relatório. O botão «Importar» só
 * existe no passo da confirmação e só se activa com a caixa marcada; a API recusa (400) qualquer pedido sem
 * `consentConfirmed: true`.
 */
function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [tags, setTags] = useState("");
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<MailContactImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cada abertura começa do zero (nada de consentimento "herdado" da vez anterior).
  useEffect(() => {
    if (open) {
      setStep(1);
      setCsv("");
      setFileName("");
      setTags("");
      setConsent(false);
      setResult(null);
    }
  }, [open]);

  const importM = usePostMailContactsImport({
    mutation: {
      onSuccess: (res) => {
        setResult(res);
        setStep(3);
        onDone();
      },
      onError: (e: unknown) => toast.error(mailErrorMessage(e, "Não foi possível importar.")),
    },
  });

  const rows = countCsvRows(csv);

  const pickFile = async (file?: File | null) => {
    if (!file) return;
    try {
      setCsv(await readFileText(file));
      setFileName(file.name);
    } catch {
      toast.error("Não foi possível ler o ficheiro.");
    }
  };

  const submit = () => {
    if (!consent) return;
    const t = parseTags(tags);
    importM.mutate({ data: { consentConfirmed: true, csv, ...(t.length ? { tags: t } : {}) } });
  };

  const footer =
    step === 1 ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={rows === 0} onClick={() => setStep(2)}>
          Continuar
        </Button>
      </>
    ) : step === 2 ? (
      <>
        <Button variant="ghost" onClick={() => setStep(1)} disabled={importM.isPending}>
          Voltar
        </Button>
        <GuardButton isLoading={importM.isPending} disabled={!consent || importM.isPending} onClick={submit}>
          Importar
        </GuardButton>
      </>
    ) : (
      <Button onClick={onClose}>Fechar</Button>
    );

  return (
    <Modal open={open} onClose={onClose} title="Importar contactos" subtitle={`Passo ${step} de 3`} width="max-w-xl" footer={footer}>
      {step === 1 && (
        <div className="space-y-4" data-testid="import-step-file">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Um CSV com cabeçalho. Coluna obrigatória: <span className="font-mono text-xs">email</span>. Opcionais:{" "}
            <span className="font-mono text-xs">nome</span>, <span className="font-mono text-xs">etiquetas</span> (separadas
            por <span className="font-mono text-xs">|</span>) e <span className="font-mono text-xs">lingua</span>. Separador
            vírgula ou ponto e vírgula; até 5 000 linhas.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              aria-label="Ficheiro CSV"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <Button variant="outline" icon="upload" onClick={() => fileRef.current?.click()}>
              Escolher ficheiro
            </Button>
            <span className="text-sm text-zinc-500 min-w-0 truncate">{fileName || "Nenhum ficheiro escolhido"}</span>
          </div>
          <label className="block">
            <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Ou cola o conteúdo</span>
            <textarea
              aria-label="Conteúdo do CSV"
              rows={5}
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setFileName("");
              }}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-mono text-zinc-900 dark:text-zinc-100 px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              placeholder={"email,nome\nmaria@exemplo.pt,Maria"}
            />
          </label>
          <Input
            label="Etiquetas a juntar a todos (opcional)"
            value={tags}
            onChange={(e: any) => setTags(e.target.value)}
            hint="Separadas por vírgula."
            autoComplete="off"
          />
          <p className="text-xs text-zinc-500" data-testid="import-rows">
            {rows === 0 ? "Sem linhas de dados." : rows === 1 ? "1 linha de dados." : `${rows} linhas de dados.`}
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4" data-testid="import-step-consent">
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            Vais importar <strong>{rows === 1 ? "1 linha" : `${rows} linhas`}</strong>
            {fileName ? ` de ${fileName}` : ""}. Os novos ficam <strong>Subscritos</strong>, com origem «Importação».
          </p>
          <p className="text-xs text-zinc-500">
            Quem já anulou a subscrição, não está subscrito ou está bloqueado nunca é reactivado: aparece no relatório.
          </p>
          <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>Confirmo que estes contactos deram consentimento para receber email de novidades.</span>
          </label>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-4" data-testid="import-report">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              ["Linhas", result.total],
              ["Novos", result.created],
              ["Actualizados", result.updated],
              ["Recusadas", result.rejected],
            ].map(([l, v]) => (
              <div key={String(l)} className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-2 py-2">
                <p className="text-xs text-zinc-500">{l}</p>
                <p className="text-lg font-semibold tabular-nums">{v ?? 0}</p>
              </div>
            ))}
          </div>
          {(result.skipped ?? []).length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold">Linhas recusadas</h4>
              <div className="max-h-56 overflow-y-auto overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                <table className="w-full text-sm min-w-[22rem]">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">Linha</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {(result.skipped ?? []).map((s, i) => (
                      <tr key={`${s.line}-${i}`} data-testid="import-skipped-row">
                        <td className="px-3 py-2 tabular-nums">{s.line}</td>
                        <td className="px-3 py-2 font-mono text-xs break-all">{s.email || "—"}</td>
                        <td className="px-3 py-2">{CONTACT_SKIP_REASON[s.reason ?? ""] ?? s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
