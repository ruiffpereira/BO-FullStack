/**
 * Funcionalidades escondidas por decisão do dono (2026-09-28): "ainda não quero
 * implementado". O código fica todo — só deixa de aparecer. Voltar a mostrar =
 * pôr a `true` (e reverter os testes que afirmam que está escondido).
 *
 * - `signup`: o registo self-serve de tenants (`/signup` e o link "Criar conta"
 *   no Login). Com `false`, `/signup` redirecciona para o login.
 * - `googleCalendar`: só o cartão "Google Calendar" em Admin → Integrações.
 *   A API continua com os endpoints; só a UI sai. O cartão do feed `.ics` da
 *   Agenda (subscrever no telemóvel) é independente e aparece sempre (B59 F8).
 */
export const FEATURES = {
  signup: false,
  googleCalendar: false,
} as const;
