import { describe, it, expect } from "vitest";
import { reasonBadge } from "../../src/lib/billingStatus";

// T9 (self-serve): novo reason "trial_expired" — trial local expirado sem
// cartão associado. Tom vermelho, mas rótulo não-punitivo (nunca "trial" na UI).
describe("billingStatus — reasonBadge(trial_expired)", () => {
  it("devolve tom vermelho com o rótulo em PT correto", () => {
    expect(reasonBadge("trial_expired")).toEqual({
      tone: "red",
      label: "Período experimental terminado",
    });
  });

  it("um reason desconhecido cai no fallback (none)", () => {
    expect(reasonBadge("something-else")).toEqual(reasonBadge("none"));
  });
});
