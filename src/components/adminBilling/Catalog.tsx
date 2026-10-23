import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Button, Input, Toggle, SectionTitle } from "../../ui/ui.jsx";
import { getApiError } from "../../lib/apiError";
import { getAdminBillingSubscriptionsQueryKey } from "../../gen/backoffice/hooks/useGetAdminBillingSubscriptions";
import { getAdminBillingCatalogQueryKey } from "../../gen/backoffice/hooks/useGetAdminBillingCatalog";
import { usePutAdminBillingCatalogModule } from "../../gen/backoffice/hooks/usePutAdminBillingCatalogModule";
import type { BillingCatalogModule } from "../../gen/backoffice/types/BillingCatalogModule";
import { centsToEurInput, parseEurToCents } from "../../lib/billingStatus";

// ── Catálogo de preços ────────────────────────────────────────────────────────

/** Uma linha editável do catálogo: label + preço/mês (€) + toggle ativo + Guardar. */
function CatalogRow({ row }: { row: BillingCatalogModule }) {
  const qc = useQueryClient()
  const [priceStr, setPriceStr] = useState(() => centsToEurInput(row.monthlyAmountCents))
  const [active, setActive] = useState(row.active)
  // Verdadeiro assim que o dono mexe no preço/toggle desta linha; volta a
  // falso só no `onSuccess` do guardar, depois de a resposta confirmada do
  // PUT já estar escrita na cache — mesmo padrão do `touched` do `ContaCard`
  // (`Perfil.tsx`, commit `d1d1b11`). Sem isto, um refetch em fundo do
  // catálogo (`staleTime: 0`; outra linha a gravar, ou o `ExtendTrialModal`
  // abaixo, que invalida este MESMO query key ao estender um trial) apanhado
  // a meio de uma edição de preço apaga o que foi escrito — e como o `dirty`
  // compara com `row`, volta a falso e o "Guardar" (`disabled={!dirty}`) fica
  // morto. Num ecrã de preços isto é dinheiro editado e perdido sem aviso.
  const [touched, setTouched] = useState(false)

  // Re-sincroniza os campos com o servidor só enquanto a linha está PRISTINE.
  useEffect(() => {
    if (touched) return
    setPriceStr(centsToEurInput(row.monthlyAmountCents))
    setActive(row.active)
  }, [row.monthlyAmountCents, row.active, touched])

  const putM = usePutAdminBillingCatalogModule({
    mutation: {
      onSuccess: (res) => {
        toast.success(`${row.label}: preço atualizado.`)
        // Escreve já a linha confirmada na cache — antes de sair de `touched`
        // — pela mesma razão do `ContaCard`: o `invalidateQueries` abaixo é
        // assíncrono, e sair de `touched` antes disto deixava o efeito de
        // sincronização correr com a lista ainda desatualizada.
        qc.setQueryData<BillingCatalogModule[]>(getAdminBillingCatalogQueryKey(), (old) =>
          old ? old.map((m) => (m.module === res.module ? { ...m, ...res } : m)) : old,
        )
        setTouched(false)
        qc.invalidateQueries({ queryKey: getAdminBillingCatalogQueryKey() })
        qc.invalidateQueries({ queryKey: getAdminBillingSubscriptionsQueryKey() })
      },
      onError: (error) => toast.error(getApiError(error, 'Não foi possível guardar o preço.')),
    },
  })

  const parsedCents = parseEurToCents(priceStr)
  const priceInvalid = parsedCents === null
  const dirty = (parsedCents !== null && parsedCents !== row.monthlyAmountCents) || active !== row.active

  const save = () => {
    if (parsedCents === null) {
      toast.error('Preço inválido.')
      return
    }
    putM.mutate({ module: row.module, data: { monthlyAmountCents: parsedCents, active } })
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 py-3.5 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 last:pb-0">
      <div className="sm:w-40 min-w-0 sm:pb-2">
        <div className="font-medium text-zinc-900 dark:text-white truncate">{row.label}</div>
        <div className="text-xs text-zinc-400 font-mono">{row.module}</div>
      </div>

      <div className="sm:w-44">
        <Input
          label="Preço /mês (€)"
          icon="euro"
          inputMode="decimal"
          value={priceStr}
          onChange={(e) => {
            setPriceStr(e.target.value)
            setTouched(true)
          }}
          aria-label={`Preço de ${row.label}`}
          className="tabular-nums"
        />
        {priceInvalid && <span className="block text-xs text-red-500 mt-1">Valor inválido.</span>}
      </div>

      <label className="flex items-center gap-2 sm:pb-2">
        <Toggle
          checked={active}
          onChange={(v: boolean) => {
            setActive(v)
            setTouched(true)
          }}
        />
        <span className="text-sm text-zinc-600 dark:text-zinc-300">{active ? 'Ativo' : 'Inativo'}</span>
      </label>

      <div className="sm:ml-auto sm:pb-1">
        <Button
          size="sm"
          variant="outline"
          icon="check"
          aria-label={`Guardar ${row.label}`}
          disabled={!dirty || priceInvalid || putM.isPending}
          onClick={save}
        >
          {putM.isPending ? 'A guardar…' : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}

export function CatalogEditor({ rows, loading }: { rows: BillingCatalogModule[]; loading: boolean }) {
  return (
    <Card className="p-5">
      <SectionTitle>Catálogo de preços dos módulos</SectionTitle>
      <p className="text-sm text-zinc-500 mb-2">
        O preço mensal de cada módulo. Alterar aqui afeta apenas subscrições novas — as existentes mantêm o preço já
        fixado no Stripe.
      </p>

      {loading ? (
        <div className="space-y-3 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-400 py-2">Sem módulos no catálogo.</p>
      ) : (
        <div>
          {rows.map((row) => (
            <CatalogRow key={row.module} row={row} />
          ))}
        </div>
      )}
    </Card>
  )
}
