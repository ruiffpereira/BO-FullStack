// Cópia do construtor de zips da API (API-FullStack/tests/helpers/zip.ts): o e2e não importa código de outro repo — no CI
// esse ficheiro carrega como CommonJS e os named exports partem ("Named export 'buildZip' not found").
import { deflateRawSync } from "zlib";

/**
 * Construtor mínimo de zips para os testes (sem dependências). Deixa forjar o que um zip hostil forja: tamanho declarado
 * diferente do real, bit de encriptação, método de compressão desconhecido, nomes em bytes crus, ligações simbólicas.
 */
export interface ZipEntrySpec {
  /** String (ASCII) ou bytes crus. */
  name: string | Buffer;
  data?: Buffer;
  /** 0 = stored, 8 = deflate (por omissão). Qualquer outro valor grava os bytes tal e qual (método desconhecido). */
  method?: number;
  /** Bits de flags (bit 0 = encriptado). */
  flags?: number;
  /** Tamanho descomprimido a DECLARAR (por omissão o real). */
  declaredSize?: number;
  /** Atributos externos (4 bytes); com `madeBy` 0x0314 e modo 0o120000 << 16 = ligação simbólica. */
  externalAttr?: number;
  madeBy?: number;
}

const TABLE = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZip(entries: ZipEntrySpec[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.isBuffer(e.name) ? e.name : Buffer.from(e.name, "latin1");
    const raw = e.data ?? Buffer.alloc(0);
    const method = e.method ?? 8;
    const comp = method === 8 ? deflateRawSync(raw) : raw;
    const crc = crc32(raw);
    const usize = e.declaredSize ?? raw.length;
    const flags = e.flags ?? 0;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(flags, 6);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(33, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(usize, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    const local = Buffer.concat([lh, name, comp]);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(e.madeBy ?? 20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(flags, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(33, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(usize, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(e.externalAttr ?? 0, 38);
    ch.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([ch, name]));
    locals.push(local);
    offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, eocd]);
}

/** Atalho: zip com `manifest.json`, `content.json` e ficheiros de `media/`. */
export function buildImportZip(parts: { manifest: unknown; content: unknown; media?: Record<string, Buffer>; extra?: ZipEntrySpec[] }): Buffer {
  return buildZip([
    { name: "manifest.json", data: Buffer.from(JSON.stringify(parts.manifest)) },
    { name: "content.json", data: Buffer.from(JSON.stringify(parts.content)) },
    ...Object.entries(parts.media ?? {}).map(([n, data]) => ({ name: `media/${n}`, data })),
    ...(parts.extra ?? []),
  ]);
}
