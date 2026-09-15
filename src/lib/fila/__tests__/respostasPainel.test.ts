import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";

import { listarRespostasPendentes, resolverResposta } from "../respostasPainel";

/**
 * O painel "Respostas pendentes" (/config). O que estes testes protegem:
 * quem entra na lista (só `estado: "pendente"`), o que cada linha carrega
 * (as mensagens do lead NA ORDEM, o que o Radar mandou, o rascunho), o
 * custo (nunca varrer `/leads`, nunca recarregar as fontes da mensagem por
 * linha) e as três saídas de `resolverResposta` — inclusive a que RECUSA
 * apagar o texto de uma resposta que já saiu.
 */

const AGORA = new Date("2026-03-10T12:00:00.000Z");

function resposta(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    leadId: "ChIJa",
    mensagens: [{ texto: "Oi, tenho interesse!", recebidoEm: "2026-03-10T11:00:00.000Z" }],
    rascunho: "Oi! Posso te mostrar agora?",
    geradoEm: "2026-03-10T11:01:00.000Z",
    estado: "pendente",
    ...extra,
  };
}

function comDados() {
  const db = new FakeFirestore();
  db.seed("config/app", { mensagemPadrao: "Oi {nome}, tudo bem?" });
  db.seed("leads/ChIJa", {
    placeId: "ChIJa",
    nome: "Ink House",
    status: "respondeu",
    telefoneIntl: "+55 51 96666-0000",
    busca: { nicho: "tatuagem", regiao: "Porto Alegre RS", em: "2026-03-01T10:00:00.000Z" },
  });
  db.seed("leads/ChIJb", {
    placeId: "ChIJb",
    nome: "Pet Feliz",
    status: "respondeu",
    busca: { nicho: "petshop", regiao: "Porto Alegre RS", em: "2026-03-01T10:00:00.000Z" },
  });

  // Duas pendentes — a de ChIJb é mais NOVA e vem primeiro.
  db.seed("filaRespostas/r-1", resposta("r-1"));
  db.seed(
    "filaRespostas/r-2",
    resposta("r-2", {
      leadId: "ChIJb",
      geradoEm: "2026-03-10T11:30:00.000Z",
      mensagens: [
        { texto: "quanto custa?", recebidoEm: "2026-03-10T11:28:00.000Z" },
        { texto: "e tem mensalidade?", recebidoEm: "2026-03-10T11:29:00.000Z" },
      ],
      rascunho: "Fica em R$ 2.000, sem mensalidade.",
    }),
  );
  // Já fechadas: nenhuma das duas volta para a lista.
  db.seed("filaRespostas/r-3", resposta("r-3", { estado: "usada" }));
  db.seed("filaRespostas/r-4", resposta("r-4", { estado: "descartada" }));
  return db;
}

describe("listarRespostasPendentes", () => {
  it("lista só as pendentes, da mais recente para a mais antiga", async () => {
    const linhas = await listarRespostasPendentes(comDados());

    expect(linhas.map((l) => l.id)).toEqual(["r-2", "r-1"]);
  });

  it("cada linha traz lead, nicho, o que o LEAD mandou e o rascunho", async () => {
    const [, linha] = await listarRespostasPendentes(comDados());

    expect(linha).toMatchObject({
      id: "r-1",
      leadId: "ChIJa",
      nome: "Ink House",
      nicho: "tatuagem",
      // Dígitos puros, prontos para o link — o painel não limpa telefone.
      telefone: "5551966660000",
      mensagens: [{ texto: "Oi, tenho interesse!", recebidoEm: "2026-03-10T11:00:00.000Z" }],
      rascunho: "Oi! Posso te mostrar agora?",
    });
  });

  it("as mensagens do grupo saem NA ORDEM em que chegaram", async () => {
    const [linha] = await listarRespostasPendentes(comDados());

    expect(linha.mensagens.map((m) => m.texto)).toEqual(["quanto custa?", "e tem mensalidade?"]);
  });

  it("a mensagem que o Radar mandou vem RECONSTRUÍDA, com os marcadores resolvidos", async () => {
    const [, linha] = await listarRespostasPendentes(comDados());

    // O app não guarda o texto literal que saiu: a linha é remontada pela
    // MESMA precedência do envio (ver `montarMensagemParaLead`).
    expect(linha.mensagemEnviada).toBe("Oi Ink House, tudo bem?");
  });

  it("lead sumido não apaga a pendência — some o nome, fica o id", async () => {
    const db = comDados();
    db.deleteDoc("leads/ChIJa");

    const linha = (await listarRespostasPendentes(db)).find((l) => l.id === "r-1");

    expect(linha).toMatchObject({ leadId: "ChIJa", nome: "", nicho: "", telefone: "" });
    expect(linha?.rascunho).toBe("Oi! Posso te mostrar agora?");
  });

  it("lista vazia não paga nem a leitura das fontes da mensagem", async () => {
    const db = new FakeFirestore();
    db.seed("filaRespostas/r-9", resposta("r-9", { estado: "usada" }));
    const lidas: string[] = [];
    const espiao = {
      collection: (nome: string) => {
        lidas.push(nome);
        return db.collection(nome);
      },
      runTransaction: db.runTransaction.bind(db),
    };

    expect(await listarRespostasPendentes(espiao as unknown as FakeFirestore)).toEqual([]);
    expect(lidas).toEqual(["filaRespostas"]);
  });

  it("lê o doc de lead POR ID, nunca varre /leads, e carrega as fontes UMA vez", async () => {
    const db = comDados();
    // Base com muito lead e duas pendências: o painel não pode custar a base
    // inteira (o AppDb não tem query — ver o cabeçalho do módulo).
    for (let i = 0; i < 50; i++) {
      db.seed(`leads/outro-${i}`, { placeId: `outro-${i}`, nome: `Outro ${i}` });
    }
    const lidos: string[] = [];
    const varridas: string[] = [];
    const espiao = {
      collection: (nome: string) => {
        const real = db.collection(nome);
        return {
          doc: (id: string) => {
            if (nome === "leads") lidos.push(id);
            return real.doc(id);
          },
          get: () => {
            varridas.push(nome);
            if (nome === "leads") lidos.push("VARREDURA DE /leads");
            return real.get();
          },
        };
      },
      runTransaction: db.runTransaction.bind(db),
    };

    await listarRespostasPendentes(espiao as unknown as FakeFirestore);

    expect(lidos).toEqual(["ChIJb", "ChIJa"]);
    // `buscas` e `frasesProspeccao` são VARREDURAS: uma vez para a lista
    // inteira, não uma por linha (é o que `carregarFontesDaMensagem` existe
    // para garantir). Com 2 linhas, duas seriam 4.
    expect(varridas.filter((c) => c === "buscas")).toHaveLength(1);
    expect(varridas.filter((c) => c === "frasesProspeccao")).toHaveLength(1);
  });
});

describe("resolverResposta", () => {
  it('"usada" grava o texto EDITADO, não o rascunho, e a linha sai da lista', async () => {
    const db = comDados();

    await resolverResposta(db, "r-1", "usada", "Oi! Mando o link agora mesmo.", AGORA);

    expect(db.getDoc("filaRespostas/r-1")).toMatchObject({
      estado: "usada",
      textoUsado: "Oi! Mando o link agora mesmo.",
      resolvidoEm: AGORA.toISOString(),
      // Merge de campo: as mensagens e o rascunho original ficam intactos.
      rascunho: "Oi! Posso te mostrar agora?",
    });
    expect((await listarRespostasPendentes(db)).map((l) => l.id)).toEqual(["r-2"]);
  });

  it("sem texto no corpo, o usado é o próprio rascunho (quem não editou nada)", async () => {
    const db = comDados();

    await resolverResposta(db, "r-1", "usada", undefined, AGORA);

    expect(db.getDoc("filaRespostas/r-1")?.textoUsado).toBe("Oi! Posso te mostrar agora?");
  });

  it('"descartada" não guarda texto nenhum — o operador respondeu do jeito dele', async () => {
    const db = comDados();

    await resolverResposta(db, "r-1", "descartada", "isto não pode ser gravado", AGORA);

    expect(db.getDoc("filaRespostas/r-1")).toMatchObject({ estado: "descartada" });
    expect(db.getDoc("filaRespostas/r-1")?.textoUsado).toBeUndefined();
    expect((await listarRespostasPendentes(db)).map((l) => l.id)).toEqual(["r-2"]);
  });

  it("id que não existe → 404 e NENHUM doc criado", async () => {
    const db = comDados();

    await expect(resolverResposta(db, "r-nada", "usada", "x", AGORA)).rejects.toMatchObject({
      code: "not_found",
    });
    expect(db.getDoc("filaRespostas/r-nada")).toBeUndefined();
  });

  it("repetir o MESMO estado é sucesso, e não reescreve nada", async () => {
    const db = comDados();
    await resolverResposta(db, "r-1", "usada", "texto que saiu", AGORA);
    const depois = new Date("2026-03-10T13:00:00.000Z");

    await resolverResposta(db, "r-1", "usada", "outro texto", depois);

    // Nem o carimbo nem o texto são retocados: não houve mudança para
    // registrar (idempotente por VALOR, como POST /api/fila/pausar).
    expect(db.getDoc("filaRespostas/r-1")).toMatchObject({
      textoUsado: "texto que saiu",
      resolvidoEm: AGORA.toISOString(),
    });
  });

  it("descartar o que já foi usado → 409, sem apagar o texto que de fato saiu", async () => {
    const db = comDados();
    await resolverResposta(db, "r-1", "usada", "texto que saiu", AGORA);

    await expect(resolverResposta(db, "r-1", "descartada", undefined, AGORA)).rejects.toMatchObject({
      code: "invalid_transition",
    });
    expect(db.getDoc("filaRespostas/r-1")).toMatchObject({
      estado: "usada",
      textoUsado: "texto que saiu",
    });
  });
});
