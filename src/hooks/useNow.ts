import { useEffect, useState } from "react";

/** Ticks every minute so "agora"-style markers (linha do tempo atual, saudação, etc.)
 * acompanham a hora real sem um relógio de segundos ruidoso. Partilhado entre
 * o Dashboard e a grelha da Agenda. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
