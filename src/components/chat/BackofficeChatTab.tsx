import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTeamPeople, useMessagesSummary } from "../../hooks/useMessages";
import { orderBackofficeEntries, SUPPORT_KEY, type BackofficeEntry } from "../../lib/messages";
import { ChatConversationView, type ChatScope } from "./ChatConversationView";
import { ConversationRow } from "./ConversationRow";
import { ConversationHeader, MessagesSplit } from "./MessagesSplit";
import { colorFromString } from "./chatFormat";

/** Parâmetro do URL com a conversa aberta: `suporte`, `owner` ou o `memberId`. */
export const COM_PARAM = "com";

function scopeFor(key: string): ChatScope {
  return key === SUPPORT_KEY ? { kind: "support" } : { kind: "team", personKey: key };
}

/**
 * Separador **Backoffice**: o Suporte (fixo em primeiro) e as pessoas da equipa, 1-para-1, por ordem da última
 * mensagem. Só aparece o que a árvore dá: `mensagens.equipa` → pessoas; `mensagens.suporte` → Suporte.
 */
export function BackofficeChatTab() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const selectedKey = params.get(COM_PARAM);
  const canTeam = can("mensagens.equipa");
  const canSupport = can("mensagens.suporte");

  const people = useTeamPeople(canTeam);
  // Sem a folha da equipa não há `people` (nem o marcador do Suporte): o contador do Suporte vem do resumo.
  const summary = useMessagesSummary(canSupport && !canTeam);

  const entries = useMemo(
    () =>
      orderBackofficeEntries(
        people.data?.people ?? [],
        canTeam ? people.data?.support ?? null : { unread: summary.data?.support ?? 0 },
        { supportVisible: canSupport },
      ),
    [people.data, canTeam, canSupport, summary.data],
  );

  const selected: BackofficeEntry | undefined = entries.find((e) => e.key === selectedKey);
  const open = (key: string) => setParams((p) => { p.set(COM_PARAM, key); return p; });
  const close = () => setParams((p) => { p.delete(COM_PARAM); return p; });

  const list = (
    <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
      {people.isLoading && canTeam ? (
        <p className="text-sm text-zinc-400 px-2 py-6 text-center">A carregar…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-zinc-400 px-3 py-8 text-center">Ainda não há ninguém na equipa.</p>
      ) : (
        entries.map((e) => (
          <ConversationRow
            key={e.key}
            testId={e.kind === "support" ? "support-conversation" : "team-conversation"}
            name={e.name}
            avatarColor={e.kind === "support" ? "#0EA5A4" : undefined}
            colorSeed={e.key}
            preview={e.preview ?? (e.kind === "support" ? "Falamos contigo por aqui" : null)}
            when={e.lastMessageAt}
            unread={e.unread}
            muted={e.removed}
            active={selectedKey === e.key}
            onClick={() => open(e.key)}
          />
        ))
      )}
    </div>
  );

  return (
    <MessagesSplit
      list={list}
      selected={!!selected}
      emptyTitle="Suporte e equipa"
      emptyDesc="Escolhe o Suporte ou uma pessoa da equipa à esquerda."
      detail={
        selected ? (
          <>
            <ConversationHeader
              name={selected.name}
              subtitle={
                selected.kind === "support" ? "Falamos contigo por aqui"
                : selected.removed ? "Já não está na equipa"
                : selected.kind === "owner" ? "Dono"
                : "Equipa"
              }
              color={selected.kind === "support" ? "#0EA5A4" : colorFromString(selected.key)}
              onBack={close}
            />
            <ChatConversationView key={selected.key} scope={scopeFor(selected.key)} active />
          </>
        ) : null
      }
    />
  );
}
