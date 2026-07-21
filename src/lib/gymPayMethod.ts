/**
 * Métodos de pagamento do ginásio.
 * Padrão: tokens EN no modelo, labels PT na UI.
 */

export type PayMethod = 'cash' | 'mbway' | 'card' | 'transfer' | 'multibanco';

export const PAY_METHODS: Array<{ value: PayMethod; label: string }> = [
  { value: 'cash', label: 'Numerário' },
  { value: 'mbway', label: 'MB Way' },
  { value: 'card', label: 'Cartão' },
  { value: 'transfer', label: 'Transferência' },
  // Token próprio — referência Multibanco NÃO é transferência nem cartão;
  // fundir métodos distintos perderia informação histórica.
  { value: 'multibanco', label: 'Multibanco' },
];

/**
 * Resolver token de método → label PT.
 * Compat: dados históricos pré-migração (literais PT antigos) são devolvidos tal-e-qual.
 */
export function payMethodLabel(method?: string | null): string {
  if (!method) return '—';
  const found = PAY_METHODS.find((m) => m.value === method);
  if (found) return found.label;
  // Fallback: dados históricos antigos (nunca devem chegar aqui pós-migração)
  return method;
}
