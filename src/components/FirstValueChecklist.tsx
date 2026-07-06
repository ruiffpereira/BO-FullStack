import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Card, Badge } from '../ui/ui.jsx'
import { Icon } from '../ui/icons.jsx'
import { useGetCustomers } from '../gen/backoffice/hooks/useGetCustomers.js'
import { useGetScheduleServices } from '../gen/backoffice/hooks/useGetScheduleServices.js'
import { useGetScheduleWorkingHours } from '../gen/backoffice/hooks/useGetScheduleWorkingHours.js'
import { useGetGymSubscriptions } from '../gen/backoffice/hooks/useGetGymSubscriptions.js'
import { useGetProducts } from '../gen/backoffice/hooks/useGetProducts.js'

/**
 * Bloco "Primeiros passos" no topo do Dashboard (T11, brief `.design/self-serve/`).
 * Checklist por vertical, derivada das PERMISSÕES do tenant + dados que já existem
 * (nunca um novo endpoint): agenda→serviço/horário · ginásio→subscrição/cliente/
 * cobrança · loja→produto · core→cliente. Cada item é um deep-link; completa-se
 * sozinho quando os dados aparecem. Dispensável (persistido por user em
 * localStorage) e colapsa para acordeão abaixo de `md` (`md:block` força aberto
 * em ecrãs maiores independentemente do estado local `expanded`).
 */

type ChecklistItem = {
  id: string
  label: string
  href: string
  done: boolean
}

const DISMISS_KEY = 'dashboard.firstValueChecklist.dismissedFor'

function dismissKeyFor(userId: string | null): string {
  return `${DISMISS_KEY}.${userId ?? 'anon'}`
}

function readDismissed(userId: string | null): boolean {
  try {
    return window.localStorage.getItem(dismissKeyFor(userId)) === '1'
  } catch {
    return false
  }
}

function writeDismissed(userId: string | null) {
  try {
    window.localStorage.setItem(dismissKeyFor(userId), '1')
  } catch {
    /* ignore storage errors */
  }
}

export function FirstValueChecklist() {
  const { authHeader, hasPermission, userId } = useAuth()
  const headers = authHeader()
  const navigate = useNavigate()

  const [expanded, setExpanded] = useState(true)
  const [dismissed, setDismissed] = useState(() => readDismissed(userId))

  const canSchedule = hasPermission('VIEW_SCHEDULE')
  const canGym = hasPermission('VIEW_GYM')
  const canProducts = hasPermission('VIEW_PRODUCTS')
  const isCoreOnly = !canSchedule && !canGym && !canProducts
  // /customers é server-gated por VIEW_CUSTOMERS (não é realmente "core" no
  // backend, apesar de a página ser core na sidebar) — um tenant criado pelo
  // admin (fora do fluxo self-serve) pode não a ter. Sem este gate, o hook
  // dispararia um 403 em todo o load do Dashboard.
  const canCustomers = hasPermission('VIEW_CUSTOMERS')

  // Só se busca o que a vertical ativa precisa — cada hook é gated pela
  // permissão correspondente (sem pedidos a mais para tenants de outra vertical).
  const { data: customersData } = useGetCustomers({
    query: { enabled: (isCoreOnly || canGym) && canCustomers },
    client: { headers },
  })
  const { data: services } = useGetScheduleServices({
    query: { enabled: canSchedule },
    client: { headers },
  })
  const { data: workingHours } = useGetScheduleWorkingHours({
    query: { enabled: canSchedule },
    client: { headers },
  })
  const { data: gymSubscriptions } = useGetGymSubscriptions({
    query: { enabled: canGym },
    client: { headers },
  })
  const { data: productsData } = useGetProducts({
    query: { enabled: canProducts },
    client: { headers },
  })

  const customersCount = customersData?.count ?? customersData?.rows?.length ?? 0
  const productsCount = productsData?.count ?? productsData?.rows?.length ?? 0

  const items: ChecklistItem[] = useMemo(() => {
    if (canSchedule) {
      return [
        {
          id: 'agenda-service',
          label: 'Cria o teu primeiro serviço',
          href: '/agenda',
          done: (services?.length ?? 0) > 0,
        },
        {
          id: 'agenda-hours',
          label: 'Define o horário de funcionamento',
          href: '/agenda',
          done: (workingHours?.length ?? 0) > 0,
        },
        {
          id: 'agenda-share',
          label: 'Partilha o link de marcação com os teus clientes',
          href: '/agenda',
          done: false,
        },
      ]
    }
    if (canGym) {
      const gymItems: ChecklistItem[] = [
        {
          id: 'gym-subscription',
          label: 'Cria a tua primeira subscrição',
          href: '/financeiro/ginasio',
          done: (gymSubscriptions?.length ?? 0) > 0,
        },
      ]
      if (canCustomers) {
        gymItems.push({
          id: 'gym-customer',
          label: 'Adiciona o teu primeiro cliente',
          href: '/clientes',
          done: customersCount > 0,
        })
      }
      // "Regista a primeira cobrança": sem um sinal de vida-inteira barato (o
      // hook gerado só dá o mês corrente, `useGetGymMensalidadeFinance`), pelo
      // que verificar o mês atual regride o item logo no início de cada mês
      // novo — ao contrário dos irmãos, que nunca "desconcluem". Em vez de
      // inventar um endpoint novo, o item passa a não-auto-completante (como
      // "revê encomendas"/"explora conteúdos"): fica sempre visível, nunca
      // marca sozinho e nunca regride.
      gymItems.push({
        id: 'gym-payment',
        label: 'Regista a primeira cobrança',
        href: '/financeiro/ginasio',
        done: false,
      })
      return gymItems
    }
    if (canProducts) {
      return [
        {
          id: 'loja-product',
          label: 'Cria o teu primeiro produto',
          href: '/loja?tab=produtos',
          done: productsCount > 0,
        },
        {
          id: 'loja-orders',
          label: 'Revê as tuas encomendas',
          href: '/loja?tab=encomendas',
          done: false,
        },
      ]
    }
    const coreItems: ChecklistItem[] = []
    if (canCustomers) {
      coreItems.push({
        id: 'core-customer',
        label: 'Adiciona o teu primeiro cliente',
        href: '/clientes',
        done: customersCount > 0,
      })
    }
    coreItems.push({ id: 'core-content', label: 'Explora os conteúdos do teu site', href: '/conteudos', done: false })
    return coreItems
  }, [canSchedule, canGym, canProducts, canCustomers, services, workingHours, gymSubscriptions, customersCount, productsCount])

  if (dismissed) return null

  const doneCount = items.filter((i) => i.done).length
  const allDone = doneCount === items.length

  const dismiss = () => {
    writeDismissed(userId)
    setDismissed(true)
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <Icon name="star" className="w-[18px] h-[18px]" />
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="min-w-0 flex-1 flex items-center gap-2 text-left"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Primeiros passos</p>
            <p className="text-xs text-zinc-500">
              {doneCount}/{items.length} concluídos
            </p>
          </div>
          <Icon
            name={expanded ? 'chevronDown' : 'chevronRight'}
            className="w-4 h-4 text-zinc-400 shrink-0 ml-auto md:hidden"
          />
        </button>
        <Badge tone={allDone ? 'green' : 'blue'} className="hidden sm:inline-flex">
          {doneCount}/{items.length}
        </Badge>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar checklist"
          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Icon name="x" className="w-4 h-4" />
        </button>
      </div>

      <div
        className={`${expanded ? 'block' : 'hidden'} md:block border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800`}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.href)}
            className="group/item w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                item.done ? 'bg-emerald-500 text-white' : 'border-2 border-zinc-300 dark:border-zinc-600'
              }`}
            >
              {item.done && <Icon name="check" className="w-3 h-3" strokeWidth={3} />}
            </span>
            <span
              className={`flex-1 text-sm ${
                item.done
                  ? 'text-zinc-400 line-through'
                  : 'text-zinc-700 dark:text-zinc-200 group-hover/item:text-accent'
              }`}
            >
              {item.label}
            </span>
            <Icon name="chevronRight" className="w-4 h-4 text-zinc-300 shrink-0" />
          </button>
        ))}
      </div>
    </Card>
  )
}
