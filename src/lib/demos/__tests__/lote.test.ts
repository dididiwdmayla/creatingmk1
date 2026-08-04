import { describe, expect, it, vi } from "vitest";

import { LOTE_ORCAMENTO_MS_PADRAO, processarLoteComOrcamento } from "../lote";

describe("processarLoteComOrcamento", () => {
  it("processa tudo numa chamada quando cabe no orçamento", async () => {
    const processados: number[] = [];
    const { resultados, proximoCursor } = await processarLoteComOrcamento(
      [1, 2, 3],
      0,
      async (item) => {
        processados.push(item);
      },
    );

    expect(processados).toEqual([1, 2, 3]);
    expect(proximoCursor).toBeNull();
    expect(resultados).toEqual([
      { item: 1, status: "ok" },
      { item: 2, status: "ok" },
      { item: 3, status: "ok" },
    ]);
  });

  it("falha em um item não interrompe o resto — reporta erro por item", async () => {
    const { resultados, proximoCursor } = await processarLoteComOrcamento(
      ["a", "b", "c"],
      0,
      async (item) => {
        if (item === "b") throw new Error("lead sumiu");
      },
    );

    expect(proximoCursor).toBeNull();
    expect(resultados).toEqual([
      { item: "a", status: "ok" },
      { item: "b", status: "erro", erro: "lead sumiu" },
      { item: "c", status: "ok" },
    ]);
  });

  it("erro não-Error vira String(erro) na mensagem", async () => {
    const { resultados } = await processarLoteComOrcamento([1], 0, async () => {
      throw "boom";
    });

    expect(resultados).toEqual([{ item: 1, status: "erro", erro: "boom" }]);
  });

  it("estoura o orçamento no meio do lote → para DEPOIS de concluir o item corrente, cursor aponta pro próximo", async () => {
    let relogio = 0;
    const agora = () => relogio;
    const processados: number[] = [];

    const { resultados, proximoCursor } = await processarLoteComOrcamento(
      [1, 2, 3, 4],
      0,
      async (item) => {
        processados.push(item);
        relogio += 30; // cada item "gasta" 30ms do relógio fake
      },
      { orcamentoMs: 50, agora },
    );

    // orçamento 50ms: item 1 (relogio=30, <50 → continua), item 2
    // (relogio=60, >=50 → para) — nunca corta um item pela metade.
    expect(processados).toEqual([1, 2]);
    expect(resultados).toEqual([
      { item: 1, status: "ok" },
      { item: 2, status: "ok" },
    ]);
    expect(proximoCursor).toBe(2);
  });

  it("retomada a partir de proximoCursor completa o lote", async () => {
    let relogio = 0;
    const agora = () => relogio;
    const processar = async () => {
      relogio += 30;
    };

    const primeira = await processarLoteComOrcamento([1, 2, 3, 4], 0, processar, {
      orcamentoMs: 50,
      agora,
    });
    expect(primeira.proximoCursor).toBe(2);

    relogio = 0; // nova chamada HTTP, novo orçamento
    const segunda = await processarLoteComOrcamento(
      [1, 2, 3, 4],
      primeira.proximoCursor as number,
      processar,
      { orcamentoMs: 50, agora },
    );

    expect(segunda.resultados.map((r) => r.item)).toEqual([3, 4]);
    expect(segunda.proximoCursor).toBeNull();
  });

  it("sempre processa ao menos 1 item por chamada, mesmo com orçamento 0", async () => {
    const processados: number[] = [];
    const { proximoCursor } = await processarLoteComOrcamento(
      [1, 2, 3],
      0,
      async (item) => {
        processados.push(item);
      },
      { orcamentoMs: 0, agora: () => 1 },
    );

    expect(processados).toEqual([1]);
    expect(proximoCursor).toBe(1);
  });

  it("lista vazia → proximoCursor null sem chamar processar", async () => {
    const processar = vi.fn();
    const { resultados, proximoCursor } = await processarLoteComOrcamento([], 0, processar);

    expect(resultados).toEqual([]);
    expect(proximoCursor).toBeNull();
    expect(processar).not.toHaveBeenCalled();
  });

  it("cursor já no fim (ou além) → proximoCursor null sem processar nada", async () => {
    const processar = vi.fn();
    const { resultados, proximoCursor } = await processarLoteComOrcamento([1, 2], 5, processar);

    expect(resultados).toEqual([]);
    expect(proximoCursor).toBeNull();
    expect(processar).not.toHaveBeenCalled();
  });

  it("orçamento default é 8000ms", () => {
    expect(LOTE_ORCAMENTO_MS_PADRAO).toBe(8000);
  });
});
