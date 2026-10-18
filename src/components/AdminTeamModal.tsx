import { Modal, Button } from "../ui/ui.jsx";
import { useGetAdminUsersUseridTeam } from "../gen/backoffice/hooks/useGetAdminUsersUseridTeam";
import { lastAccessLabel, memberStatus, StatusBadge } from "../pages/Equipa";
import { getApiError } from "../lib/apiError";

/**
 * Admin → Utilizadores → acção "Equipa" (B41): a equipa de um tenant, SÓ de leitura (nome, email, estado, último
 * acesso). Serve o suporte; mexer na equipa é com o tenant — ou numa sessão de suporte ("Entrar como").
 */
export function AdminTeamModal({
  tenant,
  onClose,
}: {
  tenant: { userId: string; name: string } | null;
  onClose: () => void;
}) {
  const { data: members = [], isLoading, isError, error } = useGetAdminUsersUseridTeam(tenant?.userId ?? "", {
    query: { enabled: !!tenant },
  });

  return (
    <Modal
      open={!!tenant}
      onClose={onClose}
      title="Equipa"
      subtitle={tenant?.name}
      width="max-w-2xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      ) : isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {getApiError(error, "Não foi possível carregar a equipa.")}
        </p>
      ) : members.length === 0 ? (
        <p className="text-sm text-zinc-500">Este tenant ainda não tem equipa.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800" aria-label="Membros da equipa">
          {members.map((m) => (
            <li key={m.memberId} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{m.name}</p>
                <p className="text-xs text-zinc-500 truncate">{m.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <StatusBadge status={memberStatus(m)} />
                <span className="whitespace-nowrap">{lastAccessLabel(m)}</span>
                {m.createdBy !== undefined && (
                  <span className="whitespace-nowrap">Criado por: {m.createdBy?.name ?? "Dono"}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
