import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { usePageSubtitle } from "../context/PageMetaContext";
import { AdminBillingTab } from "../components/AdminBilling";
import { UtilizadoresTab } from "./admin/UtilizadoresTab";
import { PermissoesTab } from "./admin/PermissoesTab";
import { ComponentesTab } from "./admin/ComponentesTab";
import { TokensTab } from "./admin/TokensTab";
import { DominiosTab } from "./admin/DominiosTab";
import { IntegracoesTab } from "./admin/IntegracoesTab";
import { AtividadeTab, SistemaTab } from "./admin/AtividadeTab";

// ─── Admin root ───────────────────────────────────────────────────────────────

/**
 * "Admin" — cada separador vive na sua própria rota (`/admin`,
 * `/admin/permissoes`, `/admin/componentes`, `/admin/tokens`,
 * `/admin/faturacao`, `/admin/integracoes`, `/admin/atividade`,
 * `/admin/sistema` — T2.4, Fase 2 da sidebar com submenus) — a navegação
 * entre vistas já não é feita por `Tabs` de topo, é a sidebar
 * (`NavItemGroup`/`Shell.tsx`); a página só recebe a vista pedida via `view`.
 * A página em si nunca usou `?tab=` — o único deep-link legacy real é o
 * retorno do OAuth do Google (`/admin?google=connected|error`), resolvido
 * pelo `AdminEntry` do `App.tsx` (redireciona para `/admin/integracoes`
 * preservando o parâmetro); o toast + limpeza do query string continuam
 * aqui, agora view-agnósticos (já não precisam de trocar de tab sozinhos).
 */
export type AdminView =
  | "utilizadores" | "permissoes" | "componentes" | "tokens" | "dominios"
  | "faturacao" | "integracoes" | "atividade" | "sistema";

export function Admin({ view }: { view: AdminView }) {
  const { userId } = useAuth();
  usePageSubtitle("Gere utilizadores, permissões e componentes.");

  // Volta do OAuth do Google (?google=connected|error) → toast (o AdminEntry
  // já garantiu que estamos em /admin/integracoes quando o parâmetro existe).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (!g) return;
    if (g === "connected") {
      toast.success("Google Calendar ligado com sucesso");
    } else if (g === "error") {
      toast.error("Não foi possível ligar o Google");
    }
    // Limpa o query param para não repetir o toast em refresh.
    params.delete("google");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  return (
    <div>
      {view === "utilizadores" && (
        <UtilizadoresTab currentUserId={userId} />
      )}
      {view === "permissoes" && <PermissoesTab />}
      {view === "componentes" && <ComponentesTab />}
      {view === "tokens" && <TokensTab />}
      {view === "dominios" && <DominiosTab />}
      {view === "faturacao" && <AdminBillingTab />}
      {view === "integracoes" && <IntegracoesTab />}
      {view === "atividade" && <AtividadeTab />}
      {view === "sistema" && <SistemaTab />}
    </div>
  );
}
