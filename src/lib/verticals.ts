// Mapa único e partilhado vertical→módulos do signup self-serve (T8, brief
// `.design/self-serve/`). O vertical é a língua do visitante ("tipo de negócio");
// o módulo é o que a plataforma cobra/gate — o mapeamento decide a pré-seleção do
// passo 2 do `/signup`. Extensível: uma vertical nova = uma entrada nova aqui.
import type { BillableModule } from './billingStatus'

export type Vertical = 'barber' | 'gym' | 'shop'

export const VERTICALS: { id: Vertical; label: string; icon: string }[] = [
  { id: 'barber', label: 'Agenda', icon: 'calendar' },
  { id: 'gym', label: 'Ginásio', icon: 'trend' },
  { id: 'shop', label: 'Loja', icon: 'store' },
]

/** Vertical escolhida → módulos pré-marcados no passo 2 (editável pelo visitante). */
export const VERTICAL_MODULES: Record<Vertical, BillableModule[]> = {
  barber: ['agenda'],
  gym: ['gym'],
  shop: ['loja'],
}

/** Type guard para o `?vertical=` da query string — inválido/ausente → null (ignorado). */
export function isVertical(value: string | null): value is Vertical {
  return value === 'barber' || value === 'gym' || value === 'shop'
}
