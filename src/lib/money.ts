/**
 * Formatação de moeda única na app.
 * Usando pt-PT locale: "123,45 €"
 */
const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

export const fmtEur = (n: number): string => eur.format(n ?? 0)
