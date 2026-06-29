import { useEffect, useState } from "react";
import { Modal, Button, Input } from "../ui/ui.jsx";

// ----------------------------------------------------------------------------
// Diálogos da app (confirm / prompt) — substituem os popups nativos do
// dispositivo (window.confirm / window.prompt) por um Modal consistente.
// API imperativa estilo `toast`: `await confirmDialog({...})` / `await promptDialog({...})`.
// O <ConfirmHost/> é montado uma vez (main.tsx), tal como o <Toaster/>.
// ----------------------------------------------------------------------------

type ConfirmOpts = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: string;
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

  const isPrompt = s.kind === "prompt";
  const opts = s.opts;
  const cancelVal = isPrompt ? null : false;
  const close = (result: boolean | string | null) => {
    (s.resolve as (v: any) => void)(result);
    setState({ open: false });
  };
  const danger = !isPrompt && (s.opts as ConfirmOpts).danger;
  const promptDisabled = isPrompt && (s.opts as PromptOpts).required && !val.trim();
  const confirmValue: boolean | string = isPrompt ? val : true;

  return (
    <Modal
      open
      onClose={() => close(cancelVal)}
      title={opts.title}
      subtitle={typeof opts.message === "string" ? opts.message : undefined}
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(cancelVal)}>
            {opts.cancelLabel ?? "Cancelar"}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            icon={danger ? "trash" : "check"}
            disabled={!!promptDisabled}
            onClick={() => close(confirmValue)}
          >
            {opts.confirmLabel ?? (danger ? "Eliminar" : "Confirmar")}
          </Button>
        </>
      }
    >
      {isPrompt ? (
        <Input
          autoFocus
          label={(opts as PromptOpts).label}
          value={val}
          onChange={(e: any) => setVal(e.target.value)}
          onKeyDown={(e: any) => {
            if (e.key === "Enter" && !promptDisabled) close(val);
          }}
          placeholder={(opts as PromptOpts).placeholder}
        />
      ) : typeof opts.message !== "string" && opts.message ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-300">{opts.message}</div>
      ) : null}
    </Modal>
  );
}
