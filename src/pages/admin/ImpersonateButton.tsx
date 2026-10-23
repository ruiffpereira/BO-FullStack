import { IconButton } from "../../ui/ui.jsx";
import type { User } from "../../gen/backoffice/types/User.js";
import type { GetUsers200 } from "../../gen/backoffice/types/GetUsers.js";
import { formatDatePt } from "../../lib/supportLog";

// Linha da lista: o `User` gerado + os campos que só o `GET /users` traz.
// `canImpersonate` é calculado no servidor — nunca se recalcula aqui.
export type UserRow = User &
  Pick<
    GetUsers200[number],
    "websiteDomain" | "ownerName" | "supportAccessUntil" | "canImpersonate" | "isPlatformAdmin" | "teamCount" | "phone"
  >;

const SUPPORT_REASON_ADMIN = "Conta de admin";
const SUPPORT_REASON_DENIED =
  "O cliente não autorizou o acesso — pede-lhe para o dar no Perfil";

/** "Acesso de suporte até DD/MM/AAAA" — só quando a data ainda está no futuro. */
export function supportUntilLabel(u: UserRow): string | null {
  if (!u.supportAccessUntil) return null;
  const t = new Date(u.supportAccessUntil).getTime();
  if (Number.isNaN(t) || t <= Date.now()) return null;
  return `Acesso de suporte até ${formatDatePt(u.supportAccessUntil)}`;
}

/**
 * "Entrar como" (sessão de suporte). Não é escrita, por isso `IconButton` e não
 * `GuardButton`. Activo só se o servidor disse `canImpersonate`; desactivado
 * mostra o motivo (title + aria-label). Abre um separador novo e deixa este
 * intacto: quem faz o pedido e passa a agir como o tenant é `/suporte/entrar`.
 */
export function ImpersonateButton({ user }: { user: UserRow }) {
  const enabled = !!user.canImpersonate;
  if (enabled) {
    return (
      <IconButton
        icon="user"
        label={`Entrar como ${user.name}`}
        title="Entrar como"
        onClick={() => window.open(`/suporte/entrar/${user.userId}`, "_blank", "noopener")}
      />
    );
  }
  // Vem do servidor (`isPlatformAdmin`) — nunca se deduz das roles no cliente.
  const isAdminAccount = !!user.isPlatformAdmin;
  const reason = isAdminAccount ? SUPPORT_REASON_ADMIN : SUPPORT_REASON_DENIED;
  return (
    // O botão desactivado não recebe eventos de rato: o span segura o tooltip.
    <span className="inline-flex" title={reason}>
      <IconButton
        icon="user"
        label={`Entrar como ${user.name} (indisponível): ${reason}`}
        disabled
        className="opacity-40 cursor-not-allowed"
      />
    </span>
  );
}
