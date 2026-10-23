import type { MailAddress } from "../gen/backoffice/types/MailAddress";

/**
 * Correio (B42, fases 5 e 6) — peças puras do lado do Backoffice. Quem decide é sempre a API (destinatários de uma
 * resposta, saneamento do HTML, permissões); aqui só há rótulos, formatação, textos de erro e o documento do iframe.
 */

/** Onde: Entrada (`all`, o que a API chama a caixa de entrada), Arquivo e Enviados. */
export type MailFolder = "all" | "archive" | "sent";

export const MAIL_FOLDERS: ReadonlyArray<{ id: MailFolder; label: string }> = [
  { id: "all", label: "Entrada" },
  { id: "archive", label: "Arquivo" },
  { id: "sent", label: "Enviados" },
];

export function isMailFolder(v: unknown): v is MailFolder {
  return v === "all" || v === "archive" || v === "sent";
}

/** Estado, ortogonal à pasta (CR-26): o filtro Todas / Por ler / Lidas. Só vale na Entrada e no Arquivo. */
export type MailStatus = "all" | "unread" | "read";

export const MAIL_STATUSES: ReadonlyArray<{ id: MailStatus; label: string; param: string | null }> = [
  { id: "all", label: "Todas", param: null },
  { id: "unread", label: "Por ler", param: "por-ler" },
  { id: "read", label: "Lidas", param: "lidas" },
];

/** A pasta e o filtro a partir do URL (`?pasta=` e `?filtro=`). `?pasta=unread` (links antigos) = Entrada + Por ler. */
export function parseMailView(params: URLSearchParams): { folder: MailFolder; status: MailStatus } {
  const pasta = params.get("pasta");
  const folder: MailFolder = isMailFolder(pasta) ? pasta : "all";
  const filtro = params.get("filtro");
  const fromParam = MAIL_STATUSES.find((s) => s.param && s.param === filtro)?.id;
  const status: MailStatus = fromParam ?? (pasta === "unread" ? "unread" : "all");
  // Enviados nunca tem filtro (o que enviámos nunca está «por ler»).
  return { folder, status: folder === "sent" ? "all" : status };
}

export const mailStatusParam = (status: MailStatus): string | null => MAIL_STATUSES.find((s) => s.id === status)?.param ?? null;

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

// ── Caixa pessoal vs. caixa do negócio (B55) ─────────────────────────────────

/** Sem folha: a caixa PESSOAL de cada um (membro, dono, admin) é sempre sua — só o billing a pode bloquear. */
export const NO_LEAF: readonly string[] = [];
/** A folha que manda nas escritas: `correio.caixa` na caixa do negócio (`suporte@`); nenhuma na pessoal. */
export const mailLeaf = (personal?: boolean): string | readonly string[] => (personal ? NO_LEAF : "correio.caixa");

/** Rótulo de uma caixa no selector: «Suporte · suporte.tifas@…» / «Pessoal · tiago.tifas@…». */
export function mailboxLabel(kind: string | undefined, address: string | undefined): string {
  return `${kind === "business" ? "Suporte" : "Pessoal"} · ${address ?? ""}`;
}

// ── Erros (a API devolve `{ error: <texto PT>, code: <CÓDIGO> }`; os códigos chegam em MAIÚSCULAS — as chaves são MAIÚSCULAS;
// um `mailboxError` da Equipa em minúsculas casa por `toUpperCase()`) ────────

export const MAIL_MESSAGE_BY_CODE: Record<string, string> = {
  MAIL_NOT_CONFIGURED: "O correio ainda não está configurado neste servidor.",
  MAIL_PROVIDER_ERROR: "O servidor de correio não respondeu. Tenta de novo daqui a pouco.",
  MAILBOX_NOT_FOUND: "Essa caixa já não está disponível.",
  MAIL_NO_RECIPIENTS: "Falta o destinatário.",
  MAIL_EMPTY: "O email está vazio — escreve uma mensagem ou junta um anexo.",
  MAIL_ORIGINAL_REQUIRED: "Falta o email a que isto responde.",
  MAIL_TOO_MANY_RECIPIENTS: "Demasiados destinatários (máximo 20).",
  ATTACHMENT_INVALID: "Há um anexo inválido (só fotos JPEG/PNG/WebP e PDF, até 5 anexos e 20 MB no total).",
  MAILBOX_ADDRESS_UNAVAILABLE: "Não foi possível escolher um endereço livre para esta caixa.",
  MAILBOX_ERROR: "A caixa não se criou agora; cria-se sozinha daqui a pouco.",
  BUSINESS_MAILBOX_MISSING: "A caixa do negócio ainda não existe.",
  MODULE_NOT_ENABLED: "Este negócio não tem o módulo Correio.",
  EMAIL_DOMAIN_NOT_FOUND: "O negócio ainda não tem domínio de email configurado.",
  OWN_DOMAIN_NOT_SUPPORTED: "As caixas em domínio próprio ainda não estão disponíveis.",
  BUSINESS_MAILBOX_PROTECTED: "Esta caixa não se desactiva por aqui.",
  MEMBER_REMOVED: "O membro desta caixa já não existe.",
  // Domínio próprio (fase 7)
  MX_CONFLICT:
    "Este domínio já tem email noutro sítio: pôr a caixa na raiz cortava-lhe o email que já usa. Escolhe «contacto.<domínio>» ou «Sem caixa».",
  MX_NOT_READY:
    "O registo MX do domínio ainda não aponta para o servidor de correio. Põe o MX da tabela «Registos da caixa» no DNS, espera que propague e tenta de novo.",
  KIND_REQUIRED: "Há dois domínios: diz de qual falas (endereço da plataforma ou domínio próprio).",
  EMAIL_CODE_TAKEN: "Esse código já é de outro negócio. Escolhe outro.",
  EMAIL_CODE_RESERVED: "Esse código está reservado. Escolhe outro.",
  EMAIL_CODE_ADDRESS_TAKEN: "Algum endereço com o código novo já está ocupado: a mudança foi recusada e nada mudou.",
  PLATFORM_DOMAIN_MISSING: "O domínio de email da plataforma ainda não está configurado no servidor.",
  EXISTING_EMAIL_REQUIRED: "Diz se o negócio já tem email neste domínio antes de activar a caixa.",
  MAILBOXES_IN_DOMAIN: "Há caixas activas neste domínio. Passa-as para o endereço da plataforma antes de o mudar ou remover (o endereço da plataforma de um negócio com caixas também não se remove).",
  MAIL_NOT_ENABLED: "A caixa de correio não está activada neste domínio.",
  OWN_DOMAIN_MISSING: "O negócio ainda não tem domínio próprio.",
  DOMAIN_NOT_VERIFIED: "O domínio ainda não está verificado — põe os registos no DNS e carrega em «Verificar agora».",
  MAIL_SENDING_PAUSED: "Os envios deste negócio estão pausados.",
  // Password da app
  APP_PASSWORD_OWNER_ONLY: "Só o dono desta caixa pode gerir a password da app.",
  TEAM_OWNER_ONLY: "Só o dono desta caixa pode gerir a password da app.",
  APP_PASSWORD_LIMIT: "Já há 5 passwords da app. Revoga-as e gera uma nova.",
  // Contactos e consentimento (fase 8)
  CONSENT_CONFIRMATION_REQUIRED: "Tens de confirmar que estes contactos deram consentimento.",
  TOO_MANY_ROWS: "O ficheiro tem demasiadas linhas (máximo 5 000).",
  CUSTOMER_NO_EMAIL: "Este cliente não tem email na ficha.",
  CONTACT_BLOCKED: "Este email está bloqueado (inválido ou queixa de spam) e não pode ser subscrito.",
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
  OWN_DOMAIN_REQUIRED: "As campanhas precisam de um domínio próprio do negócio, não só do endereço da plataforma.",
};

/** Texto PT de um código de erro de correio (`mailboxError` da Equipa ou `error` de uma resposta); `null` se desconhecido. */
export function mailCodeMessage(code: unknown): string | null {
  if (typeof code !== "string") return null;
  return MAIL_MESSAGE_BY_CODE[code] ?? MAIL_MESSAGE_BY_CODE[code.toUpperCase()] ?? null;
}

/** 503 `MAIL_NOT_CONFIGURED` → a Caixa mostra «Por configurar». */
export function isMailNotConfigured(error: unknown): boolean {
  const r = (error as any)?.response;
  return r?.status === 503 && r?.data?.code === "MAIL_NOT_CONFIGURED";
}

export function mailErrorMessage(error: unknown, fallback = "Não foi possível concluir. Tenta novamente."): string {
  const data = (error as any)?.response?.data;
  const known = mailCodeMessage(data?.code);
  if (known) return known;
  if (typeof data?.error === "string" && data.error) return data.error;
  if (typeof data?.message === "string" && data.message) return data.message;
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
