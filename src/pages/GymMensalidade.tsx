import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { colorFromName } from "../lib/avatarColor";
import { Icon } from "../ui/icons.jsx";
import { Button, Modal, Avatar } from "../ui/ui.jsx";
import { currentPeriod, invalidateMens } from "./gymMensalidade/format";
import { ClienteMensalidade } from "./gymMensalidade/ClienteMensalidade";
import { InviteGymMemberButton } from "./gymMensalidade/InviteGymMemberButton";
import { AnaliseView, CobrancasView } from "./gymMensalidade/Cobrancas";
import { ConvidarSocioModal, SubscricoesModal } from "./gymMensalidade/Modals";

// Reexportados: a ficha de cliente, o Financeiro e os testes importam daqui.
export type { Sub, Payment, Membership } from "./gymMensalidade/format";
export { SubscricoesModal, ConvidarSocioModal } from "./gymMensalidade/Modals";
export { ClienteMensalidade } from "./gymMensalidade/ClienteMensalidade";
export { InviteGymMemberButton } from "./gymMensalidade/InviteGymMemberButton";

// ── Tab principal: Financeiro do ginásio (Cobranças + Subscrições + Análise) ───
export function MensalidadesTab() {
  const qc = useQueryClient()
  const [sel, setSel] = useState<{ id: string; name: string } | null>(null)
  const [period, setPeriod] = useState(currentPeriod())
  const [filter, setFilter] = useState<'cobrar' | 'pago' | 'todos'>('cobrar')
  const [q, setQ] = useState('')
  const [subsOpen, setSubsOpen] = useState(false)
  const [analiseOpen, setAnaliseOpen] = useState(false)
  const [conviteOpen, setConviteOpen] = useState(false)

  if (sel) {
    return (
      <div>
        <button onClick={() => setSel(null)} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-5"><Icon name="chevronLeft" className="w-4 h-4" />Voltar</button>
        <div className="flex items-center gap-3 mb-5">
          <Avatar name={sel.name} color={colorFromName(sel.name)} size={48} />
          <div><h2 className="text-xl font-semibold text-zinc-900 dark:text-white">{sel.name}</h2><p className="text-sm text-zinc-500">Mensalidade</p></div>
        </div>
        <ClienteMensalidade customerId={sel.id} />
      </div>
    )
  }

  // Página = cockpit de Cobranças (pulso no topo + lista). Análise e Subscrições
  // vivem em modais, para a lista (que pode ser enorme) não enterrar nada.
  return (
    <div className="space-y-5">
      {/* flex-wrap: a 390 px as três acções não cabem ao lado do texto — passam para a linha de baixo (sem scroll horizontal). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">Cobranças das mensalidades.</p>
        <div className="flex flex-wrap items-center gap-2">
          <InviteGymMemberButton onInviteClick={() => setConviteOpen(true)} />
          <Button variant="outline" size="sm" icon="trend" onClick={() => setAnaliseOpen(true)}>Análise</Button>
          <Button variant="outline" size="sm" icon="layers" onClick={() => setSubsOpen(true)}>Subscrições</Button>
        </div>
      </div>

      <CobrancasView period={period} filter={filter} q={q} onPeriodChange={setPeriod} onFilterChange={setFilter} onQChange={setQ} onOpen={setSel} onOpenConfirmBulk={() => setConviteOpen(true)} />

      {conviteOpen && <ConvidarSocioModal onClose={() => setConviteOpen(false)} onInvited={() => invalidateMens(qc)} />}
      {subsOpen && <SubscricoesModal onClose={() => setSubsOpen(false)} />}
      {analiseOpen && (
        <Modal open onClose={() => setAnaliseOpen(false)} width="max-w-4xl" title="Análise"
          subtitle="Saúde das mensalidades: recorrência, retenção e movimento do MRR."
          footer={<Button variant="ghost" onClick={() => setAnaliseOpen(false)}>Fechar</Button>}>
          <AnaliseView />
        </Modal>
      )}
    </div>
  )
}
