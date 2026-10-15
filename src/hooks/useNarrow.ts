import { useEffect, useState } from "react";

/** `true` abaixo de `px` de largura (por omissão 860, o ponto em que o construtor passa a um ecrã de cada vez). */
export function useNarrow(px = 860): boolean {
  const query = `(max-width: ${px - 0.02}px)`;
  const get = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const [narrow, setNarrow] = useState(get);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [query]);
  return narrow;
}
