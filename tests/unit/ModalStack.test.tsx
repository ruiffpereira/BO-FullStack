import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button, Modal } from '../../src/ui/ui.jsx'
import { useState } from 'react'

/**
 * Testa a stack de modais: quando múltiplos modais estão abertos,
 * um Esc fecha apenas o de cima, não todos de uma vez.
 */

function MultiModalTest() {
  const [modal1Open, setModal1Open] = useState(false)
  const [modal2Open, setModal2Open] = useState(false)

  return (
    <>
      <button onClick={() => setModal1Open(true)}>Abrir Modal 1</button>
      <Modal
        open={modal1Open}
        onClose={() => setModal1Open(false)}
        title="Modal 1"
      >
        <p>Conteúdo do Modal 1</p>
        <button onClick={() => setModal2Open(true)}>Abrir Modal 2</button>
      </Modal>

      <Modal
        open={modal2Open}
        onClose={() => setModal2Open(false)}
        title="Modal 2"
      >
        <p>Conteúdo do Modal 2</p>
      </Modal>
    </>
  )
}

describe('ModalStack', () => {
  it('abre dois modais e um Esc fecha apenas o de cima', async () => {
    render(<MultiModalTest />)

    // Abrir Modal 1
    const openBtn = screen.getByText('Abrir Modal 1')
    fireEvent.click(openBtn)
    expect(screen.getByText('Conteúdo do Modal 1')).toBeInTheDocument()

    // Abrir Modal 2 (por cima do Modal 1)
    const openBtn2 = screen.getByText('Abrir Modal 2')
    fireEvent.click(openBtn2)
    expect(screen.getByText('Conteúdo do Modal 2')).toBeInTheDocument()

    // Pressionar Escape — deve fechar apenas o Modal 2
    fireEvent.keyDown(window, { key: 'Escape' })

    // Modal 2 desaparece
    expect(screen.queryByText('Conteúdo do Modal 2')).not.toBeInTheDocument()

    // Modal 1 permanece aberto
    expect(screen.getByText('Conteúdo do Modal 1')).toBeInTheDocument()

    // Segundo Escape fecha o Modal 1
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('Conteúdo do Modal 1')).not.toBeInTheDocument()
  })

  it('restaura o foco ao fechar um modal', async () => {
    const { container } = render(<MultiModalTest />)

    const openBtn = screen.getByText('Abrir Modal 1')
    openBtn.focus()
    expect(document.activeElement).toBe(openBtn)

    fireEvent.click(openBtn)
    expect(screen.getByText('Conteúdo do Modal 1')).toBeInTheDocument()

    // O foco deve estar no painel do modal (tabIndex={-1} + focus())
    const modalPanel = container.querySelector('[role="dialog"]')
    expect(modalPanel).toBeInTheDocument()

    // Fechar o modal (via Escape)
    fireEvent.keyDown(window, { key: 'Escape' })

    // O foco deve ser restaurado ao botão original
    expect(document.activeElement).toBe(openBtn)
  })
})
