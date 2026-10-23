import { usePageSubtitle } from "../context/PageMetaContext";
import { ConfiguracoesPanel as ConfigPanel } from "./AgendaConfig";
import { AgendaProfissionais } from "./AgendaProfissionais";
import { CalendarioView } from "./agenda/CalendarioView";
import { MarcacoesPanel } from "./agenda/MarcacoesPanel";
import { ServicosPanel } from "./agenda/ServicosPanel";

// ─── Agenda root ──────────────────────────────────────────────────────────────

export type AgendaView = "cal" | "marcacoes" | "servicos" | "profissionais" | "config";

/**
 * Página "Agenda" (`VIEW_SCHEDULE`). Cada separador vive na sua própria rota
 * (`/agenda` = Calendário · `/agenda/marcacoes` · `/agenda/servicos` ·
 * `/agenda/config`, T2.7 — Fase 2 da sidebar com submenus) — a navegação entre
 * vistas já não é feita por `Tabs`/botões de topo, é a sidebar
 * (`NavItemGroup`/`Shell.tsx`); a página só recebe a vista pedida via `view`.
 * Sem gate por subitem: a página inteira já está atrás de `VIEW_SCHEDULE`
 * (`Shell.tsx`), por isso os 4 subitens de `SUBMENU["/agenda"]` não têm `perm`
 * individual. O deep-link antigo `?openService=<id>` (abre o modal de edição
 * de um serviço, ex. a partir do CMS) já não chega aqui — o `AgendaEntry` do
 * `App.tsx` intercepta-o na rota `/agenda` e redireciona para
 * `/agenda/servicos?openService=<id>` antes de renderizar; `?marcacao=`/
 * `?data=` continuam a ser lidos pelo `CalendarioView` na raiz.
 */
export function Agenda({ view }: { view: AgendaView }) {
  usePageSubtitle("Marcações, serviços e horários.");
  return (
    // cal e marcações enchem a altura do Shell a partir de xl (ver `fillAgenda` no Shell).
    <div className={view === "cal" || view === "marcacoes" ? "xl:h-full xl:min-h-0" : undefined}>
      {view === "cal" && <CalendarioView />}
      {view === "marcacoes" && <MarcacoesPanel />}
      {view === "servicos" && <ServicosPanel />}
      {view === "profissionais" && <AgendaProfissionais />}
      {view === "config" && <ConfigPanel />}
    </div>
  );
}
