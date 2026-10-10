import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { useAuth } from "../context/AuthContext";
import { postAdminUsersUseridImpersonate } from "../gen/backoffice/hooks/usePostAdminUsersUseridImpersonate.js";
import { supportEntryErrorMessage } from "../lib/supportSession";

/**
 * `/suporte/entrar/:userId` — separador aberto pelo "Entrar como" do Admin.
 * Standalone (fora do Shell e do guard de rotas do Shell). Corre com a sessão
 * do ADMIN (bootstrap normal pelo cookie), pede o token de suporte e passa a
 * agir como o tenant (`startImpersonation`). Em erro, mostra a mensagem da API
 * (por `code`) e um botão para fechar o separador.
 *
 * O pedido só dispara UMA vez (cada chamada fica no registo de auditoria do
 * tenant) — o `useRef` sobrevive ao duplo-efeito do StrictMode.
 */
export function SupportEntry({ userId }: { userId: string }) {
  const { supportSession, startImpersonation } = useAuth();
  const navigate = useNavigate();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supportSession) {
      // Já estamos numa sessão de suporte (ex.: reload): nada a pedir.
      navigate("/", { replace: true });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    postAdminUsersUseridImpersonate(userId)
      .then((res) => startImpersonation(res))
      .catch((err) => setError(supportEntryErrorMessage(err)));
  }, [userId, supportSession, startImpersonation, navigate]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        {error ? (
          <>
            <div className="mx-auto w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-300">
              <Icon name="alertTriangle" className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Não foi possível entrar na conta
            </h1>
            <p role="alert" className="text-sm text-zinc-600 dark:text-zinc-300">
              {error}
            </p>
            <Button variant="outline" onClick={() => window.close()}>
              Fechar separador
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-zinc-300 border-t-accent animate-spin dark:border-zinc-700 dark:border-t-accent" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">A iniciar a sessão de suporte…</p>
          </>
        )}
      </div>
    </div>
  );
}
