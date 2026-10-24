import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeltaPill } from '../../src/components/financeiro/kit'

describe('FI-20 / ES-14 — crescimento contra zero mostra «novo»', () => {
  it('null (período anterior a zero) → «novo», nunca 100 %', () => {
    render(<DeltaPill delta={null} />)
    expect(screen.getByText('novo')).toBeInTheDocument()
    expect(screen.queryByText(/100/)).not.toBeInTheDocument()
  })
  it('undefined e 0 não mostram nada; um valor mostra a percentagem', () => {
    const { container, rerender } = render(<DeltaPill delta={undefined} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<DeltaPill delta={0} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<DeltaPill delta={12.5} />)
    expect(screen.getByText('12.5%')).toBeInTheDocument()
  })
})
