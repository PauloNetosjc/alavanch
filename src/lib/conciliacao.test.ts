import { describe, it, expect } from "vitest";
import { scoreMatch } from "./conciliacao";

describe("conciliacao.scoreMatch", () => {
  it("dá score alto para valor e data idênticos", () => {
    const s = scoreMatch(1000, "2026-05-01", 1000, "2026-05-01");
    expect(s).toBeGreaterThanOrEqual(95);
  });

  it("dá score médio para valor próximo (~1%) e data próxima", () => {
    const s = scoreMatch(1000, "2026-05-01", 1009, "2026-05-02");
    expect(s).toBeGreaterThanOrEqual(60);
    expect(s).toBeLessThan(95);
  });

  it("dá score baixo para valor e datas distantes", () => {
    const s = scoreMatch(1000, "2026-05-01", 1500, "2026-06-15");
    expect(s).toBeLessThan(40);
  });

  it("nunca passa de 100", () => {
    expect(scoreMatch(100, "2026-05-01", 100, "2026-05-01")).toBeLessThanOrEqual(100);
  });

  it("trata valor nulo sem quebrar", () => {
    const s = scoreMatch(1000, "2026-05-01", null as any, "2026-05-01");
    expect(s).toBeGreaterThanOrEqual(40);
  });
});
