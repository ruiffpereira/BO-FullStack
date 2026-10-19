import { describe, it, expect } from "vitest";
import {
  blockError,
  blocksError,
  campaignErrorMessage,
  cleanBlocks,
  cleanSegment,
  isCampaignsLocked,
  isHttpsUrl,
  isoToLocalInput,
  languagesWithContent,
  localInputToIso,
  moveItem,
  newBlock,
  pct,
  readinessByStep,
  segmentLabel,
  segmentReady,
} from "../../src/lib/campaigns";
import { mailErrorMessage } from "../../src/lib/mail";

describe("Campanhas — URLs e blocos", () => {
  it("só https é aceite", () => {
    expect(isHttpsUrl("https://tifas.pt/x")).toBe(true);
    for (const bad of ["http://tifas.pt", "javascript:alert(1)", "data:text/html;base64,AAAA", "//tifas.pt", "tifas.pt", "", "  "]) {
      expect(isHttpsUrl(bad)).toBe(false);
    }
  });

  it("erros por bloco: imagem, botão, produto", () => {
    expect(blockError({ type: "image", url: "http://x.pt/a.png" })).toMatch(/https:\/\//);
    expect(blockError({ type: "image", url: "https://x.pt/a.png", linkUrl: "javascript:1" })).toMatch(/https:\/\//);
    expect(blockError({ type: "image", url: "https://x.pt/a.png" })).toBeNull();
    expect(blockError({ type: "button", label: "", url: "https://x.pt" })).toMatch(/texto do botão/);
    expect(blockError({ type: "button", label: "Ver", url: "http://x.pt" })).toMatch(/https:\/\//);
    expect(blockError({ type: "button", label: "Ver", url: "https://x.pt" })).toBeNull();
    expect(blockError({ type: "product", refId: "", title: "" })).toMatch(/Escolhe/);
    expect(blockError({ type: "service", refId: "s1", title: "Corte", url: "http://x" })).toMatch(/https:\/\//);
    expect(blockError({ type: "title", text: "Olá" })).toBeNull();
  });

  it("blocksError ignora os vazios e diz de que bloco vem o erro", () => {
    expect(blocksError([newBlock("title"), newBlock("button")])).toBeNull();
    expect(blocksError([{ type: "button", label: "Ver", url: "http://x.pt" }])).toMatch(/^Botão: /);
  });

  it("cleanBlocks tira vazios e campos em branco (a API recusa url vazio)", () => {
    expect(
      cleanBlocks([
        { type: "title", text: "  Olá  " },
        { type: "text", text: "" },
        { type: "image", url: "https://x.pt/a.png", alt: "", linkUrl: "" },
        { type: "product", refId: "p1", title: "Pomada", text: "" },
      ]),
    ).toEqual([
      { type: "title", text: "Olá" },
      { type: "image", url: "https://x.pt/a.png" },
      { type: "product", refId: "p1", title: "Pomada" },
    ]);
  });

  it("moveItem move sem mutar e ignora limites", () => {
    const l = ["a", "b", "c"];
    expect(moveItem(l, 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(l, 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(l, 0, 5)).toEqual(l);
    expect(l).toEqual(["a", "b", "c"]);
  });

  it("languagesWithContent só conta línguas com blocos não vazios", () => {
    expect(languagesWithContent({ pt: [{ type: "title", text: "x" }], en: [{ type: "text", text: " " }], es: [] })).toEqual(["pt"]);
  });
});

describe("Campanhas — segmentos", () => {
  it("cleanSegment deixa só os campos do tipo", () => {
    expect(cleanSegment({ type: "all", days: 3, tag: "x" })).toEqual({ type: "all" });
    expect(cleanSegment({ type: "agenda_recent" })).toEqual({ type: "agenda_recent", days: 30 });
    expect(cleanSegment({ type: "agenda_recent", days: 99999 })).toEqual({ type: "agenda_recent", days: 3650 });
    expect(cleanSegment({ type: "buyers" })).toEqual({ type: "buyers" });
    expect(cleanSegment({ type: "buyers", days: 7 })).toEqual({ type: "buyers", days: 7 });
    expect(cleanSegment({ type: "tag", tag: " vip " })).toEqual({ type: "tag", tag: "vip" });
    expect(cleanSegment({ type: "language" }, "en")).toEqual({ type: "language", language: "en" });
  });

  it("segmentReady: etiqueta vazia e agenda sem dias não estão prontas", () => {
    expect(segmentReady({ type: "tag", tag: " " })).toBe(false);
    expect(segmentReady({ type: "tag", tag: "vip" })).toBe(true);
    expect(segmentReady({ type: "agenda_recent" })).toBe(false);
    expect(segmentReady({ type: "buyers" })).toBe(true);
    expect(segmentReady({ type: "all" })).toBe(true);
  });

  it("segmentLabel", () => {
    expect(segmentLabel({ type: "members_overdue" })).toBe("Sócios em atraso");
    expect(segmentLabel({ type: "agenda_recent", days: 30 })).toMatch(/30 dias/);
    expect(segmentLabel({ type: "tag", tag: "vip" })).toBe("Etiqueta: vip");
    expect(segmentLabel(null)).toBe("Todos os subscritos");
  });
});

describe("Campanhas — prontidão, números, datas, erros", () => {
  it("os erros do readiness vão para o passo do conteúdo", () => {
    expect(readinessByStep(["Falta o assunto (pt).", "Falta o conteúdo (pt)."])).toEqual([[], ["Falta o assunto (pt).", "Falta o conteúdo (pt)."], [], []]);
    expect(readinessByStep(undefined)).toEqual([[], [], [], []]);
  });

  it("pct não divide por zero", () => {
    expect(pct(45, 90)).toBe("50%");
    expect(pct(1, 0)).toBe("—");
    expect(pct(undefined, undefined)).toBe("—");
  });

  it("datetime-local para ISO e de volta", () => {
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("lixo")).toBeNull();
    const iso = localInputToIso("2030-05-01T09:30");
    expect(new Date(iso as string).getTime()).toBe(new Date("2030-05-01T09:30").getTime());
    expect(isoToLocalInput(iso)).toBe("2030-05-01T09:30");
    expect(isoToLocalInput(null)).toBe("");
  });

  it("mensagens PT dos códigos novos", () => {
    const err = (status: number, error: string) => ({ response: { status, data: { error } } });
    expect(mailErrorMessage(err(409, "CAMPAIGNS_LOCKED"))).toMatch(/domínio/);
    expect(mailErrorMessage(err(423, "MAIL_SENDING_PAUSED"))).toMatch(/pausados/);
    expect(mailErrorMessage(err(400, "NO_AUDIENCE"))).toMatch(/nenhum subscrito/);
    expect(mailErrorMessage(err(400, "INVALID_SCHEDULE"))).toMatch(/1 minuto/);
    expect(mailErrorMessage(err(400, "INVALID_REFERENCE"))).toMatch(/produto ou serviço/);
    expect(mailErrorMessage(err(409, "CAMPAIGN_STATE"))).toBeTruthy();
    expect(mailErrorMessage(err(409, "CAMPAIGN_NOT_EDITABLE"))).toMatch(/rascunhos/);
    expect(mailErrorMessage(err(409, "CAMPAIGN_NOT_CANCELLABLE"))).toMatch(/cancelar/);
    expect(mailErrorMessage(err(429, "CAMPAIGN_TEST_LIMIT"))).toMatch(/limite/);
    expect(mailErrorMessage(err(409, "own_domain_required"))).toMatch(/domínio próprio/);
  });

  it("CAMPAIGN_INCOMPLETE mostra o que falta; sem details cai no texto geral", () => {
    const e = { response: { status: 400, data: { error: "CAMPAIGN_INCOMPLETE", details: ["Falta o assunto (en)."] } } };
    expect(campaignErrorMessage(e)).toBe("Falta o assunto (en).");
    expect(campaignErrorMessage({ response: { status: 400, data: { error: "CAMPAIGN_INCOMPLETE" } } })).toMatch(/incompleta/);
  });

  it("isCampaignsLocked só para 409 CAMPAIGNS_LOCKED", () => {
    expect(isCampaignsLocked({ response: { status: 409, data: { error: "CAMPAIGNS_LOCKED" } } })).toBe(true);
    expect(isCampaignsLocked({ response: { status: 409, data: { error: "CAMPAIGN_STATE" } } })).toBe(false);
  });
});
