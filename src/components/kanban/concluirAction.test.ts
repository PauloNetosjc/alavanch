import { describe, expect, it } from "vitest";
import { getProximoEstagio, isConcluidosStageName } from "./concluirAction";

describe("getProximoEstagio", () => {
  it("considera a etapa Concluídos recriada como próxima etapa válida", () => {
    const vistoria = { id: "vistoria", nome: "7 - Vistoria Agendada", ordem: 7 };
    const concluidosRecriado = { id: "concluidos-novo", nome: "Concluídos", ordem: 8 };

    expect(getProximoEstagio([concluidosRecriado, vistoria], "vistoria")).toEqual(concluidosRecriado);
  });

  it("não avança quando o estágio atual já é Concluídos", () => {
    const concluidos = { id: "concluidos", nome: "Concluidos", ordem: 8 };
    expect(isConcluidosStageName(concluidos.nome)).toBe(true);
    expect(getProximoEstagio([concluidos], "concluidos")).toBeNull();
  });
});