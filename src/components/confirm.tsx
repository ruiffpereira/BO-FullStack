import { useEffect, useState } from "react";
import { Modal, Button, Input } from "../ui/ui.jsx";
import { ConfirmDialog } from "./ConfirmDialog";

// ----------------------------------------------------------------------------
// Diálogos da app (confirm / prompt) — substituem os popups nativos do
// dispositivo (window.confirm / window.prompt) por um Modal consistente.
// API imperativa estilo `toast`: `await confirmDialog({...})` / `await promptDialog({...})`.
// O <ConfirmHost/> é montado uma vez (main.tsx), tal como o <Toaster/>.
// UM só sistema de confirmação: `confirmDialog` desenha o `ConfirmDialog` (components/ConfirmDialog.tsx), cujo botão é
// um `GuardButton` — logo o write-guard (EQ-03: billing read-only / membro só-ver) vale aqui como no uso declarativo.
// Confirmar é uma ESCRITA; para perguntas que não escrevem usa-se `promptDialog` ou um Modal próprio.
// ----------------------------------------------------------------------------

type ConfirmOpts = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: string;
  /** Folha(s) da árvore que mandam na escrita (ver `GuardButton`); omitida = a da rota actual. */
  leaf?: string | readonly string[];
  /** `false` = o confirmar não é uma escrita de gestão (ex.: revogar o acesso do suporte): sem write-guard. Por omissão guarda (EQ-03). */
  guard?: boolean;
};

type PromptOpts = {
  title: string;
  message?: React.ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
};

type State =
  | { open: false }
  | { open: true; kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { open: true; kind: "prompt"; opts: PromptOpts; resolve: (v: string | null) => void };

let listeners: Array<(s: State) => void> = [];
let current: State = { open: false };
const emit = () => listeners.forEach((l) => l(current));
const setState = (s: State) => {
  current = s;
  emit();
};

/** Pergunta sim/não. Resolve `true` se confirmado, `false` se cancelado/fechado. */
export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => setState({ open: true, kind: "confirm", opts, resolve }));
}

/** Pede um valor de texto. Resolve a string introduzida, ou `null` se cancelado. */
export function promptDialog(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => setState({ open: true, kind: "prompt", opts, resolve }));
}

export function ConfirmHost() {
  const [s, setS] = useState<State>(current);
  const [val, setVal] = useState("");

  useEffect(() => {
    const l = (next: State) => {
      setS(next);
      if (next.open && next.kind === "prompt") setVal(next.opts.defaultValue ?? "");
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  if (!s.open) return null;

  if (s.kind === "confirm") {
    const { opts, resolve } = s;
    const close = (result: boolean) => {
      resolve(result);
      setState({ open: false });
    };
    return (
      <ConfirmDialog
        open
        title={opts.title}
        description={opts.message ?? null}
        confirmLabel={opts.confirmLabel ?? (opts.danger ? "Eliminar" : "Confirmar")}
        cancelLabel={opts.cancelLabel}
        variant={opts.danger ? "danger" : "primary"}
        leaf={opts.leaf}
        guard={opts.guard}
        onClose={() => close(false)}
        onConfirm={() => close(true)}
      />
    );
  }

  // Pedir um valor não é uma confirmação de escrita: Modal próprio, sem guard.
  const { opts, resolve } = s;
  const close = (result: string | null) => {
    resolve(result);
    setState({ open: false });
  };
  const promptDisabled = opts.required && !val.trim();

  return (
    <Modal
      open
      onClose={() => close(null)}
      title={opts.title}
      subtitle={typeof opts.message === "string" ? opts.message : undefined}
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(null)}>
            {opts.cancelLabel ?? "Cancelar"}
          </Button>
          <Button variant="primary" icon="check" disabled={!!promptDisabled} onClick={() => close(val)}>
            {opts.confirmLabel ?? "Confirmar"}
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        label={opts.label}
        value={val}
        onChange={(e: any) => setVal(e.target.value)}
        onKeyDown={(e: any) => {
          if (e.key === "Enter" && !promptDisabled) close(val);
        }}
        placeholder={opts.placeholder}
      />
    </Modal>
  );
}
