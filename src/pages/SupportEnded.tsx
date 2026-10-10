import { Button } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { useAuth } from "../context/AuthContext";
import { SUPPORT_END_MESSAGES } from "../lib/supportSession";

/**
 * Ecrã final de uma sessão de suporte (expirou / foi terminada pela API / o
 * admin saiu). Standalone, sem Shell. "Ir para o meu backoffice" refaz o
 * arranque normal pelo cookie, que volta a ser o do admin.
 */
export function SupportEnded() {
  const { supportEnded, dismissSupportEnded } = useAuth();
  if (!supportEnded) return null;

  return (
    <div
      data-testid="support-ended-screen"
      className="min-h-[100dvh] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4"
    >
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-300">
          <Icon name="shield" className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">A sessão de suporte terminou</h1>
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-300">
          {SUPPORT_END_MESSAGES[supportEnded]}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => window.close()}>
            Fechar separador
          </Button>
          <Button onClick={dismissSupportEnded}>Ir para o meu backoffice</Button>
        </div>
      </div>
    </div>
  );
}
