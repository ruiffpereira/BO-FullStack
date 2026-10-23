import { usePageSubtitle } from "../context/PageMetaContext";
import { useGetCustomers } from "../gen/backoffice/hooks/useGetCustomers.js";
import { useTeamAccess } from "../hooks/useTeamAccess";
import { GymGroupsProvider } from "./ginasio/groups";
import { CatalogoTab } from "./ginasio/CatalogoTab";
import { TreinosTab } from "./ginasio/TreinosTab";
import { PlanosTab } from "./ginasio/PlanosTab";
import { ClientesTab } from "./ginasio/ClientesTab";

export type GinasioView = 'catalogo' | 'treinos' | 'planos' | 'clientes'

/**
 * "Ginásio" — cada separador vive na sua própria rota (`/ginasio`,
 * `/ginasio/treinos`, `/ginasio/planos`, `/ginasio/clientes` — T2.5, Fase 2
 * da sidebar com submenus) — a navegação entre vistas já não é feita por
 * `Tabs` de topo, é a sidebar (`NavItemGroup`/`Shell.tsx`); a página só
 * recebe a vista pedida via `view`. A página nunca usou `?tab=` (sem
 * redirect de deep-link legacy a fazer aqui, ao contrário de
 * Loja/Clientes/Financeiro). As mensalidades vivem no Financeiro
 * (`MensalidadesTab` de `GymMensalidade.tsx`, via `FinanceiroPage.tsx`) —
 * o antigo `MensalidadesTab` local (código morto) foi removido em 2026-07-21.
 *
 * Nota do subitem "clientes": o rótulo na sidebar é "Progresso de clientes",
 * não "Clientes" — ver o comentário em `src/lib/navigation.ts` (colisão de
 * nome acessível com o item core `/clientes`).
 */
export function Ginasio({ view }: { view: GinasioView }) {
  // Equipa (B41): um membro sem o módulo Clientes não lê `/customers` (403) — nem se pede.
  const { canAny: canTeamAny } = useTeamAccess()
  const { data: custData } = useGetCustomers({ query: { enabled: canTeamAny(['agenda.marcacoes', 'clientes.lista']) } })
  const customers = (custData?.rows ?? []) as { customerId: string; name: string }[]
  usePageSubtitle('Exercícios, treinos, planos e progresso dos clientes.')

  return (
    <GymGroupsProvider>
    <div className="space-y-6">
      {view === 'catalogo' && <CatalogoTab />}
      {view === 'treinos' && <TreinosTab />}
      {view === 'planos' && <PlanosTab />}
      {view === 'clientes' && <ClientesTab customers={customers} />}
    </div>
    </GymGroupsProvider>
  )
}
