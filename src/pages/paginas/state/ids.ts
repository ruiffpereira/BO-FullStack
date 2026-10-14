/**
 * Geradores de ids do construtor (CONTRATO §5.2): UUID para entidades (página, bloco, pasta, item de
 * página) e nanoid(10) para componentes e itens de lista. Sem dependências: `crypto` do browser.
 */

const NANO_ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** UUID v4. `randomUUID` só existe em contexto seguro (https/localhost) — daí o fallback. */
export function newEntityId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Id curto (`[A-Za-z0-9_-]`, 10 caracteres por omissão) para componentes e `_id` de itens de lista. */
export function newShortId(size = 10): string {
  const bytes = randomBytes(size);
  let id = "";
  for (let i = 0; i < size; i++) id += NANO_ALPHABET[bytes[i] & 63];
  return id;
}
