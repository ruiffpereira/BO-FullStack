import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiError } from "../../lib/apiError";
import { Icon } from "../../ui/icons.jsx";
import { Card, Button, Badge, Modal, EmptyState, Avatar } from "../../ui/ui.jsx";
import { usePagination, Pagination } from "../../components/Pagination";
import { useTeamAccess } from "../../hooks/useTeamAccess";
import { useGetGymPrograms, getGymProgramsQueryKey } from "../../gen/backoffice/hooks/useGetGymPrograms.js";
import { patchGymProgramsIdActive } from "../../gen/backoffice/hooks/usePatchGymProgramsIdActive.js";
import { deleteGymProgramsId } from "../../gen/backoffice/hooks/useDeleteGymProgramsId.js";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { GuardButton, GuardIconButton } from "../../components/GuardButton";
import { useGetGymPlanos } from "../../gen/backoffice/hooks/useGetGymPlanos.js";
import { postGymPlanosIdAssign } from "../../gen/backoffice/hooks/usePostGymPlanosIdAssign.js";
import type { GymPlano } from "../../gen/backoffice/types/GymPlano.js";
import type { GymProgram } from "../../gen/backoffice/types/GymProgram.js";
import { DatePicker } from "../../components/DatePicker";
import { useGetUsersMe } from "../../gen/backoffice/hooks/useGetUsersMe.js";
import { getCmsEntries } from "../../gen/backoffice/hooks/useGetCmsEntries.js";
import { buildPlanPrintHtml, printPlan } from "../../lib/planPdf";
import { Cliente, addDaysISO, fmtBR, formatDate, todayISO, weeksBetweenISO } from "./drafts";
import { useGymGroups } from "./groups";
import { ProgressoTab } from "./ProgressoTab";
import { ClientePlanoEditorLoader } from "./ClientePlanoEditor";

// Modal: escolher um Plano para atribuir ao cliente (cria/define programa ativo).
function AtribuirPlanoModal({ open, customer, planos, onClose, onSaved }: {
  open: boolean
  customer: Cliente | null
  planos: GymPlano[]
  onClose: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [sel, setSel] = useState<string | null>(null)
  const [de, setDe] = useState(todayISO())
  const [ate, setAte] = useState(addDaysISO(todayISO(), 84))
  useEffect(() => { if (open) { setSel(null); setDe(todayISO()); setAte(addDaysISO(todayISO(), 84)) } }, [open])
  const erroData = ate < de
  const assign = useMutation({
    mutationFn: () => postGymPlanosIdAssign(sel!, { customerId: customer!.customerId, startDate: de || null, endDate: ate || null }),
    // Chave gerada pelo Kubb — garante que continua a bater com a query de leitura
    // (useGetGymPrograms) mesmo que o path mude no spec. Prefixo: invalida também
    // as leituras filtradas por customerId.
    onSuccess: () => { qc.invalidateQueries({ queryKey: getGymProgramsQueryKey() }); toast.success('Plano atribuído ao cliente'); onSaved(); onClose() },
    onError: (e) => toast.error(getApiError(e)),
  })
  return (
    <Modal open={open} onClose={onClose} width="max-w-lg" title="Atribuir plano" subtitle={customer ? `Cliente: ${customer.name}` : ''}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><GuardButton icon="check" isLoading={assign.isPending} disabled={!sel || erroData} onClick={() => assign.mutate()}>Guardar</GuardButton></>}>
      <div className="space-y-2 max-h-[42vh] overflow-y-auto -mx-1 px-1">
        {planos.length === 0 && <p className="text-sm text-zinc-400 text-center py-6">Sem planos. Cria um plano primeiro na tab “Planos”.</p>}
        {planos.map((p) => {
          const livre = p.mode === 'free'
          const dias = (p.workouts ?? []).length
          return (
            <button key={p.id} onClick={() => setSel(p.id)} className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${sel === p.id ? 'border-accent bg-accent/[0.04]' : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
              <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon name="calendar" className="w-[18px] h-[18px]" /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{p.name}</p><p className="text-xs text-zinc-400">{dias} dia{dias === 1 ? '' : 's'} · {livre ? 'Dias livres' : 'Semana fixa'}</p></div>
              {sel === p.id && <Icon name="check" className="w-4 h-4 text-accent ml-auto" />}
            </button>
          )
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">Duração do plano</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-xs text-zinc-400 mb-1.5">Início</span><DatePicker value={de} max={ate || undefined} onChange={setDe} /></label>
          <label className="block"><span className="block text-xs text-zinc-400 mb-1.5">Fim</span><DatePicker value={ate} min={de || undefined} onChange={setAte} /></label>
        </div>
        {erroData
          ? <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><Icon name="ban" className="w-3.5 h-3.5" />A data de fim tem de ser depois do início.</p>
          : <p className="text-xs text-zinc-400 mt-1.5">{weeksBetweenISO(de, ate)} semanas · {fmtBR(de)} → {fmtBR(ate)}</p>}
      </div>
    </Modal>
  )
}

// Detalhe do cliente: cabeçalho com ações + dashboard de progresso.
function ClienteProgresso({ customer, onBack, onAtribuir, onEditar }: { customer: Cliente; onBack: () => void; onAtribuir?: () => void; onEditar: () => void }) {
  const { data: programsData, isLoading } = useGetGymPrograms({ customerId: customer.customerId }, { query: { enabled: !!customer.customerId } })
  const qc = useQueryClient()
  const programs = ((programsData ?? []) as GymProgram[])
  const active = programs.find((p) => p.active)
  const { data: me } = useGetUsersMe()
  const { colorOf } = useGymGroups()
  // Entradas CMS do PDF: carregadas LAZY no clique (nunca no mount — seria
  // puxar o CMS inteiro do tenant a cada abertura de perfil de cliente).
  const cmsEntriesRef = useRef<Awaited<ReturnType<typeof getCmsEntries>> | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<GymProgram | null>(null)

  const patchActive = useMutation({
    mutationFn: (id: string) => patchGymProgramsIdActive(id),
    onSuccess: () => {
      // Chave gerada pelo Kubb — garante que continua a bater com a query de
      // leitura (useGetGymPrograms) mesmo que o path mude no spec. Prefixo:
      // invalida também as leituras filtradas por customerId.
      qc.invalidateQueries({ queryKey: getGymProgramsQueryKey() })
      toast.success('Plano ativado')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const deleteProgram = useMutation({
    mutationFn: (id: string) => deleteGymProgramsId(id),
    onSuccess: () => {
      // Chave gerada pelo Kubb — garante que continua a bater com a query de
      // leitura (useGetGymPrograms) mesmo que o path mude no spec. Prefixo:
      // invalida também as leituras filtradas por customerId.
      qc.invalidateQueries({ queryKey: getGymProgramsQueryKey() })
      setDeleteConfirm(null)
      toast.success('Programa eliminado')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const handlePdf = async () => {
    if (!active) return
    // Busca única e cacheada das entradas CMS (para as chaves gym.pdf.*);
    // se a rede falhar, o PDF sai com os fallbacks PT — nunca bloqueia.
    if (cmsEntriesRef.current === null) {
      try { cmsEntriesRef.current = await getCmsEntries() } catch { cmsEntriesRef.current = [] }
    }
    const entries = cmsEntriesRef.current ?? []
    const t = (key: string): string => entries.find((e) => e.key === key)?.value ?? ''
    const html = buildPlanPrintHtml({
      program: active,
      customerName: customer.name,
      tenant: { name: me?.name, logoUrl: me?.logoUrl },
      colorOf,
      t,
    })
    printPlan(html)
  }
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"><Icon name="chevronLeft" className="w-4 h-4" />Voltar aos clientes</button>

      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar name={customer.name} size={56} />
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white truncate">{customer.name}</h2>
            <p className="text-sm text-zinc-500">
              {active && active.startDate
                ? `Plano ${formatDate(active.startDate)} → ${formatDate(active.endDate) || 'atual'}`
                : 'Plano e progresso do cliente'}
            </p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
            {active ? <Badge tone="blue" dot>{active.name}</Badge> : <Badge tone="amber" dot>Sem plano</Badge>}
            {active && <Button variant="outline" size="sm" icon="edit" onClick={onEditar}>Editar plano</Button>}
            {active && <Button variant="outline" size="sm" icon="printer" onClick={handlePdf}>PDF do plano</Button>}
            {onAtribuir && <GuardButton variant={active ? 'ghost' : 'outline'} size="sm" icon="calendar" onClick={onAtribuir}>{active ? 'Mudar plano' : 'Atribuir plano'}</GuardButton>}
          </div>
        </div>
      </Card>

      {/* Secção Programas */}
      <Card>
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Programas</h3>
        </div>
        <div>
          {isLoading ? (
            <div className="p-5 text-center text-sm text-zinc-400">A carregar programas…</div>
          ) : programs.length === 0 ? (
            <div className="p-5 text-sm text-zinc-400">Nenhum programa atribuído ainda.</div>
          ) : (
            <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {programs.map((prog) => (
                <div key={prog.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-900 dark:text-white">{prog.name}</p>
                      {prog.active && <Badge tone="blue" dot>Ativo</Badge>}
                    </div>
                    <p className="text-xs text-zinc-400">{formatDate(prog.startDate)} → {formatDate(prog.endDate)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {!prog.active && (
                      <GuardButton
                        size="sm"
                        variant="ghost"
                        icon="check"
                        onClick={() => patchActive.mutate(prog.id)}
                        isLoading={patchActive.isPending}
                        title="Tornar este programa ativo"
                      >
                        Tornar ativo
                      </GuardButton>
                    )}
                    {!prog.active && (
                      <GuardIconButton
                        icon="trash"
                        label="Eliminar programa"
                        className="hover:text-red-500"
                        onClick={() => setDeleteConfirm(prog)}
                      />
                    )}
                    {prog.active && (
                      <span title="Primeiro torna outro programa ativo para podes eliminar este" className="text-xs text-zinc-400">Não é possível eliminar o programa ativo</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ProgressoTab customerId={customer.customerId} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Eliminar programa?"
        description={`Queres eliminar o programa "${deleteConfirm?.name}"? O histórico de treinos registados mantém-se, mas o programa e os seus treinos prescritos desaparecem.`}
        confirmLabel="Eliminar"
        isPending={deleteProgram.isPending}
        onConfirm={() => {
          if (deleteConfirm) deleteProgram.mutate(deleteConfirm.id)
        }}
      />
    </div>
  )
}

// Lista de clientes (T2.5 densidade, batch Ginásio §5/§6): antes cada
// `ClienteCard` disparava 2 pedidos próprios (programas ativos + stats de
// adesão) — com uma centena de clientes isso são ~200 pedidos só para
// desenhar a lista. A linha densa mostra só o que é barato (avatar + nome,
// já disponível de `useGetCustomers`); "Plano ativo"/adesão deixam de
// aparecer na lista e passam a carregar só quando se abre o cliente
// (`ClienteProgresso` já busca o programa ativo próprio, e `ProgressoTab` os
// stats) — lista leve, detalhe pesado só on-demand.
export function ClientesTab({ customers }: { customers: Cliente[] }) {
  const [sel, setSel] = useState<Cliente | null>(null)
  const [atribuir, setAtribuir] = useState<Cliente | null>(null)
  const [editing, setEditing] = useState<Cliente | null>(null)
  // Equipa (B41 2b): atribuir um plano escreve no programa do cliente E usa um plano — a API exige `ginasio.clientes`
  // e `ginasio.treinos` (edit). O `clientes` já é o da página (GuardButton); o `treinos` vê-se aqui.
  const canAssign = useTeamAccess().can('ginasio.treinos', 'edit')
  const [q, setQ] = useState('')
  const { data: planosData } = useGetGymPlanos()
  const planos = (planosData ?? []) as GymPlano[]

  const filtered = useMemo(
    () => customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())),
    [customers, q],
  )
  const pg = usePagination(filtered, { resetKey: q })

  // "Editar plano" → editor do programa ativo do cliente em ecrã cheio.
  if (editing) {
    return <ClientePlanoEditorLoader customer={editing} onClose={() => setEditing(null)} onAtribuir={canAssign ? () => { setEditing(null); setAtribuir(editing) } : undefined} />
  }

  if (sel) {
    return (
      <>
        <ClienteProgresso customer={sel} onBack={() => setSel(null)} onAtribuir={canAssign ? () => setAtribuir(sel) : undefined} onEditar={() => setEditing(sel)} />
        <AtribuirPlanoModal open={!!atribuir} customer={atribuir} planos={planos} onClose={() => setAtribuir(null)} onSaved={() => {}} />
      </>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" className="w-[18px] h-[18px]" /></span>
          <input
            aria-label="Procurar cliente"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Procurar cliente…"
            className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-transparent rounded-lg text-sm pl-10 pr-3 py-2 focus:bg-white dark:focus:bg-zinc-900 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none text-zinc-800 dark:text-zinc-100"
          />
        </div>
        <p className="text-sm text-zinc-500 sm:ml-auto">{filtered.length} cliente{filtered.length === 1 ? '' : 's'}</p>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon="user" title="Sem clientes" desc="Os clientes aparecem aqui para lhes atribuíres planos e veres o progresso." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="search" title="Sem resultados" desc="Não há clientes que correspondam à pesquisa." />
      ) : (
        <div>
          <Card className="overflow-hidden divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {pg.pageItems.map((c) => (
              <div
                key={c.customerId}
                role="button"
                tabIndex={0}
                onClick={() => setSel(c)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(c) } }}
                className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 cursor-pointer"
              >
                <Avatar name={c.name} size={36} />
                <p className="font-medium text-zinc-900 dark:text-white truncate flex-1 min-w-0">{c.name}</p>
                {canAssign && <GuardButton variant="ghost" size="sm" icon="calendar" onClick={(e?: any) => { e?.stopPropagation(); setAtribuir(c) }}>Atribuir plano</GuardButton>}
                <Icon name="chevronRight" className="w-4 h-4 text-zinc-300 shrink-0" />
              </div>
            ))}
          </Card>
          <Pagination {...pg} />
        </div>
      )}
      <AtribuirPlanoModal open={!!atribuir} customer={atribuir} planos={planos} onClose={() => setAtribuir(null)} onSaved={() => {}} />
    </div>
  )
}
