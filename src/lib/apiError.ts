export function getApiError(error: unknown, fallback = "Ocorreu um erro"): string {
  if (error && typeof error === "object" && "response" in error) {
    const data = (error as any).response?.data;
    if (typeof data?.error === "string" && data.error) return data.error;
    if (typeof data?.message === "string" && data.message) return data.message;
  }
  return fallback;
}
