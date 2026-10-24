import { describe, expect, it } from 'vitest'
import { accessiblePaths } from '../../src/lib/menuAccess'
import { apptsOfDay, windowSeries } from '../../src/lib/dashboardAppts'

const base = { isAdmin: false, permissionNames: [] as string[], personalMailbox: false }

describe('ES-13 — Estatísticas no menu só de quem tem a folha', () => {
  it('o dono vê sempre o item', () => {
    const s = accessiblePaths({ ...base, isMember: false, can: () => false })
    expect(s.has('/estatisticas')).toBe(true)
  })
  it('um membro sem a folha estatisticas não o vê; com a folha vê', () => {
    const sem = accessiblePaths({ ...base, isMember: true, can: (k) => k === 'agenda' })
    expect(sem.has('/estatisticas')).toBe(false)
    expect(sem.has('/agenda')).toBe(true)
    const com = accessiblePaths({ ...base, isMember: true, can: (k) => k === 'estatisticas' })
    expect(com.has('/estatisticas')).toBe(true)
  })
})

describe('ES-15 — Marcações hoje e 14 dias', () => {
  it('as canceladas ficam fora de «Marcações hoje»', () => {
    const a = [
      { date: '2026-10-24', status: 'confirmed' },
      { date: '2026-10-24', status: 'cancelled' },
      { date: '2026-10-24', status: 'pending' },
      { date: '2026-10-23', status: 'confirmed' },
    ]
    expect(apptsOfDay(a, '2026-10-24')).toHaveLength(2)
  })
  it('o total é o dos 14 dias (não o dos últimos 7) e a variação compara 7 com 7', () => {
    const days = Array.from({ length: 14 }, (_, i) => `2026-10-${String(11 + i).padStart(2, '0')}`)
    const appts = [
      ...days.slice(0, 7).map((date) => ({ date, status: 'completed' })), // 7 nos primeiros 7 dias
      ...days.slice(7).flatMap((date) => [{ date, status: 'confirmed' }, { date, status: 'confirmed' }]), // 14 nos últimos 7
      { date: days[13], status: 'cancelled' }, // não conta
    ]
    const w = windowSeries(appts, days)
    expect(w.series).toHaveLength(14)
    expect(w.total).toBe(21)
    expect(w.delta).toBe(7)
  })
})
