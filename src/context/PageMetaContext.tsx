import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

interface PageMetaContextValue {
  subtitle: string | null
  setSubtitle: (subtitle: string | null) => void
}

// Valor por omissão (fora do `PageMetaProvider`, ex.: uma página renderizada
// isolada num teste unitário sem o `Shell`): `setSubtitle` é um no-op, para
// `usePageSubtitle` continuar segura de chamar em qualquer lado sem exigir o
// provider — só o Topbar real (dentro do Shell) alguma vez lê um `subtitle`
// que não seja `null`.
const noopSetSubtitle = () => {}
const PageMetaContext = createContext<PageMetaContextValue>({ subtitle: null, setSubtitle: noopSetSubtitle })

/**
 * Canal único página→topbar (T-topbar-subtitle): o Shell embrulha as páginas
 * neste provider; o `Topbar` (Shell.tsx) lê `subtitle` daqui para o mostrar
 * por baixo do título (que continua path-based, `resolveTopbarTitle`). As
 * páginas publicam o seu subtítulo via `usePageSubtitle` — nunca escrevem
 * directamente no contexto.
 */
export function PageMetaProvider({ children }: { children: ReactNode }) {
  const [subtitle, setSubtitle] = useState<string | null>(null)
  const value = useMemo(() => ({ subtitle, setSubtitle }), [subtitle])
  return <PageMetaContext.Provider value={value}>{children}</PageMetaContext.Provider>
}

export function usePageMeta(): PageMetaContextValue {
  return useContext(PageMetaContext)
}

/**
 * Publica o subtítulo da página ativa para o Topbar. Chamar com uma string
 * define o subtítulo enquanto o componente estiver montado (e limpa-o ao
 * desmontar/mudar); chamar com `null`/`undefined`/`""` significa "esta página
 * não tem nada a dizer" e **não mexe** no valor partilhado — nem ao montar
 * nem ao desmontar.
 *
 * Este "não mexer" é deliberado: algumas páginas compõem-se de um contentor
 * que só decide título/ações (ex. `FinanceiroPage`) e uma sub-vista que tem o
 * seu próprio subtítulo dinâmico (ex. `Despesas`, montada como tab lá dentro).
 * Se o contentor limpasse sempre o subtítulo para as tabs sem texto próprio,
 * a ordem de efeitos do React (filhos disparam antes do pai) faria o efeito
 * do pai apagar o subtítulo que o filho acabou de definir no mesmo commit.
 * Ignorar valores "vazios" no set (mas continuar a limpar no cleanup do
 * ÚLTIMO valor realmente definido por este componente) evita essa corrida.
 */
export function usePageSubtitle(subtitle: string | null | undefined) {
  const { setSubtitle } = usePageMeta()
  useEffect(() => {
    if (!subtitle) return
    setSubtitle(subtitle)
    return () => setSubtitle(null)
  }, [subtitle, setSubtitle])
}
