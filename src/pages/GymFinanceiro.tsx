import { PageHeader } from '../ui/ui.jsx'
import { MensalidadesTab } from './GymMensalidade'

/**
 * Página "Financeiro" do ginásio (menu lateral, VIEW_GYM) — separada do
 * Financeiro geral (VIEW_STATS). Mostra as mensalidades + subscrições.
 */
export function GymFinanceiro() {
  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" subtitle="Mensalidades, subscrições e estado dos pagamentos do ginásio." />
      <MensalidadesTab />
    </div>
  )
}
