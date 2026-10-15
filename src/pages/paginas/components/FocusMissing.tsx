/**
 * "Ver onde" (F15): depois de a UI abrir a página/bloco/parte, o componente e as linhas das listas,
 * foca a caixa do campo em falta (`data-fp` = path do campo, `data-fl` = língua). As aberturas
 * acontecem em efeitos dos próprios editores, por isso procura-se durante um instante.
 */
import { useEffect } from "react";
import { useBuilder } from "../state/store";

export function FocusMissing() {
  const { state } = useBuilder();
  const { focus, reveal } = state;
  useEffect(() => {
    if (!focus || reveal === null) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const go = () => {
      const el = [...document.querySelectorAll<HTMLElement>("[data-fp]")].find((n) => n.dataset.fp === focus.path && n.dataset.fl === focus.locale);
      if (el) {
        if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
        el.focus({ preventScroll: true });
      } else if (++tries < 20) timer = setTimeout(go, 50);
    };
    timer = setTimeout(go, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);
  return null;
}
