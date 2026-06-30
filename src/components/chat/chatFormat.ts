// Helpers de formatação de datas para o chat (locale PT).

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return "Hoje";
  if (dayKey(d) === dayKey(yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

/** Cor estável (hex) a partir de uma string — para avatares. */
export function colorFromString(s: string): string {
  const palette = ["#2A6FDB", "#0EA5A4", "#7C3AED", "#DB2777", "#EA580C", "#0891B2", "#4F46E5", "#16A34A"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
