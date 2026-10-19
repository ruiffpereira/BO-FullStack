import type { MailAddress } from "../gen/backoffice/types/MailAddress";

/**
 * Correio (B42, fases 5 e 6) — peças puras do lado do Backoffice. Quem decide é sempre a API (destinatários de uma
 * resposta, saneamento do HTML, permissões); aqui só há rótulos, formatação, textos de erro e o documento do iframe.
 */

export type MailFolder = "unread" | "all" | "archive" | "sent";

export const MAIL_FOLDERS: ReadonlyArray<{ id: MailFolder; label: string }> = [
  { id: "unread", label: "Por ler" },
  { id: "all", label: "Todas" },
  { id: "archive", label: "Arquivo" },
  { id: "sent", label: "Enviados" },
];

export function isMailFolder(v: unknown): v is MailFolder {
  return v === "unread" || v === "all" || v === "archive" || v === "sent";
}

export type MailMode = "new" | "reply" | "reply_all" | "forward";

/** Raiz da Caixa e deep-link de uma conversa (sino, ficha do cliente). */
export const CORREIO_PATH = "/correio";
export function mailThreadHref(mailboxId: string, threadId: string): string {
  return `${CORREIO_PATH}?caixa=${encodeURIComponent(mailboxId)}&conversa=${encodeURIComponent(threadId)}`;
}

/** Nome (ou, sem nome, o endereço) de um endereço. */
export function addressName(a?: MailAddress | null): string {
  return (a?.name || a?.email || "").trim();
}

/** "Maria Silva <maria@x.pt>" — para o cabeçalho de uma mensagem. */
export function addressFull(a?: MailAddress | null): string {
  if (!a) return "";
  const name = (a.name ?? "").trim();
  return name && a.email ? `${name} <${a.email}>` : name || a.email || "";
}

/** O 1.º da lista e "+N" para os restantes (linhas da lista). */
export function addressSummary(list?: MailAddress[] | null): string {
  if (!list || list.length === 0) return "";
  const first = addressName(list[0]);
  return list.length > 1 ? `${first} +${list.length - 1}` : first;
}

export function addressListFull(list?: MailAddress[] | null): string {
  return (list ?? []).map(addressFull).filter(Boolean).join(", ");
}

/** Hoje → hora; este ano → "12 out."; antes → dd/mm/aaaa. */
export function formatMailDate(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
  return d.toLocaleDateString("pt-PT");
}

export function formatBytes(n?: number | null): string {
  if (!n || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/**
 * Separa um campo de destinatários (vírgula, ponto e vírgula, espaço ou nova linha) em endereços válidos e inválidos.
 * Aceita "Nome <a@b.pt>": fica só o endereço. Só valida a forma — a API é que decide o resto.
 */
export function parseRecipients(raw: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  // «Nome <a@b.pt>» → «a@b.pt» (o nome pode ter espaços, por isso tira-se antes de partir).
  const flat = raw.replace(/[^,;\n<]*<([^>]*)>/g, " $1 ");
  for (const piece of flat.split(/[,;\n\s]+/)) {
    const p = piece.trim();
    if (!p) continue;
    if (!EMAIL_RE.test(p)) {
      invalid.push(p);
      continue;
    }
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(p);
  }
  return { valid, invalid };
}

// ── Erros (a API devolve o código em `error`, em minúsculas ou MAIÚSCULAS, e uma `message` PT) ──────────────

export const MAIL_MESSAGE_BY_CODE: Record<string, string> = {
  mail_not_configured: "O correio ainda não está configurado neste servidor.",
  mail_provider_error: "O servidor de correio não respondeu. Tenta de novo daqui a pouco.",
  mailbox_not_found: "Essa caixa já não está disponível.",
  MAIL_NO_RECIPIENTS: "Falta o destinatário.",
  MAIL_EMPTY: "O email está vazio — escreve uma mensagem ou junta um anexo.",
  MAIL_ORIGINAL_REQUIRED: "Falta o email a que isto responde.",
  MAIL_TOO_MANY_RECIPIENTS: "Demasiados destinatários (máximo 20).",
  ATTACHMENT_INVALID: "Há um anexo inválido (só fotos JPEG/PNG/WebP e PDF, até 5 anexos e 20 MB no total).",
  mailbox_address_unavailable: "Esse endereço não está disponível. Escolhe outro.",
  module_not_enabled: "Este negócio não tem o módulo Correio.",
  email_domain_not_found: "O negócio ainda não tem domínio de email configurado.",
  own_domain_not_supported: "As caixas em domínio próprio ainda não estão disponíveis.",
  business_mailbox_protected: "A caixa do negócio não se desactiva.",
  member_removed: "O membro desta caixa já não existe.",
  // Domínio próprio (fase 7)
  mx_conflict:
    "Este domínio já tem email noutro sítio: pôr a caixa na raiz cortava-lhe o email que já usa. Escolhe «contacto.<domínio>» ou «Sem caixa».",
  mx_not_ready:
    "O registo MX do domínio ainda não aponta para o servidor de correio. Põe o MX da tabela «Registos da caixa» no DNS, espera que propague e tenta de novo.",
  kind_required: "Há dois domínios: diz de qual falas (subdomínio da plataforma ou domínio próprio).",
  existing_email_required: "Diz se o negócio já tem email neste domínio antes de activar a caixa.",
  mailboxes_in_domain: "Há caixas activas neste domínio. Passa-as para o subdomínio da plataforma antes de o mudar ou remover.",
  mail_not_enabled: "A caixa de correio não está activada neste domínio.",
  own_domain_missing: "O negócio ainda não tem domínio próprio.",
  domain_not_verified: "O domínio ainda não está verificado — põe os registos no DNS e carrega em «Verificar agora».",
  MAIL_SENDING_PAUSED: "Os envios deste negócio estão pausados.",
  // Password da app
  app_password_owner_only: "Só o dono desta caixa pode gerir a password da app.",
  APP_PASSWORD_LIMIT: "Já há 5 passwords da app. Revoga-as e gera uma nova.",
  // Contactos e consentimento (fase 8)
  consent_confirmation_required: "Tens de confirmar que estes contactos deram consentimento.",
  too_many_rows: "O ficheiro tem demasiadas linhas (máximo 5 000).",
  customer_no_email: "Este cliente não tem email na ficha.",
  contact_blocked: "Este email está bloqueado (inválido ou queixa de spam) e não pode ser subscrito.",
  // Campanhas (fase 9)
  CAMPAIGNS_LOCKED: "As campanhas só abrem com o domínio do negócio e o subdomínio «news.» verificados.",
  CAMPAIGN_INCOMPLETE: "A campanha ainda está incompleta — falta assunto ou conteúdo.",
  NO_AUDIENCE: "Este segmento não apanha nenhum subscrito. Escolhe outro ou junta contactos.",
  INVALID_SCHEDULE: "Escolhe uma data entre daqui a 1 minuto e 1 ano.",
  INVALID_REFERENCE: "Há um produto ou serviço que já não existe no negócio. Tira-o ou escolhe outro.",
  CAMPAIGN_STATE: "Esta campanha já não está num estado em que isso se possa fazer. Atualiza a página.",
  CAMPAIGN_NOT_EDITABLE: "Só os rascunhos se editam. Duplica a campanha para mudar o conteúdo.",
  CAMPAIGN_NOT_CANCELLABLE: "Esta campanha já não se pode cancelar.",
  CAMPAIGN_TEST_LIMIT: "Atingiste o limite de testes de hoje. Tenta amanhã.",
  own_domain_required: "As campanhas precisam de um domínio próprio do negócio, não só do subdomínio da plataforma.",
};

/** Texto PT de um código de erro de correio (`mailboxError` da Equipa ou `error` de uma resposta); `null` se desconhecido. */
export function mailCodeMessage(code: unknown): string | null {
  return typeof code === "string" && MAIL_MESSAGE_BY_CODE[code] ? MAIL_MESSAGE_BY_CODE[code] : null;
}

/** 503 `mail_not_configured` → a Caixa mostra «Por configurar». */
export function isMailNotConfigured(error: unknown): boolean {
  const r = (error as any)?.response;
  return r?.status === 503 && r?.data?.error === "mail_not_configured";
}

export function mailErrorMessage(error: unknown, fallback = "Não foi possível concluir. Tenta novamente."): string {
  const data = (error as any)?.response?.data;
  const known = mailCodeMessage(data?.error) ?? mailCodeMessage(data?.code);
  if (known) return known;
  if (typeof data?.message === "string" && data.message) return data.message;
  if (typeof data?.error === "string" && data.error && !/^[A-Za-z_]+$/.test(data.error)) return data.error;
  return fallback;
}

// ── HTML recebido ────────────────────────────────────────────────────────────

/** `cid:abc@x`, `<abc@x>` e `abc@x` são o mesmo. */
export function normCid(cid?: string | null): string {
  return (cid ?? "").trim().replace(/^cid:/i, "").replace(/^<|>$/g, "").toLowerCase();
}

/**
 * Troca o `src` das imagens `data-cid` pelos anexos já resolvidos (data URI). O HTML já vem saneado da API; isto só
 * lhe põe as imagens inline. Sem DOMParser (ambiente exótico) devolve o HTML tal como veio.
 */
export function inlineCidImages(html: string, byCid: Record<string, string>): string {
  if (!html || typeof DOMParser === "undefined" || Object.keys(byCid).length === 0) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("img[data-cid]").forEach((img) => {
    const src = byCid[normCid(img.getAttribute("data-cid"))];
    if (src) img.setAttribute("src", src);
  });
  return doc.body.innerHTML;
}

/**
 * Documento do `iframe` (srcdoc). Defesa em profundidade para além do saneamento da API e do `sandbox` sem
 * `allow-scripts`: uma CSP que proíbe tudo menos estilos inline e imagens (`data:`; `https:` só depois do clique em
 * «Mostrar imagens»), e links a abrir noutro separador.
 */
export function buildMailFrameDoc(html: string, allowRemoteImages: boolean): string {
  const img = allowRemoteImages ? "data: https:" : "data:";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${img}; style-src 'unsafe-inline'"><base target="_blank"><style>html,body{margin:0;padding:0}body{font:14px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;background:#fff;word-wrap:break-word;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#2563eb}blockquote{margin:0 0 0 .5rem;padding-left:.75rem;border-left:3px solid #e4e4e7;color:#52525b}table{max-width:100%}pre{white-space:pre-wrap}</style></head><body>${html}</body></html>`;
}

/** `sandbox` do iframe do HTML recebido: NUNCA `allow-scripts`. `allow-same-origin` só serve para medir a altura. */
export const MAIL_FRAME_SANDBOX = "allow-same-origin allow-popups allow-popups-to-escape-sandbox";

// ── Endereço de um membro (convite / ficha) ──────────────────────────────────

const LOCAL_PART_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export const isValidLocalPart = (v: string): boolean => LOCAL_PART_RE.test(v);

/** Sugere a parte local do nome (1.º nome, sem acentos): «Ana Sá» → «ana». Só uma sugestão — a API é que valida e desambigua. */
export function suggestLocalPart(name: string): string {
  const first = name
    .trim()
    .split(/\s+/)[0]
    ?.normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  return first ?? "";
}

// ── Contactos e consentimento (fase 8) ───────────────────────────────────────

export type ContactStatus = "subscribed" | "unsubscribed" | "unsubscribed_by_user" | "bounced" | "complained";

/** Estado como o dono o vê: `bounced` e `complained` são ambos «Bloqueado» (a dica diz porquê). */
export const CONTACT_STATUS: Record<ContactStatus, { label: string; tone: "green" | "neutral" | "amber" | "red"; hint?: string }> = {
  subscribed: { label: "Subscrito", tone: "green" },
  unsubscribed: { label: "Não subscrito", tone: "neutral", hint: "Ainda não disse que sim." },
  unsubscribed_by_user: { label: "Anulou", tone: "amber", hint: "Anulou a subscrição." },
  bounced: { label: "Bloqueado", tone: "red", hint: "Email inválido." },
  complained: { label: "Bloqueado", tone: "red", hint: "Queixa de spam." },
};

export const CONTACT_SOURCE: Record<string, string> = {
  site: "Site",
  app: "App",
  balcao: "Balcão",
  importacao: "Importação",
  bo: "Backoffice",
};

export const CONTACT_SKIP_REASON: Record<string, string> = {
  invalid_email: "Email inválido",
  duplicate_in_file: "Repetido no ficheiro",
  already_unsubscribed: "Já anulou a subscrição",
  blocked: "Email bloqueado",
};

/** «vip, novo» → ["vip", "novo"] (sem vazios nem repetidos). */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw.split(/[,;|\n]+/)) {
    const v = t.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

/** Linhas de dados de um CSV (sem o cabeçalho nem linhas vazias) — só para o resumo antes de importar. */
export function countCsvRows(csv: string): number {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  return Math.max(0, lines.length - 1);
}

/** Descarrega texto como ficheiro (BOM à frente para o Excel ler os acentos). */
export function downloadTextFile(name: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
