import type { ReactNode } from 'react'
import { Button } from '../ui/ui.jsx'
import { useWriteGuard } from '../hooks/useWriteGuard'

type GuardButtonProps = {
  children?: ReactNode
  disabled?: boolean
  title?: string
  className?: string
  /**
   * Classe do wrapper (`<span>`) que segura o tooltip no estado bloqueado (um botão
   * desativado tem `pointer-events:none`, por isso o title dele não dispara no hover
   * — o wrapper trata disso). Default `inline-flex`; para CTAs full-width passa
   * `block w-full` (ou `flex w-full`) para o botão continuar a esticar.
   */
  wrapperClassName?: string
  [key: string]: unknown
}

/**
 * Botão de ESCRITA com write-guard de platform billing (roadmap 0.4 / dívida T5).
 *
 * Drop-in do `Button` partilhado (`src/ui/ui.jsx`): em operação normal comporta-se
 * exatamente como `Button`. Quando a subscrição da plataforma do tenant está
 * read-only (`useWriteGuard().readOnly` — pagamento em atraso além do grace /
 * cancelada), o botão fica **desativado** e expõe o motivo (title no hover + aria)
 * a apontar o tenant para a Faturação — feedback PROATIVO, antes de bater na API.
 * O interceptor 402 do `AuthContext` mantém-se como backstop reativo (defesa em
 * profundidade).
 *
 * Usar SÓ em CTAs que fazem POST/PUT/PATCH/DELETE de gestão. NÃO usar para
 * navegação, leitura, logout, o portal de pagamento (Stripe) nem o chat de suporte.
 */
export function GuardButton({
  disabled,
  title,
  wrapperClassName = 'inline-flex',
  ...rest
}: GuardButtonProps) {
  const { readOnly, message } = useWriteGuard()

  if (!readOnly) {
    return <Button disabled={disabled} title={title} {...rest} />
  }

  // Bloqueado: botão desativado + motivo no title/aria. O wrapper carrega o title
  // para o tooltip aparecer no hover (o botão desativado não recebe eventos de rato).
  // `disabled:pointer-events-none` (ui.jsx) faz o hit-testing nativo resolver o
  // clique para este span — sem stopPropagation, o clique atravessava para
  // qualquer ancestral clicável (ex.: a linha da lista de Cobranças que abre a
  // ficha do cliente). Mantém o botão inerte em qualquer contexto.
  return (
    <span className={wrapperClassName} title={message} onClick={(e) => e.stopPropagation()}>
      <Button {...rest} disabled aria-disabled="true" title={message} />
    </span>
  )
}
