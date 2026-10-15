/** Endereços que um botão pode abrir (CONTRATO §3.1 `dest.url`): https, http, mailto, tel, `/…` e `#…`. */
const SCHEME = /^(https?:\/\/|mailto:|tel:)\S+$/i;
const RELATIVE = /^[/#]\S*$/;

export const HREF_HINT = "Tem de começar por https://, http://, mailto: ou tel:";

export function isValidHref(href: string): boolean {
  const v = href.trim();
  return v.length > 0 && v === href && (SCHEME.test(v) || RELATIVE.test(v));
}
