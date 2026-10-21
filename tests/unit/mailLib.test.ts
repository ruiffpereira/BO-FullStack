import { describe, it, expect } from "vitest";
import {
  buildMailFrameDoc,
  inlineCidImages,
  isMailNotConfigured,
  mailErrorMessage,
  MAIL_FRAME_SANDBOX,
  mailStatusParam,
  mailThreadHref,
  parseMailView,
  normCid,
  parseRecipients,
  suggestLocalPart,
  isValidLocalPart,
  formatMailDate,
  parseTags,
  countCsvRows,
  CONTACT_STATUS,
} from "../../src/lib/mail";
import { notificationHref } from "../../src/lib/notificationTarget";
import { getApiError } from "../../src/lib/apiError";
import { mailboxErrorMessage, teamErrorMessage } from "../../src/lib/teamAccess";
import { allowedSubitems, leafForPath, memberSubitems } from "../../src/lib/navigation";

describe("Correio — destinatários", () => {
  it("separa por vírgula, ponto e vírgula, espaço e linha; tira duplicados e aceita «Nome <a@b.pt>»", () => {
    const r = parseRecipients("a@x.pt, B@x.pt; a@x.pt\nMaria <m@x.pt>  lixo");
    expect(r.valid).toEqual(["a@x.pt", "B@x.pt", "m@x.pt"]);
    expect(r.invalid).toEqual(["lixo"]);
  });
  it("vazio não tem nada", () => {
    expect(parseRecipients("  ")).toEqual({ valid: [], invalid: [] });
  });
});

describe("Correio — iframe do HTML recebido", () => {
  it("o sandbox nunca tem allow-scripts", () => {
    expect(MAIL_FRAME_SANDBOX).not.toContain("allow-scripts");
  });
  it("a CSP só deixa estilos inline e imagens data: — https: só depois do clique", () => {
    const blocked = buildMailFrameDoc("<p>x</p>", false);
    expect(blocked).toContain("default-src 'none'");
    expect(blocked).toContain("img-src data:;");
    expect(blocked).not.toContain("https:");
    expect(blocked).not.toMatch(/script-src/);
    expect(buildMailFrameDoc("<p>x</p>", true)).toContain("img-src data: https:;");
  });
  it("as imagens cid: são trocadas pelos anexos (data URI) e o resto fica como veio", () => {
    const html = `<p>olá</p><img data-cid="<Logo@X>" src="placeholder"><img data-cid="outra" src="p2">`;
    const out = inlineCidImages(html, { [normCid("cid:logo@x")]: "data:image/png;base64,AAA" });
    expect(out).toContain('src="data:image/png;base64,AAA"');
    expect(out).toContain('src="p2"');
  });
  it("normCid ignora cid:, <> e maiúsculas", () => {
    expect(normCid("cid:<ABC@x>")).toBe("abc@x");
  });
});

describe("Correio — erros em PT", () => {
  const err = (status: number, error: string, message?: string) => ({ response: { status, data: { error, message } } });
  it("códigos da API (em `error`) → texto PT", () => {
    expect(mailErrorMessage(err(400, "MAIL_NO_RECIPIENTS"))).toBe("Falta o destinatário.");
    expect(mailErrorMessage(err(400, "ATTACHMENT_INVALID"))).toMatch(/anexo inválido/);
    expect(mailErrorMessage(err(502, "mail_provider_error"))).toMatch(/não respondeu/);
    expect(mailErrorMessage(err(404, "mailbox_not_found"))).toMatch(/caixa/);
  });
  it("código desconhecido cai na `message` da API, depois no fallback", () => {
    expect(mailErrorMessage(err(500, "xpto", "Texto da API"))).toBe("Texto da API");
    expect(mailErrorMessage({}, "fallback")).toBe("fallback");
  });
  it("503 mail_not_configured é «Por configurar»", () => {
    expect(isMailNotConfigured(err(503, "mail_not_configured"))).toBe(true);
    expect(isMailNotConfigured(err(502, "mail_provider_error"))).toBe(false);
  });
  it("getApiError e teamErrorMessage também conhecem os códigos do correio", () => {
    expect(getApiError(err(400, "MAIL_EMPTY"))).toMatch(/vazio/);
    expect(teamErrorMessage(err(409, "module_not_enabled"), "x")).toMatch(/módulo Correio/);
  });
  it("mailboxError da Equipa → PT (desconhecido = mensagem genérica)", () => {
    expect(mailboxErrorMessage("mailbox_address_unavailable")).toMatch(/endereço livre/);
    expect(mailboxErrorMessage("mail_provider_error")).toMatch(/não respondeu/);
    expect(mailboxErrorMessage("coisa_estranha")).toMatch(/Não foi possível criar o endereço/);
  });
});

describe("Correio — endereço do membro", () => {
  it("sugere o 1.º nome sem acentos", () => {
    expect(suggestLocalPart("  Ana Sá Pereira ")).toBe("ana");
    expect(suggestLocalPart("João")).toBe("joao");
    expect(suggestLocalPart("")).toBe("");
  });
  it("valida a parte local", () => {
    expect(isValidLocalPart("ana.sa")).toBe(true);
    expect(isValidLocalPart("Ana")).toBe(false);
    expect(isValidLocalPart("a b")).toBe(false);
    expect(isValidLocalPart("")).toBe(false);
  });
});

describe("Correio — datas e deep-links", () => {
  const now = new Date("2026-10-19T15:00:00");
  it("hoje mostra a hora; este ano o dia/mês; antes a data completa", () => {
    expect(formatMailDate("2026-10-19T09:05:00", now)).toMatch(/09:05/);
    expect(formatMailDate("2026-03-02T09:05:00", now)).toMatch(/2/);
    expect(formatMailDate("2025-03-02T09:05:00", now)).toMatch(/2025/);
    expect(formatMailDate(undefined)).toBe("");
  });
  it("notificação type:email leva à conversa (ou à caixa numa rajada)", () => {
    expect(notificationHref({ type: "email", data: { mailboxId: "b 1", threadId: "t1" } })).toBe("/correio?caixa=b%201&conversa=t1");
    expect(notificationHref({ type: "email", data: { mailboxId: "b1" } })).toBe("/correio?caixa=b1");
    expect(notificationHref({ type: "email", data: null })).toBe("/correio");
    expect(mailThreadHref("b1", "t1")).toBe("/correio?caixa=b1&conversa=t1");
  });
});

describe("Correio — navegação e permissões", () => {
  it("o submenu do Correio tem a Caixa atrás de VIEW_EMAIL e da folha correio.caixa", () => {
    expect(allowedSubitems("/correio", () => true).map((s) => s.label)).toEqual(["Caixa", "Campanhas", "Contactos"]);
    expect(allowedSubitems("/correio", () => false)).toEqual([]);
    expect(memberSubitems("/correio", (k) => k === "correio.caixa")).toHaveLength(1);
    expect(memberSubitems("/correio", () => false)).toHaveLength(0);
  });
  it("o label do item não colide com o subitem Conteúdos → Emails", () => {
    expect(allowedSubitems("/conteudos", () => true).some((s) => s.label === "Correio")).toBe(false);
    expect(allowedSubitems("/correio", () => true).some((s) => s.label === "Emails")).toBe(false);
  });
  it("Campanhas: folha correio.campanhas na lista e na ficha; um membro só com ela vê só esse subitem", () => {
    expect(leafForPath("/correio/campanhas")).toBe("correio.campanhas");
    expect(leafForPath("/correio/campanhas/abc")).toBe("correio.campanhas");
    expect(memberSubitems("/correio", ((k: string) => k === "correio.campanhas") as any).map((i) => i.id)).toEqual(["campanhas"]);
  });
  it("CR-09: com o módulo Correio a «Caixa» vê-se sempre a um membro (a caixa pessoal não depende de correio.caixa); o resto continua por folha", () => {
    const opts = { personalMailbox: true };
    expect(memberSubitems("/correio", () => false, opts).map((i) => i.id)).toEqual(["caixa"]);
    expect(memberSubitems("/correio", ((k: string) => k === "correio.contactos") as any, opts).map((i) => i.id)).toEqual(["caixa", "contactos"]);
    // Sem o módulo (ou sem pedir) nada muda: sem folha, sem subitem.
    expect(memberSubitems("/correio", () => false, { personalMailbox: false })).toEqual([]);
    // A opção só vale para a Caixa do Correio, nunca para outros menus.
    expect(memberSubitems("/loja", () => false, opts)).toEqual([]);
  });
  it("a folha da página é correio.caixa", () => {
    expect(leafForPath("/correio")).toBe("correio.caixa");
  });
});

describe("Correio — contactos (fase 8) e domínio próprio (fase 7)", () => {
  it("as folhas: Caixa e Contactos", () => {
    expect(leafForPath("/correio/contactos")).toBe("correio.contactos");
    expect(leafForPath("/correio")).toBe("correio.caixa");
  });

  it("um membro só com correio.contactos vê só o subitem Contactos", () => {
    const can = (k: string) => k === "correio.contactos";
    expect(memberSubitems("/correio", can as any).map((i) => i.id)).toEqual(["contactos"]);
  });

  it("parseTags: separa, apara e tira vazios e repetidos", () => {
    expect(parseTags("vip, Verão;vip |  , novo")).toEqual(["vip", "Verão", "novo"]);
    expect(parseTags("")).toEqual([]);
  });

  it("countCsvRows: linhas de dados sem o cabeçalho nem linhas vazias", () => {
    expect(countCsvRows("email\r\na@x.pt\r\n\r\nb@x.pt\r\n")).toBe(2);
    expect(countCsvRows("email")).toBe(0);
    expect(countCsvRows("")).toBe(0);
  });

  it("estado do contacto: bounced e complained são ambos «Bloqueado»", () => {
    expect(CONTACT_STATUS.bounced.label).toBe("Bloqueado");
    expect(CONTACT_STATUS.complained.label).toBe("Bloqueado");
    expect(CONTACT_STATUS.unsubscribed_by_user.label).toBe("Anulou");
  });

  it.each([
    ["mx_conflict", "corta"],
    ["mx_not_ready", "MX"],
    ["kind_required", "dois domínios"],
    ["existing_email_required", "já tem email"],
    ["mailboxes_in_domain", "caixas activas"],
    ["APP_PASSWORD_LIMIT", "5 passwords"],
    ["app_password_owner_only", "dono desta caixa"],
    ["consent_confirmation_required", "consentimento"],
    ["too_many_rows", "5 000"],
    ["customer_no_email", "não tem email"],
    ["contact_blocked", "bloqueado"],
  ])("código %s tem mensagem PT", (code, part) => {
    expect(mailErrorMessage({ response: { data: { error: code } } })).toContain(part);
  });
});

describe("parseMailView — pasta + filtro de estado a partir do URL (CR-26)", () => {
  const view = (qs: string) => parseMailView(new URLSearchParams(qs));
  it("por omissão Entrada + Todas", () => {
    expect(view("")).toEqual({ folder: "all", status: "all" });
    expect(view("pasta=lixo&filtro=lixo")).toEqual({ folder: "all", status: "all" });
  });
  it("?filtro= vale na Entrada e no Arquivo; nos Enviados nunca há filtro", () => {
    expect(view("filtro=por-ler")).toEqual({ folder: "all", status: "unread" });
    expect(view("pasta=archive&filtro=lidas")).toEqual({ folder: "archive", status: "read" });
    expect(view("pasta=sent&filtro=por-ler")).toEqual({ folder: "sent", status: "all" });
  });
  it("o link antigo ?pasta=unread abre a Entrada com Por ler; um ?filtro= explícito ganha", () => {
    expect(view("pasta=unread")).toEqual({ folder: "all", status: "unread" });
    expect(view("pasta=unread&filtro=lidas")).toEqual({ folder: "all", status: "read" });
  });
  it("mailStatusParam é o inverso (Todas não escreve nada no URL)", () => {
    expect(mailStatusParam("all")).toBeNull();
    expect(mailStatusParam("unread")).toBe("por-ler");
    expect(mailStatusParam("read")).toBe("lidas");
  });
});
