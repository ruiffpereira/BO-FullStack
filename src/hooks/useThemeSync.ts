import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useGetUsersMe, getUsersMeQueryKey } from "../gen/backoffice/hooks/useGetUsersMe";
import { usePutUsersMe } from "../gen/backoffice/hooks/usePutUsersMe";
import { getApiError } from "../lib/apiError";
import {
  type Theme,
  computeInitialTheme,
  persistTheme,
  clearStoredTheme,
  resolveThemeFromServer,
  getSystemPrefersDark,
} from "../lib/uiTheme";

/**
 * Fonte única do tema aplicado da app (T3.4, `.design/shell-nav-perfil/TASKS.md`
 * — última tarefa da Fase 3, resolve "o tema começa sempre dark noutro
 * browser"). Único consumidor: `App.tsx` (passa `theme`/`toggleTheme` ao
 * `Shell`/`Login`/`Signup`/`SetupPassword`, exatamente como antes do T3.4).
 *
 * Precedência final: **servidor > localStorage > sistema**.
 *
 * 1. **1.º paint / sem sessão ainda resolvida:** init lazy de
 *    `computeInitialTheme()` (localStorage > sistema > dark, T0.1) — não há
 *    como saber a preferência do servidor antes de autenticar, por isso não
 *    se espera pela rede (sem flash; o script anti-flash do `index.html`
 *    aplica a mesma prioridade ainda antes disto montar).
 * 2. **Depois de autenticar, quando `GET /users/me` resolve:** o efeito
 *    abaixo aplica a preferência do SERVIDOR, sobrepondo-se ao palpite
 *    inicial — `"light"`/`"dark"` ganham sempre (mesmo que o localStorage/
 *    sistema deste browser dissessem outra coisa) e ficam gravados no
 *    localStorage (auto-corrige o anti-flash do PRÓXIMO reload, fechando o
 *    ciclo); `"system"` (ou ausente) segue o sistema atual e LIMPA o
 *    localStorage (`clearStoredTheme`) — nunca grava a string `"system"` (o
 *    anti-flash só conhece light/dark; sem a chave cai no sistema sozinho).
 * 3. **Mudar tema:** `toggleTheme` (ícone do topbar, só light/dark) aplica
 *    localmente + localStorage de imediato (sem esperar rede) e, SE
 *    autenticado, grava no servidor (`PUT /users/me`) — reversão otimista se
 *    o PUT falhar (offline/402/etc, toast de aviso). Sem sessão (ecrãs de
 *    Login/Signup/SetupPassword) fica só local, como antes do T3.4.
 *
 * O 3.º passo do `PreferenciasCard` (`/perfil`, T3.3, com a opção extra
 * `"system"`) grava direto por `usePutUsersMe` — MESMA query key
 * (`getUsersMeQueryKey()`), por isso o `invalidateQueries` que já faz
 * entrega o valor novo a este hook via a cache partilhada do React Query
 * (sem precisar de um contexto dedicado nem duplicar o helper de reversão):
 * o efeito abaixo reage e aplica o tema visual em qualquer página, não só em
 * `/perfil`. Nunca diverge do topbar porque os dois escrevem no MESMO
 * `uiTheme` do MESMO utilizador.
 *
 * Sem loop: aplicar o mesmo valor outra vez (ex.: depois do próprio
 * `toggleTheme` invalidar a query e o refetch devolver o que já se tinha
 * aplicado otimisticamente) é idempotente — `setTheme`/`persistTheme` com o
 * valor já corrente não mudam nada visível.
 */
export function useThemeSync() {
  const [theme, setTheme] = useState<Theme>(computeInitialTheme);
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const updateMe = usePutUsersMe();

  const { data: meData } = useGetUsersMe({ query: { enabled: isAuthenticated } });

  useEffect(() => {
    if (!isAuthenticated || !meData) return;
    const serverTheme = meData.uiTheme;
    const next = resolveThemeFromServer(serverTheme, getSystemPrefersDark());
    setTheme(next);
    if (serverTheme === "light" || serverTheme === "dark") persistTheme(next);
    else clearStoredTheme();
  }, [isAuthenticated, meData?.uiTheme]);

  // NOTA: usa `theme` capturado por closure (não o updater funcional do
  // `setTheme`) de propósito — o React StrictMode invoca updaters funcionais
  // DUAS VEZES em dev para apanhar impurezas, e o `mutate` aqui dentro é um
  // efeito lateral (POST de rede); um handler de clique normal não sofre
  // esse double-invoke, por isso o PUT dispara exatamente uma vez por toggle.
  const toggleTheme = useCallback(() => {
    const prev = theme;
    const next: Theme = prev === "dark" ? "light" : "dark";
    setTheme(next);
    persistTheme(next);
    if (isAuthenticated) {
      updateMe.mutate(
        { data: { uiTheme: next } },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getUsersMeQueryKey() });
          },
          onError: (error) => {
            // Reversão otimista: o PUT falhou (offline/402/etc) — volta ao
            // tema anterior tanto no estado aplicado como no localStorage.
            persistTheme(prev);
            setTheme(prev);
            toast.error(getApiError(error, "Não foi possível guardar a preferência de tema."));
          },
        },
      );
    }
  }, [theme, isAuthenticated, updateMe, qc]);

  return { theme, toggleTheme };
}
