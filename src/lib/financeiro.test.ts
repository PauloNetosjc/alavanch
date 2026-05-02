import { describe, it, expect } from "vitest";
import { calcularRT, somarMovimento, saldoFinal, ultimasCompetencias } from "@/lib/financeiro";

describe("calcularRT", () => {
  it("calcula RT como % sobre o valor do pedido (10%)", () => {
    expect(calcularRT(10000, 10)).toBe(1000);
  });
  it("calcula RT com percentual fracionário", () => {
    expect(calcularRT(2265.18, 10)).toBeCloseTo(226.52, 2);
  });
  it("retorna 0 quando valor é zero", () => {
    expect(calcularRT(0, 12)).toBe(0);
  });
  it("retorna 0 quando percentual é zero", () => {
    expect(calcularRT(50000, 0)).toBe(0);
  });
  it("12% de R$ 22.998,86 é R$ 2.759,86", () => {
    expect(calcularRT(22998.86, 12)).toBeCloseTo(2759.86, 2);
  });
});

describe("somarMovimento", () => {
  it("soma entradas e saídas separadamente", () => {
    const r = somarMovimento([
      { tipo: "entrada", valor: 100 },
      { tipo: "entrada", valor: 250 },
      { tipo: "saida", valor: 80 },
    ]);
    expect(r).toEqual({ entradas: 350, saidas: 80 });
  });
  it("ignora valores não numéricos como zero", () => {
    const r = somarMovimento([{ tipo: "entrada", valor: NaN as any }]);
    expect(r.entradas).toBe(0);
  });
});

describe("saldoFinal", () => {
  it("calcula saldo final = inicial + entradas - saídas", () => {
    expect(saldoFinal(1000, 500, 200)).toBe(1300);
  });
  it("aceita valores negativos resultantes", () => {
    expect(saldoFinal(0, 100, 500)).toBe(-400);
  });
});

describe("ultimasCompetencias", () => {
  it("retorna 6 competências terminando no mês de referência", () => {
    const ref = new Date(2026, 3, 15); // abril/2026
    const c = ultimasCompetencias(ref, 6);
    expect(c).toHaveLength(6);
    expect(c[5].label).toBe("abr/26");
    expect(c[0].label).toBe("nov/25");
  });
});
