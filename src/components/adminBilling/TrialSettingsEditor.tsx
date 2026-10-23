import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, Button, Input, SectionTitle } from "../../ui/ui.jsx";
import { getApiError } from "../../lib/apiError";
import { useGetAdminBillingSettings, getAdminBillingSettingsQueryKey } from "../../gen/backoffice/hooks/useGetAdminBillingSettings";
import { usePutAdminBillingSettings } from "../../gen/backoffice/hooks/usePutAdminBillingSettings";

// ── Período experimental (dias) ──────────────────────────────────────────────

/**
 * Dias de período experimental atribuídos a NOVOS signups self-serve
 * (`GET`/`PUT /admin/billing/settings`). Substitui o antigo `TRIAL_DAYS=14`
 * hardcoded na API. Alterar aqui afeta APENAS registos novos a partir daqui —
 * os trials já em curso mantêm o fim que já tinham (nunca se retroage).
 */
export function TrialSettingsEditor() {
  const qc = useQueryClient()
  const { data, isLoading } = useGetAdminBillingSettings()
  const [daysStr, setDaysStr] = useState('14')
  // Mesmo padrão do `touched` do `CatalogRow` acima / `ContaCard`
  // (`Perfil.tsx`, commit `d1d1b11`): protege uma edição por guardar de um
  // refetch em fundo (`staleTime: 0`) — sem isto o `dirty` abaixo (que
  // compara com `data`) voltava a falso e o "Guardar" ficava morto.
  const [touched, setTouched] = useState(false)

  // Re-sincroniza o input com o servidor só enquanto está PRISTINE (mesmo padrão do CatalogRow).
  useEffect(() => {
    if (data && !touched) setDaysStr(String(data.trialDays))
  }, [data?.trialDays, touched])

  const putM = usePutAdminBillingSettings({
    mutation: {
      onSuccess: (res) => {
        toast.success(`Período experimental atualizado — ${res?.trialDays} dias.`)
        // Escreve já a resposta confirmada na cache — antes de sair de
        // `touched` — pela mesma razão do `ContaCard`.
        qc.setQueryData(getAdminBillingSettingsQueryKey(), (old: typeof data) => ({ ...old, ...res }))
        setTouched(false)
        qc.invalidateQueries({ queryKey: getAdminBillingSettingsQueryKey() })
      },
      onError: (error) => toast.error(getApiError(error, 'Não foi possível guardar o período experimental.')),
    },
  })

  const days = Number(daysStr)
  const valid = daysStr.trim() !== '' && Number.isInteger(days) && days >= 0 && days <= 90
  const dirty = data ? days !== data.trialDays : false

  const save = () => {
    if (!valid) return
    putM.mutate({ data: { trialDays: days } })
  }

  return (
    <Card className="p-5">
      <SectionTitle>Período experimental</SectionTitle>
      <p className="text-sm text-zinc-500 mb-3">
        Dias de período experimental atribuídos a NOVOS registos self-serve. Alterar aqui afeta só registos novos —
        os trials já em curso mantêm o fim já definido.
      </p>

      {isLoading ? (
        <div className="h-10 w-44 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <div className="flex items-end gap-3">
          <div className="w-44">
            <Input
              label="Período experimental (dias)"
              aria-label="Período experimental (dias)"
              type="number"
              min={0}
              max={90}
              value={daysStr}
              onChange={(e) => {
                setDaysStr(e.target.value)
                setTouched(true)
              }}
              className="tabular-nums"
            />
            {!valid && <span className="block text-xs text-red-500 mt-1">Introduz um número entre 0 e 90.</span>}
          </div>
          <Button
            size="sm"
            variant="outline"
            icon="check"
            aria-label="Guardar período experimental"
            disabled={!dirty || !valid || putM.isPending}
            onClick={save}
          >
            {putM.isPending ? 'A guardar…' : 'Guardar'}
          </Button>
        </div>
      )}
    </Card>
  )
}
