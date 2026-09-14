import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";

import { listarPendencias, marcarPendenciaResolvida } from "../pendencias";

/**
 * A lista que torna encontrável o lead que recebeu o TEXTO mas não o print.
 * O que estes testes protegem: quem entra na lista (só quem tem detalhe de
 * envio), quem sai (o resolvido), e o custo — ler `/leads` inteira atrás dos
 * nomes seria varrer a base toda numa página de admin.
 */

const ENVIADO_EM = "2026-03-10T10:00:00.000Z";

function envio(leadId: string, extra: Record<string, unknown> = {}) {
  return {
    leadId,
    estado: "enviado",
    claimId: `claim-${leadId}`,
    reservadoEm: ENVIADO_EM,
    expiraEm: ENVIADO_EM,
    dispositivo: "android",
    tentativas: 0,
    ultimoErro: null,
    enviadoEm: ENVIADO_EM,
    detalheEnvio: "",
    ...extra,
  };
}

function comDados() {
  const db = new FakeFirestore();
  // Pendente: o print não anexou.
  db.seed("leads/ChIJa", { placeId: "ChIJa", nome: "Ink House", status: "contactado" });
  db.seed("filaEnvios/ChIJa", envio("ChIJa", { detalheEnvio: "print não anexou" }));
  // Pendente e mais ANTIGO — a ordem é do mais recente para o mais antigo.
  db.seed("leads/ChIJb", { placeId: "ChIJb", nome: "Barbearia Rex", status: "contactado" });
  db.seed(
    "filaEnvios/ChIJb",
    envio("ChIJb", {
      detalheEnvio: "galeria vazia",
      enviadoEm: "2026-03-09T10:00:00.000Z",
    }),
  );
  // Envio LIMPO: não é pendência nenhuma.
  db.seed("leads/ChIJc", { placeId: "ChIJc", nome: "Tattoo Co", status: "contactado" });
  db.seed("filaEnvios/ChIJc", envio("ChIJc"));
  // FALHOU: o detalhe foi para ultimoErro e o lead volta à fila sozinho —
  // não é pendência de print.
  db.seed("leads/ChIJd", { placeId: "ChIJd", nome: "Pet Feliz", status: "novo" });
  db.seed(
    "filaEnvios/ChIJd",
    envio("ChIJd", { estado: "falhou", ultimoErro: "whatsapp travou", enviadoEm: null }),
  );
  return db;
}

describe("listarPendencias", () => {
  it("lista só quem tem detalhe de envio, do mais recente para o mais antigo", async () => {
    const linhas = await listarPendencias(comDados());

    expect(linhas).toEqual([
      {
        leadId: "ChIJa",
        nome: "Ink House",
        enviadoEm: ENVIADO_EM,
        detalhe: "print não anexou",
        resolvido: false,
      },
      {
        leadId: "ChIJb",
        nome: "Barbearia Rex",
        enviadoEm: "2026-03-09T10:00:00.000Z",
        detalhe: "galeria vazia",
        resolvido: false,
      },
    ]);
  });

  it("detalhe só de espaços não conta como pendência", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", { placeId: "ChIJa", nome: "L" });
    db.seed("filaEnvios/ChIJa", envio("ChIJa", { detalheEnvio: "   " }));

    expect(await listarPendencias(db)).toEqual([]);
  });

  it("o resolvido sai da lista, e volta quando pedido", async () => {
    const db = comDados();
    await marcarPendenciaResolvida(db, "ChIJa", true);

    expect((await listarPendencias(db)).map((l) => l.leadId)).toEqual(["ChIJb"]);
    expect((await listarPendencias(db, { incluirResolvidos: true })).map((l) => l.leadId)).toEqual([
      "ChIJa",
      "ChIJb",
    ]);
    expect((await listarPendencias(db, { incluirResolvidos: true }))[0].resolvido).toBe(true);
  });

  it("lê o doc de lead APENAS dos ids que sobraram da peneira", async () => {
    const db = comDados();
    // Uma base com muito lead e uma pendência só: a lista não pode custar a
    // base inteira (o AppDb não tem query — ver o cabeçalho do módulo).
    for (let i = 0; i < 50; i++) {
      db.seed(`leads/outro-${i}`, { placeId: `outro-${i}`, nome: `Outro ${i}` });
    }
    const lidos: string[] = [];
    const espiao = {
      collection: (nome: string) => {
        const real = db.collection(nome);
        return {
          doc: (id: string) => {
            if (nome === "leads") lidos.push(id);
            return real.doc(id);
          },
          get: () => {
            if (nome === "leads") lidos.push("VARREDURA DE /leads");
            return real.get();
          },
        };
      },
      runTransaction: db.runTransaction.bind(db),
    };

    await listarPendencias(espiao as unknown as FakeFirestore);

    expect(lidos).toEqual(["ChIJa", "ChIJb"]);
  });

  it("pendência de lead excluído não some — fica o id no lugar do nome", async () => {
    const db = new FakeFirestore();
    db.seed("filaEnvios/ChIJsumiu", envio("ChIJsumiu", { detalheEnvio: "print não anexou" }));

    expect(await listarPendencias(db)).toEqual([
      {
        leadId: "ChIJsumiu",
        nome: "",
        enviadoEm: ENVIADO_EM,
        detalhe: "print não anexou",
        resolvido: false,
      },
    ]);
  });
});

describe("marcarPendenciaResolvida", () => {
  it("grava detalheEnvioResolvido sem encostar no resto do doc", async () => {
    const db = comDados();
    const antes = db.getDoc("filaEnvios/ChIJa");

    await marcarPendenciaResolvida(db, "ChIJa", true);

    expect(db.getDoc("filaEnvios/ChIJa")).toEqual({
      ...antes,
      detalheEnvioResolvido: true,
    });
  });

  it("desmarca — um alternador clicado por engano tem como voltar", async () => {
    const db = comDados();
    await marcarPendenciaResolvida(db, "ChIJa", true);

    const pendencia = await marcarPendenciaResolvida(db, "ChIJa", false);

    expect(pendencia.resolvido).toBe(false);
    expect((await listarPendencias(db)).map((l) => l.leadId)).toContain("ChIJa");
  });

  it("lead sem pendência é 404 e NÃO cria doc novo em filaEnvios", async () => {
    const db = comDados();

    // `set` com merge criaria o doc ausente; um leadId errado não pode
    // plantar lixo na coleção da fila.
    await expect(marcarPendenciaResolvida(db, "ChIJnunca-existiu", true)).rejects.toThrow(
      /não tem pendência/,
    );
    expect(db.getDoc("filaEnvios/ChIJnunca-existiu")).toBeUndefined();

    // E um doc que existe mas não é pendência (envio limpo) também não.
    await expect(marcarPendenciaResolvida(db, "ChIJc", true)).rejects.toThrow(/não tem pendência/);
    expect(db.getDoc("filaEnvios/ChIJc")?.detalheEnvioResolvido).toBeUndefined();
  });
});
