/** Mensagem PT para códigos da API cujo texto cru é técnico (ex.: fala em `contentKey`). */
const MESSAGE_BY_CODE: Record<string, string> = {
  CONTENT_KEY_TAKEN: "Já existe outro com este nome. Escolhe ou escreve outro nome.",
  CATEGORY_REQUIRED: "Escolhe a categoria.",
  OUT_OF_STOCK: "Produto esgotado.",
};

export function getApiError(error: unknown, fallback = "Ocorreu um erro"): string {
  if (error && typeof error === "object" && "response" in error) {
    const data = (error as any).response?.data;
    if (typeof data?.code === "string" && MESSAGE_BY_CODE[data.code]) return MESSAGE_BY_CODE[data.code];
    if (typeof data?.error === "string" && data.error) return data.error;
    if (typeof data?.message === "string" && data.message) return data.message;
  }
  return fallback;
}
