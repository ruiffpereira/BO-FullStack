import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData } from "@tanstack/react-query";
import { Button, EmptyState, Input, Select, Tabs } from "../ui/ui.jsx";
import { CountBadge } from "../components/NavBadge";
import { GuardButton } from "../components/GuardButton";
import { usePageSubtitle } from "../context/PageMetaContext";
import { useGetMailMailboxes } from "../gen/backoffice/hooks/useGetMailMailboxes.js";
import { useGetMailMailboxesMailboxidThreads } from "../gen/backoffice/hooks/useGetMailMailboxesMailboxidThreads.js";
import { MailThreadRow, MailPager } from "../components/correio/MailThreadList";
import { MailThreadView } from "../components/correio/MailThreadView";
import { MailComposer } from "../components/correio/MailComposer";
import { MailAppPasswordModal } from "../components/correio/MailAppPasswordModal";
import { isMailFolder, isMailNotConfigured, MAIL_FOLDERS, mailErrorMessage, mailLeaf, mailboxLabel, type MailFolder } from "../lib/mail";

const PAGE_LIMIT = 25;

/** Estado «Por configurar»: o servidor de correio ainda não está ligado (sem `STALWART_*`). */
function NotConfigured() {
  return (
    <div data-testid="mail-not-configured" className="flex-1 flex">
      <EmptyState
        icon="mail"
        title="Por configurar"
        desc="O correio ainda não está configurado neste servidor. Quando estiver, as tuas caixas aparecem aqui."
      />
    </div>
  );
}

/**
 * Correio → Caixa (B42, fases 5 e 6, B55). Lista de conversas por pasta (Por ler · Todas · Arquivo · Enviados) com
 * pesquisa, selector de caixa quando há mais do que uma («Pessoal · …» primeiro e «Suporte · …» depois) e a conversa ao lado. Abaixo de
 * `lg` é um ecrã de cada vez (lista → conversa, com «Voltar»). A página enche o que o Shell dá (`fillPage`) por flex.
 * Selecção no URL (`?caixa=&pasta=&conversa=`): é o deep-link do sino e da ficha do cliente.
 */
export function Correio() {
  const [params, setParams] = useSearchParams();
  const mailboxesQ = useGetMailMailboxes({ query: { retry: false } });
  const mailboxes = mailboxesQ.data?.mailboxes ?? [];

  const caixaParam = params.get("caixa");
  const mailbox = mailboxes.find((m) => m.mailboxId === caixaParam) ?? mailboxes[0];
  const mailboxId = mailbox?.mailboxId ?? "";
  // A caixa pessoal (membro, dono, admin) é sempre de quem a abre; `suporte@` depende de `correio.caixa`.
  const personal = !!mailbox && mailbox.kind !== "business";
  const folder: MailFolder = isMailFolder(params.get("pasta")) ? (params.get("pasta") as MailFolder) : "unread";
  const threadId = params.get("conversa") ?? "";

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [composeOpen, setComposeOpen] = useState(false);
  const [appPwOpen, setAppPwOpen] = useState(false);

  // Pesquisa com atraso curto (cada tecla não pode ser um pedido ao servidor de correio).
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);
  useEffect(() => setPage(1), [q, folder, mailboxId]);

  usePageSubtitle(mailbox ? mailbox.address : null);

  const threadsQ = useGetMailMailboxesMailboxidThreads(
    mailboxId,
    { folder, ...(q ? { q } : {}), page, limit: PAGE_LIMIT },
    { query: { enabled: !!mailboxId, retry: false, placeholderData: keepPreviousData } },
  );
  const items = threadsQ.data?.items ?? [];

  const patch = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const selectedLabel = useMemo(() => (mailbox ? mailbox.displayName || mailbox.address : ""), [mailbox]);
  const open = !!threadId && !!mailbox;

  // ── Estados sem caixa ────────────────────────────────────────────────────────
  if (mailboxesQ.isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  }
  if (isMailNotConfigured(mailboxesQ.error) || (mailboxesQ.data && mailboxesQ.data.configured === false)) {
    return <NotConfigured />;
  }
  if (mailboxesQ.isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600 dark:text-red-400">{mailErrorMessage(mailboxesQ.error, "Não foi possível carregar as caixas.")}</p>
        <Button variant="outline" size="sm" onClick={() => mailboxesQ.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (!mailbox) {
    return (
      <div className="flex-1 flex" data-testid="mail-no-mailbox">
        <EmptyState
          icon="mail"
          title="Ainda não tens nenhuma caixa"
          desc="As caixas criam-se sozinhas: a tua aparece aqui daqui a pouco. Se continuar sem aparecer, fala com a RufVision."
        />
      </div>
    );
  }

  const tabs = MAIL_FOLDERS.map((f) => ({
    id: f.id,
    label:
      f.id === "unread" ? (
        <>
          {f.label}
          <CountBadge count={mailbox.unread ?? 0} size="nav" className="ml-1" />
        </>
      ) : (
        f.label
      ),
  }));

  return (
    <div className="flex flex-col h-full min-h-0 gap-3" data-testid="correio-caixa">
      {/* No telemóvel a conversa aberta ocupa o ecrã todo: a barra sai. */}
      <div className={`${open ? "hidden lg:flex" : "flex"} shrink-0 flex-wrap items-center gap-2`}>
        {mailboxes.length > 1 && (
          <div className="w-full sm:w-80">
            <Select
              aria-label="Caixa"
              value={mailboxId}
              onChange={(e: any) => patch({ caixa: e.target.value, conversa: null })}
            >
              {mailboxes.map((m) => (
                <option key={m.mailboxId} value={m.mailboxId}>
                  {mailboxLabel(m.kind, m.address)}
                  {m.unread ? ` (${m.unread})` : ""}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Tabs tabs={tabs} value={folder} onChange={(id: string) => patch({ pasta: id === "unread" ? null : id, conversa: null })} size="sm" />
        <div className="flex-1 min-w-[10rem]">
          <Input
            icon="search"
            aria-label="Pesquisar no correio"
            placeholder="Pesquisar"
            value={qInput}
            onChange={(e: any) => setQInput(e.target.value)}
            autoComplete="off"
          />
        </div>
        {/* Password da app: só nas caixas que são minhas (a pessoal e, para o dono, também a `suporte@`; a própria para um membro). */}
        {mailbox.canManageAppPassword && (
          <Button variant="outline" icon="phone" onClick={() => setAppPwOpen(true)}>
            Configurar no telemóvel
          </Button>
        )}
        <GuardButton leaf={mailLeaf(personal)} icon="edit" onClick={() => setComposeOpen(true)}>
          Novo email
        </GuardButton>
      </div>

      <div
        data-testid="mail-split"
        className="flex flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900"
      >
        <aside className={`${open ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-96 shrink-0 min-h-0 border-r border-zinc-100 dark:border-zinc-800`}>
          {isMailNotConfigured(threadsQ.error) ? (
            <NotConfigured />
          ) : threadsQ.isLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              ))}
            </div>
          ) : threadsQ.isError ? (
            <div className="p-4 space-y-2 text-sm text-red-600 dark:text-red-400">
              <p>{mailErrorMessage(threadsQ.error, "Não foi possível carregar as conversas.")}</p>
              <Button size="sm" variant="outline" onClick={() => threadsQ.refetch()}>
                Tentar de novo
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex-1 flex" data-testid="mail-empty">
              <EmptyState
                icon="mail"
                title={q ? "Nada encontrado" : folder === "unread" ? "Tudo lido" : "Sem conversas"}
                desc={q ? "Experimenta outras palavras." : `${selectedLabel}: nada nesta pasta.`}
              />
            </div>
          ) : (
            <ul className="flex-1 min-h-0 overflow-y-auto" aria-label="Conversas">
              {items.map((it) => (
                <MailThreadRow
                  key={it.threadId}
                  item={it}
                  folder={folder}
                  selected={it.threadId === threadId}
                  onSelect={() => patch({ conversa: it.threadId ?? null })}
                />
              ))}
            </ul>
          )}
          <MailPager page={page} limit={threadsQ.data?.limit ?? PAGE_LIMIT} total={threadsQ.data?.total ?? 0} onPage={setPage} />
        </aside>

        <section className={`${open ? "flex" : "hidden lg:flex"} flex-1 flex-col min-w-0 min-h-0`}>
          {open ? (
            <MailThreadView
              key={`${mailboxId}:${threadId}`}
              mailboxId={mailboxId}
              mailboxAddress={mailbox.address ?? ""}
              threadId={threadId}
              personal={personal}
              archived={folder === "archive"}
              onBack={() => patch({ conversa: null })}
            />
          ) : (
            <div className="flex-1 flex">
              <EmptyState icon="mail" title="Escolhe uma conversa" desc="As mensagens aparecem aqui." />
            </div>
          )}
        </section>
      </div>

      <MailAppPasswordModal
        key={mailboxId}
        mailbox={appPwOpen && mailbox.canManageAppPassword ? { mailboxId, address: mailbox.address, personal } : null}
        onClose={() => setAppPwOpen(false)}
      />

      <MailComposer
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        mailboxId={mailboxId}
        mailboxAddress={mailbox.address ?? ""}
        personal={personal}
        mode="new"
      />
    </div>
  );
}
