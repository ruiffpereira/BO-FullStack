import { useMemo, createContext, useContext, type ReactNode } from "react";
import { useGetGymMuscleGroups } from "../../gen/backoffice/hooks/useGetGymMuscleGroups.js";
import type { GymMuscleGroup } from "../../gen/backoffice/types/GymMuscleGroup.js";

// Paleta de cores sugeridas para grupos/subgrupos — usada para dar uma cor
// aleatória por defeito ao criar (o user pode sempre mudar).
// Paleta igual à do protótipo do ginásio.
const GROUP_COLORS = [
  '#2A6FDB', '#1F8A5B', '#D97757', '#E6B450', '#7C5CDB', '#0EA5A4', '#64748B', '#DB2777',
]
export const randomColor = () => GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]

// Grupo muscular (de topo ou subgrupo via parentId).
export type Group = GymMuscleGroup

// ── Contexto dos grupos musculares (carregados da API) ───────────────────────
type GymGroupsCtx = {
  groups: Group[]
  topGroups: Group[]
  names: string[]
  colorOf: (name?: string) => string
  subGroupsOf: (groupName?: string) => Group[]
}
const GymGroupsContext = createContext<GymGroupsCtx>({
  groups: [], topGroups: [], names: [], colorOf: () => '#6B7280', subGroupsOf: () => [],
})
export const useGymGroups = () => useContext(GymGroupsContext)

export function GymGroupsProvider({ children }: { children: ReactNode }) {
  const { data } = useGetGymMuscleGroups()
  const groups = useMemo(() => (data ?? []) as Group[], [data])
  const value = useMemo<GymGroupsCtx>(() => {
    const colorMap = new Map(groups.map((g) => [g.name, g.color]))
    const topGroups = groups.filter((g) => !g.parentId)
    const idByName = new Map(groups.map((g) => [g.name, g.muscleGroupId]))
    const childrenByParent = new Map<string, Group[]>()
    for (const g of groups) {
      if (!g.parentId) continue
      const arr = childrenByParent.get(g.parentId) ?? []
      arr.push(g)
      childrenByParent.set(g.parentId, arr)
    }
    return {
      groups,
      topGroups,
      names: topGroups.map((g) => g.name),
      colorOf: (name?: string) => (name && colorMap.get(name)) || '#6B7280',
      subGroupsOf: (groupName?: string) => {
        const id = groupName ? idByName.get(groupName) : undefined
        return id ? childrenByParent.get(id) ?? [] : []
      },
    }
  }, [groups])
  return <GymGroupsContext.Provider value={value}>{children}</GymGroupsContext.Provider>
}
