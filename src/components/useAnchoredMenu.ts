import { useState, useRef, useEffect, useLayoutEffect, type CSSProperties } from 'react'

/**
 * Mecânica partilhada de um menu flutuante ancorado a um elemento (botão/input).
 * Usado pelo `Combobox` e pelo `CmsCombo` — uma única fonte de verdade para o
 * posicionamento, para o bug "dropdown cortado dentro da modal / aberto fora do
 * ecrã" não voltar a divergir entre componentes.
 *
 * O que faz:
 * - Devolve `anchorRef` (pôr no botão/input) e `menuRef` (pôr no `<div>` do menu).
 * - O menu deve ser renderizado num **portal** (`document.body`) com o `style`
 *   devolvido — `position: fixed`, alinhado ao anchor, largura = largura do anchor.
 * - **Flip-up**: abre para baixo; se não houver espaço suficiente por baixo e
 *   houver mais por cima, abre para cima (deixa de ficar cortado no fim da página).
 * - Reposiciona em scroll/resize (inclui scroll dentro de modais).
 * - Fica invisível até medir a altura real do menu (evita o "salto" inicial).
 *
 * `open` controla a visibilidade; `deps` deve incluir o que muda a altura do menu
 * (ex.: número de itens) para reposicionar quando o conteúdo muda.
 */
export function useAnchoredMenu<T extends HTMLElement>(open: boolean, deps: unknown[] = []) {
  const anchorRef = useRef<T | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const update = () => {
    const a = anchorRef.current?.getBoundingClientRect()
    if (!a) return
    const menuH = menuRef.current?.offsetHeight ?? 300
    const spaceBelow = window.innerHeight - a.bottom
    const openUp = spaceBelow < menuH + 8 && a.top > spaceBelow
    setPos({
      top: openUp ? Math.max(8, a.top - menuH - 4) : a.bottom + 4,
      left: a.left,
      width: a.width,
    })
  }

  // Posiciona ao abrir + reposiciona em scroll/resize; limpa ao fechar.
  useEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    update()
    const onMove = () => update()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Mede a altura real assim que o menu está no DOM (e quando o conteúdo muda),
  // para decidir cima/baixo com a altura certa.
  useLayoutEffect(() => {
    if (open) update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ...deps])

  const style: CSSProperties = {
    position: 'fixed',
    top: pos?.top ?? 0,
    left: pos?.left ?? 0,
    width: pos?.width,
    zIndex: 100,
    visibility: pos ? 'visible' : 'hidden',
  }

  return { anchorRef, menuRef, style }
}
