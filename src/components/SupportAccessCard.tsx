import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Button, Badge, Select, SectionTitle, EmptyState } from "../ui/ui.jsx";
import { useAuth } from "../context/AuthContext";
import { Pagination } from "./Pagination";
import { confirmDialog } from "./confirm";
import { getApiError } from "../lib/apiError";
import { SUPPORT_UNAVAILABLE_NOTE } from "../lib/supportSession";
import {
  type SupportLogItem,
  changeEntries,
  describeSupportAction,
  describeSupportActor,
  failureLabel,
  formatDatePt,
  formatTimePt,
} from "../lib/supportLog";
import {
  useGetUsersMeSupportAccess,
  getUsersMeSupportAccessQueryKey,
} from "../gen/backoffice/hooks/useGetUsersMeSupportAccess";
import { usePutUsersMeSupportAccess } from "../gen/backoffice/hooks/usePutUsersMeSupportAccess";
import {
  useGetUsersMeSupportAccessLogs,
  getUsersMeSupportAccessLogsQueryKey,
} from "../gen/backoffice/hooks/useGetUsersMeSupportAccessLogs";

const LOGS_PAGE_SIZE = 10;

const DURATIONS: { days: 1 | 7 | 30; label: string }[] = [
  { days: 1, label: "24 horas" },
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
];

/**
 * Perfil → cartão "Acesso do suporte". O tenant decide se (e por quanto tempo)
 * o suporte da plataforma pode entrar na conta dele, e vê tudo o que o suporte
 * fez no "Registo do suporte".
 *
 * SEM `GuardButton` de propósito: a API não põe billingGate em
 * `PUT /users/me/support-access` — um tenant com dívida (read-only) tem de
 * poder revogar o acesso. Em sessão de suporte as acções ficam desactivadas
 * (a API recusa-as com 403 IMPERSONATION_FORBIDDEN).
 */
export function SupportAccessCard() {
  const qc = useQueryClient();
  const { supportSession } = useAuth();
  const inSupport = !!supportSession;
  const { data, isLoading, isError } = useGetUsersMeSupportAccess();
  const [days, setDays] = useState<1 | 7 | 30>(1);

  const putM = usePutUsersMeSupportAccess({
    mutation: {
      onError: (error) => toast.error(getApiError(error, "Não foi possível guardar o acesso do suporte.")),
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getUsersMeSupportAccessQueryKey() });
    qc.invalidateQueries({ queryKey: getUsersMeSupportAccessLogsQueryKey() });
  };

  const onGrant = () => {
    putM.mutate(
      { data: { days } },
      {
        onSuccess: () => {
          refresh();
          toast.success("Deste acesso ao suporte.");
        },
      },
    );
  };

  const onRevoke = async () => {
    const ok = await confirmDialog({
      title: "Revogar o acesso do suporte?",
      message: "O suporte deixa de poder entrar na tua conta e qualquer sessão de suporte aberta termina.",
      confirmLabel: "Revogar acesso",
      danger: true,
    });
    if (!ok) return;
    putM.mutate(
      { data: { days: 0 } },
      {
        onSuccess: () => {
          refresh();
          toast.success("Acesso do suporte revogado.");
        },
      },
    );
  };

  const active = !!data?.active && !!data.supportAccessUntil;
  const pending = !!data?.pendingActivation;

  return (
    <Card className="p-5 space-y-4">
      <SectionTitle>Acesso do suporte</SectionTitle>

      {isLoading && <div className="h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />}

      {!isLoading && isError && (
        <p role="status" className="text-sm text-zinc-500">
          Não foi possível carregar o estado do acesso do suporte.
        </p>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-1" data-testid="support-access-state">
          {active ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              O suporte tem acesso à tua conta até {formatDatePt(data.supportAccessUntil)} às{" "}
              {formatTimePt(data.supportAccessUntil)}
            </p>
          ) : pending ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              A tua conta ainda não foi activada (falta definires a password), por isso o suporte pode entrar
              nela para te ajudar a começar.
            </p>
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-200">O suporte não tem acesso à tua conta</p>
          )}
          {active && pending && (
            <p className="text-xs text-zinc-500">
              A conta ainda não foi activada, pelo que o suporte pode entrar nela mesmo sem este prazo.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Select
            label="Duração"
            value={String(days)}
            disabled={inSupport || putM.isPending}
            onChange={(e: any) => setDays(Number(e.target.value) as 1 | 7 | 30)}
          >
            {DURATIONS.map((d) => (
              <option key={d.days} value={d.days}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
        <Button
          onClick={onGrant}
          disabled={inSupport}
          isLoading={putM.isPending}
          title={inSupport ? SUPPORT_UNAVAILABLE_NOTE : undefined}
        >
          Dar acesso ao suporte
        </Button>
        {active && (
          <Button
            variant="outline"
            onClick={() => void onRevoke()}
            disabled={inSupport || putM.isPending}
            title={inSupport ? SUPPORT_UNAVAILABLE_NOTE : undefined}
          >
            Revogar acesso
          </Button>
        )}
      </div>
      {inSupport && <p className="text-xs text-zinc-500">{SUPPORT_UNAVAILABLE_NOTE}</p>}

      <SupportLogTable />
    </Card>
  );
}

// ── Registo do suporte ─────────────────────────────────────────────────────

function SupportLogTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useGetUsersMeSupportAccessLogs({ page, limit: LOGS_PAGE_SIZE });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / LOGS_PAGE_SIZE));
  const start = (page - 1) * LOGS_PAGE_SIZE;
  const end = Math.min(start + items.length, total);

  return (
    <div className="space-y-2 pt-2">
      <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Registo do suporte</p>

      {isLoading && <div className="h-16 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />}

      {!isLoading && isError && (
        <p role="status" className="text-sm text-zinc-500">
          Não foi possível carregar o registo do suporte.
        </p>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          icon="clock"
          title="Sem atividade do suporte"
          desc="Quando o suporte entrar na tua conta ou alterar algo, fica registado aqui."
        />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
          {/* Scroll horizontal em ecrãs estreitos (mesmo padrão das tabelas do BO). */}
          <div className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[34rem]">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Data/hora</th>
                    <th className="px-4 py-3">Quem</th>
                    <th className="px-4 py-3">Ação</th>
                    <th className="px-4 py-3">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                  {items.map((item, i) => (
                    <SupportLogRow key={item.auditLogId ?? i} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination
            page={page}
            setPage={setPage}
            pageCount={pageCount}
            total={total}
            start={start}
            end={end}
          />
        </>
      )}
    </div>
  );
}

function SupportLogRow({ item }: { item: SupportLogItem }) {
  const [open, setOpen] = useState(false);
  const entries = changeEntries(item.changes);
  const failed = failureLabel(item);
  const when = item.createdAt ? new Date(item.createdAt) : null;
  const whenValid = when && !Number.isNaN(when.getTime());

  return (
    <tr className="align-top">
      <td className="px-4 py-3 text-zinc-500 whitespace-nowrap tabular-nums">
        {whenValid ? `${formatDatePt(item.createdAt)} ${formatTimePt(item.createdAt)}` : "—"}
      </td>
      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">{describeSupportActor(item)}</td>
      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">
        <span>{describeSupportAction(item)}</span>
        {failed && (
          <Badge tone={failed === "Bloqueado" ? "amber" : "red"} className="ml-2">
            {failed}
          </Badge>
        )}
      </td>
      <td className="px-4 py-3">
        {entries.length === 0 ? (
          <span className="text-xs text-zinc-400">—</span>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-xs text-zinc-500 hover:text-accent underline underline-offset-2"
            >
              {open ? "Esconder" : "Ver detalhe"}
            </button>
            {open && (
              <dl className="mt-1.5 space-y-0.5 text-xs text-zinc-500">
                {entries.map(([k, v]) => (
                  <div key={k} className="flex gap-1.5">
                    <dt className="font-medium text-zinc-600 dark:text-zinc-300 shrink-0">{k}:</dt>
                    <dd className="break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
