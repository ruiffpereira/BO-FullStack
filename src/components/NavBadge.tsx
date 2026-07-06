/**
 * Badge de contagem partilhado ("pílula vermelha com número + cap 99+").
 * Antes existiam 4 cópias quase idênticas (NotificationBell, ChatLauncher,
 * ChatFab, NavBadge) só a variar tamanho/posicionamento — `CountBadge` é a
 * fonte única do visual+cap; cada consumidor passa o `size` e o `className`
 * de posicionamento próprios (absolute no ícone vs inline na sidebar).
 *
 * `NavBadge` (item de navegação da sidebar) é o export histórico usado pelo
 * `Shell.tsx` — mantido por cima do `CountBadge` porque o modo colapsado
 * (dot sem número, sobreposto ao ícone) é exclusivo deste componente e não
 * existe nos outros 3 sítios.
 */

type CountBadgeSize = "icon" | "nav" | "fab";

// Tamanhos observados nos 4 sítios antes da consolidação:
// - "icon": NotificationBell (sino) + ChatLauncher (topbar) — 16px, texto 10px.
// - "nav":  NavBadge expandido (sidebar) — 18px, texto 10px.
// - "fab":  ChatFab (botão flutuante, maior) — 20px, texto 11px, com anel.
const SIZE_CLASSES: Record<CountBadgeSize, string> = {
  icon: "min-w-[16px] h-4 px-0.5 text-[10px]",
  nav: "min-w-[18px] h-[18px] px-1 text-[10px]",
  fab: "min-w-[20px] h-5 px-1 text-[11px] border-2 border-white dark:border-zinc-950",
};

/**
 * Pílula vermelha de contagem, com o mesmo guard defensivo em todo o lado
 * (NaN/valores não-numéricos e <= 0 não renderizam nada) e o mesmo cap "99+".
 * `className` só deve trazer posicionamento (`absolute -top-... -right-...`
 * ou `ml-auto`) — o visual (cor, forma, tipografia) vive nos tamanhos acima.
 */
export function CountBadge({
  count,
  size = "icon",
  className = "",
}: {
  count: number;
  size?: CountBadgeSize;
  className?: string;
}) {
  if (!Number.isFinite(count) || count <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className={`rounded-full bg-red-500 text-white font-bold flex items-center justify-center leading-none ${SIZE_CLASSES[size]} ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Badge de não-lidas para itens de navegação (sidebar). Extraído do `NavItem`
 * (Shell.tsx) para poder testar-se isoladamente sem montar o Shell inteiro
 * (router + AuthContext + QueryClient).
 *
 * - Expandido (`collapsed=false`): usa o `CountBadge` partilhado (variante
 *   "nav"), encostado à direita do item (`ml-auto` — o botão do NavItem já é
 *   `flex`).
 * - Colapsado (`collapsed=true`, sidebar só-ícones): dot pequeno sobreposto
 *   ao canto do ícone, sem número — não há espaço/label para mostrar a
 *   contagem. Visual próprio, não é um `CountBadge` (não tem texto).
 */
export function NavBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (!Number.isFinite(count) || count <= 0) return null;

  if (collapsed) {
    return (
      <span
        aria-hidden="true"
        className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-900"
      />
    );
  }

  return <CountBadge count={count} size="nav" className="ml-auto" />;
}
