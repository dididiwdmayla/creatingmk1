import { describe, expect, it } from "vitest";

import type { AppDb, UsageTransaction } from "@/lib/firestore-like";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { FILA_RESPOSTAS_COLLECTION } from "../estado";
import {
  confirmarTarefaResposta,
  criarTarefaResposta,
  dentroDaJanelaResposta,
  ehClaimDeResposta,
  encerrarTarefaResposta,
  idDaClaimDeResposta,
  lerTarefaResposta,
  listarTarefasResposta,
  proximaTarefaResposta,
  sortearAtrasoSegundos,
  tarefaAutomaticaViva,
} from "../respostaAutomatica";

/**
 * O RITMO HUMANO da resposta automática, puro: o atraso sorteado e a janela
 * de horário do OPERADOR. Os dois testes abaixo são sobre a mesma coisa —
 * uma resposta que chega em dois segundos, ou às quatro da manhã, denuncia a
 * automação antes de qualquer análise do texto.
 */

describe("sortearAtrasoSegundos", () => {
  it("cobre a faixa inteira, extremos inclusive", () => {
    expect(sortearAtrasoSegundos(180, 720, () => 0)).toBe(180);
    // 0.999… ainda cai no último segundo da faixa, nunca fora dela.
    expect(sortearAtrasoSegundos(180, 720, () => 0.999999)).toBe(720);
    expect(sortearAtrasoSegundos(180, 720, () => 0.5)).toBe(450);
  });

  it("nunca sai da faixa, seja qual for o sorteio", () => {
    for (const r of [0, 0.01, 0.25, 0.5, 0.75, 0.999999]) {
      const atraso = sortearAtrasoSegundos(60, 90, () => r);
      expect(atraso).toBeGreaterThanOrEqual(60);
      expect(atraso).toBeLessThanOrEqual(90);
      expect(Number.isInteger(atraso)).toBe(true);
    }
  });

  it("faixa de tamanho zero devolve o próprio valor", () => {
    expect(sortearAtrasoSegundos(300, 300, () => 0.7)).toBe(300);
  });

  it("faixa INVERTIDA usa o maior dos dois como teto, em vez de estourar", () => {
    // O painel salva cada campo no próprio blur: existe um instante em que o
    // mínimo já subiu e o máximo ainda não. Esse instante não pode derrubar
    // a fila às duas da manhã.
    expect(sortearAtrasoSegundos(900, 720, () => 0)).toBe(900);
    expect(sortearAtrasoSegundos(900, 720, () => 0.999999)).toBe(900);
  });

  it("valores negativos ou quebrados não produzem atraso negativo", () => {
    expect(sortearAtrasoSegundos(-30, -10, () => 0)).toBe(0);
    expect(sortearAtrasoSegundos(10.9, 11.9, () => 0)).toBe(10);
  });

  it("sorteia de verdade: duas respostas não saem com o mesmo atraso sempre", () => {
    const valores = new Set(
      Array.from({ length: 50 }, () => sortearAtrasoSegundos(180, 720)),
    );
    // Intervalo sempre igual é tão reconhecível quanto responder na hora.
    expect(valores.size).toBeGreaterThan(1);
  });
});

describe("dentroDaJanelaResposta — o relógio do OPERADOR", () => {
  // Todas as horas abaixo são UTC; São Paulo é UTC-3.
  const sp = (hora: number) =>
    new Date(Date.UTC(2026, 2, 10, (hora + 3) % 24, 30, 0));

  it("faixa normal: início inclusive, fim exclusivo", () => {
    expect(dentroDaJanelaResposta(sp(8), 8, 22)).toBe(true);
    expect(dentroDaJanelaResposta(sp(14), 8, 22)).toBe(true);
    // 22h30 ainda é "22" no relógio; o fim exclusivo é 23h00.
    expect(dentroDaJanelaResposta(sp(21), 8, 22)).toBe(true);
    expect(dentroDaJanelaResposta(sp(22), 8, 22)).toBe(false);
    expect(dentroDaJanelaResposta(sp(23), 8, 22)).toBe(false);
  });

  it("o lead que escreve às 4h da manhã não recebe resposta às 4h03", () => {
    expect(dentroDaJanelaResposta(sp(4), 8, 22)).toBe(false);
    expect(dentroDaJanelaResposta(sp(7), 8, 22)).toBe(false);
  });

  it("mede em São Paulo, não em UTC", () => {
    // 2026-03-10T10:00Z = 7h em São Paulo: ainda fechado numa janela 8–22.
    expect(dentroDaJanelaResposta(new Date("2026-03-10T10:00:00Z"), 8, 22)).toBe(false);
    // Uma hora depois, 8h em São Paulo: aberto.
    expect(dentroDaJanelaResposta(new Date("2026-03-10T11:00:00Z"), 8, 22)).toBe(true);
  });

  it("início igual ao fim é o dia inteiro", () => {
    expect(dentroDaJanelaResposta(sp(3), 0, 0)).toBe(true);
    expect(dentroDaJanelaResposta(sp(15), 9, 9)).toBe(true);
  });

  it("início maior que fim atravessa a meia-noite", () => {
    expect(dentroDaJanelaResposta(sp(23), 22, 6)).toBe(true);
    expect(dentroDaJanelaResposta(sp(2), 22, 6)).toBe(true);
    expect(dentroDaJanelaResposta(sp(6), 22, 6)).toBe(false);
    expect(dentroDaJanelaResposta(sp(12), 22, 6)).toBe(false);
  });

  it("hora fora de 0..23 é grampeada em vez de virar janela vazia", () => {
    expect(dentroDaJanelaResposta(sp(12), -5, 30)).toBe(true);
  });
});

describe("a fila das respostas — atraso, reserva e confirmação", () => {
  const AGORA = new Date("2026-03-10T13:00:00Z"); // 10h em São Paulo

  function comOrdemVigiada(base: FakeFirestore): { db: AppDb; violacoes: string[] } {
    const violacoes: string[] = [];
    const db: AppDb = {
      collection: (name) => base.collection(name),
      runTransaction: (fn) =>
        base.runTransaction((tx) => {
          let escreveu = false;
          const vigiada: UsageTransaction = {
            get: async (ref) => {
              if (escreveu) violacoes.push("get depois de set");
              return tx.get(ref);
            },
            set: (ref, data, options) => {
              escreveu = true;
              return tx.set(ref, data, options);
            },
          };
          return fn(vigiada);
        }),
    };
    return { db, violacoes };
  }

  async function comTarefa(
    atrasoSegundos = 300,
  ): Promise<{ db: FakeFirestore; id: string }> {
    const db = new FakeFirestore();
    const id = "rascunho-1";
    db.seed(`${FILA_RESPOSTAS_COLLECTION}/${id}`, {
      id,
      leadId: "ChIJa",
      mensagens: [{ texto: "quanto custa?", recebidoEm: AGORA.toISOString() }],
      rascunho: "Oi! Posso te mostrar agora mesmo?",
      geradoEm: AGORA.toISOString(),
      estado: "pendente",
    });
    await criarTarefaResposta(
      db,
      { id, leadId: "ChIJa", numero: "5544991543803", texto: "Oi! Posso te mostrar agora mesmo?", atrasoSegundos },
      AGORA,
    );
    return { db, id };
  }

  const depois = (segundos: number) => new Date(AGORA.getTime() + segundos * 1000);

  it("a tarefa nasce aguardando, com o atraso sorteado já aplicado", async () => {
    const { db, id } = await comTarefa(420);
    const tarefa = await lerTarefaResposta(db, id);

    expect(tarefa).toMatchObject({ estado: "aguardando", claimId: null, tentativas: 0 });
    expect(tarefa?.disponivelEm).toBe(depois(420).toISOString());
  });

  it("não entrega NADA antes de o atraso vencer", async () => {
    const { db } = await comTarefa(300);

    expect(await proximaTarefaResposta(db, "android", depois(299))).toBeNull();
    // E nada foi reservado de véspera.
    expect((await listarTarefasResposta(db))[0].estado).toBe("aguardando");

    const entregue = await proximaTarefaResposta(db, "android", depois(300));
    expect(entregue?.texto).toBe("Oi! Posso te mostrar agora mesmo?");
  });

  it("entrega a que espera há mais tempo primeiro", async () => {
    const { db } = await comTarefa(600);
    await criarTarefaResposta(
      db,
      { id: "rascunho-2", leadId: "ChIJb", numero: "5544000000000", texto: "segunda", atrasoSegundos: 60 },
      AGORA,
    );

    expect((await proximaTarefaResposta(db, "android", depois(700)))?.id).toBe("rascunho-2");
  });

  it("duas chamadas no mesmo segundo nunca levam a mesma resposta", async () => {
    const { db, id } = await comTarefa(0);

    const primeira = await proximaTarefaResposta(db, "android", AGORA);
    const segunda = await proximaTarefaResposta(db, "android", AGORA);

    expect(primeira?.id).toBe(id);
    expect(segunda).toBeNull();
  });

  it("claim expirada devolve a resposta à fila, com claimId NOVO e sem gastar tentativa", async () => {
    const { db } = await comTarefa(0);
    const primeira = await proximaTarefaResposta(db, "android", AGORA);

    const segunda = await proximaTarefaResposta(db, "android", depois(6 * 60));

    expect(segunda?.claimId).toBeTruthy();
    expect(segunda?.claimId).not.toBe(primeira?.claimId);
    expect((await listarTarefasResposta(db))[0].tentativas).toBe(0);
  });

  it("o claimId carrega o id do rascunho, e não colide com os outros dois espaços", async () => {
    const { db, id } = await comTarefa(0);
    const entregue = await proximaTarefaResposta(db, "android", AGORA);

    expect(entregue?.claimId.startsWith("resp-")).toBe(true);
    expect(idDaClaimDeResposta(entregue!.claimId)).toBe(id);
    // Claim real (12 chars base64url) e de teste (`teste-`) nunca caem aqui.
    expect(ehClaimDeResposta("Ab3xYz90QwEr")).toBe(false);
    expect(ehClaimDeResposta("teste-Ab3xYz90QwEr")).toBe(false);
    expect(idDaClaimDeResposta("resp-semponto")).toBeUndefined();
  });

  it('"enviado" fecha os três docs de uma vez — e SÓ a coluna das respostas no contador', async () => {
    const { db, id } = await comTarefa(0);
    db.seed("filaContadores/2026-03-10", {
      enviados: 7,
      envios: ["2026-03-10T12:00:00.000Z"],
      ultimoEventoEm: "2026-03-10T12:00:00.000Z",
      falhas: 1,
      invalidos: 0,
      semPrint: 2,
      respostasEnviadas: 4,
    });
    const entregue = await proximaTarefaResposta(db, "android", AGORA);

    const confirmacao = await confirmarTarefaResposta(
      db,
      entregue!.claimId,
      "enviado",
      "",
      depois(30),
      0,
    );

    expect(confirmacao).toMatchObject({ estado: "enviado", repetida: false, parado: false });
    expect(await lerTarefaResposta(db, id)).toMatchObject({
      estado: "enviado",
      enviadoEm: depois(30).toISOString(),
      claimExpiraEm: null,
    });
    // O rascunho vira "usada", com o texto que de fato saiu.
    expect(db.getDoc(`${FILA_RESPOSTAS_COLLECTION}/${id}`)).toMatchObject({
      estado: "usada",
      textoUsado: "Oi! Posso te mostrar agora mesmo?",
      resolvidoEm: depois(30).toISOString(),
      // O merge não encostou no que já estava lá.
      rascunho: "Oi! Posso te mostrar agora mesmo?",
    });
    // A prospecção do dia continua byte a byte igual.
    expect(db.getDoc("filaContadores/2026-03-10")).toMatchObject({
      respostasEnviadas: 5,
      enviados: 7,
      envios: ["2026-03-10T12:00:00.000Z"],
      ultimoEventoEm: "2026-03-10T12:00:00.000Z",
      falhas: 1,
      semPrint: 2,
    });
  });

  it("confirmação repetida da MESMA claim não conta duas vezes", async () => {
    const { db } = await comTarefa(0);
    const entregue = await proximaTarefaResposta(db, "android", AGORA);
    await confirmarTarefaResposta(db, entregue!.claimId, "enviado", "", depois(30), 0);

    const repetida = await confirmarTarefaResposta(
      db,
      entregue!.claimId,
      "enviado",
      "outra coisa",
      depois(60),
      0,
    );

    expect(repetida).toMatchObject({ estado: "enviado", repetida: true });
    expect(db.getDoc("filaContadores/2026-03-10")?.respostasEnviadas).toBe(1);
  });

  it("claim que não bate não altera nada e devolve null (409 na rota)", async () => {
    const { db, id } = await comTarefa(0);
    const entregue = await proximaTarefaResposta(db, "android", AGORA);
    const antes = await lerTarefaResposta(db, id);

    expect(await confirmarTarefaResposta(db, `resp-${id}.velha`, "enviado", "", depois(30), 0)).toBeNull();
    expect(await confirmarTarefaResposta(db, "resp-inexistente.xyz", "enviado", "", depois(30), 0)).toBeNull();
    expect(await lerTarefaResposta(db, id)).toEqual(antes);
    expect(db.getDoc("filaContadores/2026-03-10")).toBeUndefined();
    expect(entregue?.claimId).toBeTruthy();
  });

  it('"falhou" devolve à fila até esgotar as tentativas, e aí volta para o painel', async () => {
    const { db, id } = await comTarefa(0);

    let now = AGORA;
    for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
      const entregue = await proximaTarefaResposta(db, "android", now);
      expect(entregue, `tentativa ${tentativa}`).not.toBeNull();
      const confirmacao = await confirmarTarefaResposta(
        db,
        entregue!.claimId,
        "falhou",
        "sem rede",
        now,
        0,
      );
      expect(confirmacao).toMatchObject({ estado: "falhou", tentativas: tentativa });
      expect(confirmacao?.parado).toBe(tentativa === 3);
      now = depois(tentativa * 600);
    }

    // Esgotada, ela some da fila do aparelho — e o rascunho continua
    // pendente, para uma pessoa decidir.
    expect(await proximaTarefaResposta(db, "android", now)).toBeNull();
    expect(tarefaAutomaticaViva((await lerTarefaResposta(db, id))!)).toBe(false);
    expect(db.getDoc(`${FILA_RESPOSTAS_COLLECTION}/${id}`)?.estado).toBe("pendente");
    expect(db.getDoc("filaContadores/2026-03-10")).toBeUndefined();
  });

  it('"invalido" tira a resposta do automático sem marcar o telefone do lead', async () => {
    const { db, id } = await comTarefa(0);
    db.seed("leads/ChIJa", { placeId: "ChIJa", nome: "Lead", status: "respondeu" });
    const entregue = await proximaTarefaResposta(db, "android", AGORA);

    const confirmacao = await confirmarTarefaResposta(
      db,
      entregue!.claimId,
      "invalido",
      "não abriu",
      depois(30),
      0,
    );

    expect(confirmacao).toMatchObject({ estado: "invalido", parado: true });
    // O número acabou de mandar mensagem: tirar o lead da prospecção para
    // sempre por causa disto seria dano permanente por um sinal fraco.
    expect(db.getDoc("leads/ChIJa")?.telefoneInvalido).toBeUndefined();
    expect(db.getDoc(`${FILA_RESPOSTAS_COLLECTION}/${id}`)?.estado).toBe("pendente");
    expect(await proximaTarefaResposta(db, "android", depois(3600))).toBeNull();
  });

  it("faz TODAS as leituras antes de TODAS as escritas", async () => {
    const { db: base } = await comTarefa(0);
    const entregue = await proximaTarefaResposta(base, "android", AGORA);

    const { db, violacoes } = comOrdemVigiada(base);
    await confirmarTarefaResposta(db, entregue!.claimId, "enviado", "", depois(30), 0);

    expect(violacoes).toEqual([]);
  });

  it("o painel encerra a tarefa — mas não a que já está na mão do aparelho", async () => {
    const { db, id } = await comTarefa(0);

    expect(await encerrarTarefaResposta(db, id, AGORA)).toBe(true);
    expect(await proximaTarefaResposta(db, "android", AGORA)).toBeNull();

    // Agora o caso oposto: tarefa entregue, claim viva.
    const outra = await comTarefa(0);
    await proximaTarefaResposta(outra.db, "android", AGORA);
    expect(await encerrarTarefaResposta(outra.db, outra.id, AGORA)).toBe(false);
    expect((await lerTarefaResposta(outra.db, outra.id))?.estado).toBe("reservado");
  });

  it("encerrar tarefa inexistente é sucesso: o rascunho simplesmente nunca foi automático", async () => {
    expect(await encerrarTarefaResposta(new FakeFirestore(), "nao-existe", AGORA)).toBe(true);
  });
});
