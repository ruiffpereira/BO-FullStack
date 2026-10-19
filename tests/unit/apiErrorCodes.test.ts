import { describe, it, expect } from "vitest";
import { getApiError } from "../../src/lib/apiError";

const err = (data: unknown) => ({ response: { data } });

describe("getApiError — códigos da API com texto técnico", () => {
  it("CONTENT_KEY_TAKEN / CATEGORY_REQUIRED / OUT_OF_STOCK → texto PT, nunca 'contentKey'", () => {
    expect(getApiError(err({ error: "Já existe um produto com este contentKey", code: "CONTENT_KEY_TAKEN" }))).toBe(
      "Já existe outro com este nome. Escolhe ou escreve outro nome.",
    );
    expect(getApiError(err({ error: "categoryId é obrigatório", code: "CATEGORY_REQUIRED" }))).toBe("Escolhe a categoria.");
    expect(getApiError(err({ error: "Produto esgotado", code: "OUT_OF_STOCK" }))).toBe("Produto esgotado.");
  });

  it("códigos dos Profissionais → texto PT", () => {
    expect(getApiError(err({ error: "x", code: "STAFF_HAS_HISTORY" }))).toBe("Tem histórico — desactiva-o em vez de apagar.");
    expect(getApiError(err({ error: "x", code: "STAFF_LINK_FORBIDDEN" }))).toMatch(/Só os meus/);
    expect(getApiError(err({ error: "x", code: "STAFF_NOT_FOUND" }))).toBe("Esse profissional já não existe.");
    expect(getApiError(err({ error: "x", code: "STAFF_INVALID" }))).toBe("Profissional inválido.");
  });

  it("código desconhecido → a mensagem da API; sem resposta → o fallback", () => {
    expect(getApiError(err({ error: "Outra coisa", code: "X" }))).toBe("Outra coisa");
    expect(getApiError(new Error("rede"), "Erro ao guardar")).toBe("Erro ao guardar");
  });
});
