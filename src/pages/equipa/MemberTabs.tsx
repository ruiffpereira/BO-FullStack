import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge, EmptyState } from "../../ui/ui.jsx";
import { Pagination } from "../../components/Pagination";
import { useStaffOptions } from "../../hooks/useStaff";
import { Combobox } from "../../components/Combobox";
import { getScheduleStaffOptionsQueryKey } from "../../gen/backoffice/hooks/useGetScheduleStaffOptions.js";
import { getScheduleStaffQueryKey } from "../../gen/backoffice/hooks/useGetScheduleStaff.js";
import { usePutScheduleStaffId } from "../../gen/backoffice/hooks/usePutScheduleStaffId.js";
import { formatDatePt, formatTimePt } from "../../lib/supportLog";
import { teamErrorMessage } from "../../lib/teamAccess";
import { getTeamQueryKey } from "../../gen/backoffice/hooks/useGetTeam";
import { useGetTeamMemberidActivity } from "../../gen/backoffice/hooks/useGetTeamMemberidActivity";
import type { TeamMember } from "../../gen/backoffice/types/TeamMember";
import { TeamButton } from "./shared";

// ── Profissional do membro (ligar / desligar) ───────────────────────────────

/**
 * Separador Profissional da ficha: liga o membro a um profissional (opcional) ou desliga-o. Com a ligação e o
 * âmbito «Só os meus», o membro vê só o que é desse profissional (a API é que filtra). A ligação grava-se no
 * profissional (PUT /schedule/staff/:id com memberId), por isso exige a folha agenda.profissionais (Editar).
 */
export function StaffLinkTab({ member, inSupport }: { member: TeamMember; inSupport: boolean }) {
  const qc = useQueryClient();
  const { staff, isLoading } = useStaffOptions();
  const linked = member.staff ?? null;
  const [pick, setPick] = useState("");
  const link = usePutScheduleStaffId();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getTeamQueryKey() });
    qc.invalidateQueries({ queryKey: getScheduleStaffQueryKey() });
    qc.invalidateQueries({ queryKey: getScheduleStaffOptionsQueryKey() });
  };
  const run = (staffId: string, memberId: string | null, okMsg: string) =>
    link.mutate(
      { id: staffId, data: { memberId } },
      {
        onSuccess: () => {
          refresh();
          setPick("");
          toast.success(okMsg);
        },
        onError: (error) => toast.error(teamErrorMessage(error, "Não foi possível alterar a ligação.")),
      },
    );

  const options = [
    { value: "", label: "Escolher profissional" },
    ...staff.filter((s) => s.active && s.staffId !== linked?.staffId).map((s) => ({ value: s.staffId, label: s.name })),
  ];

  return (
    <div className="space-y-4" data-testid="staff-link-tab">
      <p className="text-sm text-zinc-500">
        Ligar o membro a um profissional permite-lhe ver só o que é dele (âmbito «Só os meus» na agenda e no financeiro).
        A ligação é opcional.
      </p>
      {linked ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-xs text-zinc-400">Ligado a</p>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{linked.name}</p>
          </div>
          <TeamButton
            inSupport={inSupport}
            variant="outline"
            size="sm"
            leaf="agenda.profissionais"
            isLoading={link.isPending}
            onClick={() => linked.staffId && run(linked.staffId, null, "Ligação removida.")}
          >
            Desligar
          </TeamButton>
        </div>
      ) : isLoading ? (
        <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      ) : staff.length === 0 ? (
        <p className="text-sm text-zinc-500">Ainda não há profissionais. Cria-os em Agenda → Profissionais.</p>
      ) : (
        <div className="space-y-3">
          <Combobox
            label="Profissional"
            value={pick}
            onChange={setPick}
            options={options}
            placeholder="Escolher profissional"
            searchPlaceholder="Pesquisar profissional…"
            disabled={inSupport}
          />
          <div className="flex justify-end">
            <TeamButton
              inSupport={inSupport}
              leaf="agenda.profissionais"
              disabled={!pick}
              isLoading={link.isPending}
              onClick={() => pick && member.memberId && run(pick, member.memberId, "Membro ligado ao profissional.")}
            >
              Ligar
            </TeamButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Actividade do membro (fase 3) ───────────────────────────────────────────

const ACTIVITY_PAGE_SIZE = 15;

/** O que o membro fez (registo de auditoria): data/hora · acção · área · ok/falhou. Lista paginada pelo servidor. */
export function ActivityTab({ memberId }: { memberId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useGetTeamMemberidActivity(memberId, {
    page,
    limit: ACTIVITY_PAGE_SIZE,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }
  if (isError) {
    return (
      <p role="status" className="text-sm text-red-600 dark:text-red-400">
        {teamErrorMessage(error, "Não foi possível carregar a actividade.")}
      </p>
    );
  }
  if (items.length === 0) {
    return <EmptyState icon="clock" title="Ainda sem actividade" desc="Quando este membro fizer alguma coisa, aparece aqui." />;
  }
  return (
    <div>
      <ul
        aria-label="Actividade do membro"
        className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800"
      >
        {items.map((it) => (
          <li key={it.id} className="px-3.5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{it.actionLabel}</p>
              <p className="text-xs text-zinc-500 truncate">{it.area}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0">
              <span className="whitespace-nowrap tabular-nums">
                {formatDatePt(it.at)} {formatTimePt(it.at)}
              </span>
              <Badge tone={it.ok ? "green" : "red"} dot>
                {it.ok ? "Ok" : "Falhou"}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        setPage={setPage}
        pageCount={Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE))}
        total={total}
        start={(page - 1) * ACTIVITY_PAGE_SIZE}
        end={Math.min(page * ACTIVITY_PAGE_SIZE, total)}
      />
    </div>
  );
}
