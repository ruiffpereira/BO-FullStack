import { useNavigate } from "react-router-dom";
import { Button } from "../../ui/ui.jsx";
import { useAuth } from "../../context/AuthContext";
import { useConversationByCustomer } from "../../hooks/useMessages";
import { CountBadge } from "../NavBadge";
import { CONVERSA_PARAM } from "./ClientesChatTab";

/**
 * Atalho da ficha do cliente (B43): "Abrir conversa" quando o cliente já falou com o negócio — leva ao separador
 * Clientes das Mensagens, nessa conversa. Só aparece com `mensagens.clientes` (Ver) e fora de sessão de suporte
 * (`/messages/*` fecha aí); sem conversa não mostra nada (quem começa é o cliente, no site).
 */
export function OpenConversationShortcut({ customerId, onNavigate }: { customerId: string; onNavigate?: () => void }) {
  const { can, supportSession } = useAuth();
  const navigate = useNavigate();
  const allowed = can("mensagens.clientes") && !supportSession;
  const { data } = useConversationByCustomer(customerId, allowed);
  if (!allowed || !data?.conversationId) return null;
  const id = data.conversationId;
  return (
    <div>
      <Button
        variant="outline"
        icon="message"
        data-testid="open-customer-conversation"
        onClick={() => {
          onNavigate?.();
          navigate(`/mensagens?${CONVERSA_PARAM}=${encodeURIComponent(id)}`);
        }}
      >
        Abrir conversa
        <CountBadge count={data.unread} size="nav" />
      </Button>
    </div>
  );
}
