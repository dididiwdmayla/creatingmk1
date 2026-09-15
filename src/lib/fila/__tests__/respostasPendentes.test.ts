import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import {
  adicionarMensagemAoGrupo,
  listarGruposPendentes,
  reivindicarGrupoMaduro,
  restaurarGrupoComErro,
} from "../respostasPendentes";

const T0 = new Date("2026-03-01T10:00:00.000Z");

function depois(segundos: number): Date {
  return new Date(T0.getTime() + segundos * 1000);
}

describe("adicionarMensagemAoGrupo", () => {
  it("cria o grupo na primeira mensagem", async () => {
    const db = new FakeFirestore();
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "oi", recebidoEm: T0.toISOString() }, T0);

    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.leadId).toBe("lead1");
    expect(grupo.mensagens).toEqual([{ texto: "oi", recebidoEm: T0.toISOString() }]);
    expect(grupo.primeiraMensagemEm).toBe(T0.toISOString());
    expect(grupo.ultimaMensagemEm).toBe(T0.toISOString());
  });

  it("mensagem nova REABRE a janela: acumula e avança ultimaMensagemEm", async () => {
    const db = new FakeFirestore();
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "oi", recebidoEm: T0.toISOString() }, T0);
    const t2 = depois(10);
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "tudo bem?", recebidoEm: t2.toISOString() }, t2);

    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.mensagens.map((m) => m.texto)).toEqual(["oi", "tudo bem?"]);
    expect(grupo.primeiraMensagemEm).toBe(T0.toISOString());
    expect(grupo.ultimaMensagemEm).toBe(t2.toISOString());
  });
});

describe("reivindicarGrupoMaduro", () => {
  it("devolve null quando o grupo ainda não venceu a janela", async () => {
    const db = new FakeFirestore();
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "oi", recebidoEm: T0.toISOString() }, T0);

    const claim = await reivindicarGrupoMaduro(db, "lead1", depois(10), 45);
    expect(claim).toBeNull();
  });

  it("devolve null quando não há grupo nenhum", async () => {
    const db = new FakeFirestore();
    expect(await reivindicarGrupoMaduro(db, "fantasma", T0, 45)).toBeNull();
  });

  it("reivindica e ESVAZIA o doc quando o grupo venceu a janela", async () => {
    const db = new FakeFirestore();
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "oi", recebidoEm: T0.toISOString() }, T0);

    const claim = await reivindicarGrupoMaduro(db, "lead1", depois(45), 45);

    expect(claim?.mensagens.map((m) => m.texto)).toEqual(["oi"]);
    const [restante] = await listarGruposPendentes(db);
    expect(restante.mensagens).toEqual([]);
  });

  it("um segundo reivindicar sobre o mesmo doc esvaziado devolve null (sem processar duas vezes)", async () => {
    const db = new FakeFirestore();
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "oi", recebidoEm: T0.toISOString() }, T0);
    await reivindicarGrupoMaduro(db, "lead1", depois(45), 45);

    const segundo = await reivindicarGrupoMaduro(db, "lead1", depois(50), 45);
    expect(segundo).toBeNull();
  });

  it("mensagem que chega DEPOIS da reivindicação começa um grupo novo, sem se misturar com o claim", async () => {
    const db = new FakeFirestore();
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "oi", recebidoEm: T0.toISOString() }, T0);
    await reivindicarGrupoMaduro(db, "lead1", depois(45), 45);

    const t3 = depois(46);
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "e aí?", recebidoEm: t3.toISOString() }, t3);

    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.mensagens.map((m) => m.texto)).toEqual(["e aí?"]);
  });
});

describe("restaurarGrupoComErro", () => {
  it("devolve as mensagens do claim que falhou ao grupo pendente, com o erro marcado", async () => {
    const db = new FakeFirestore();
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "oi", recebidoEm: T0.toISOString() }, T0);
    const claim = await reivindicarGrupoMaduro(db, "lead1", depois(45), 45);

    await restaurarGrupoComErro(db, claim!, "cota estourada");

    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.mensagens.map((m) => m.texto)).toEqual(["oi"]);
    expect(grupo.ultimoErro).toBe("cota estourada");
    expect(grupo.tentativas).toBe(1);
  });

  it("mescla com mensagem nova que chegou durante a falha, mantendo a mais antiga/mais recente", async () => {
    const db = new FakeFirestore();
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "oi", recebidoEm: T0.toISOString() }, T0);
    const claim = await reivindicarGrupoMaduro(db, "lead1", depois(45), 45);

    const t3 = depois(46);
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "e aí?", recebidoEm: t3.toISOString() }, t3);

    await restaurarGrupoComErro(db, claim!, "timeout");

    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.mensagens.map((m) => m.texto)).toEqual(["oi", "e aí?"]);
    expect(grupo.primeiraMensagemEm).toBe(T0.toISOString());
    expect(grupo.ultimaMensagemEm).toBe(t3.toISOString());
  });

  it("o grupo restaurado fica MADURO de novo (retentável no próximo flush)", async () => {
    const db = new FakeFirestore();
    await adicionarMensagemAoGrupo(db, "lead1", { texto: "oi", recebidoEm: T0.toISOString() }, T0);
    const claim = await reivindicarGrupoMaduro(db, "lead1", depois(45), 45);
    await restaurarGrupoComErro(db, claim!, "falha");

    const segundoClaim = await reivindicarGrupoMaduro(db, "lead1", depois(46), 45);
    expect(segundoClaim?.mensagens.map((m) => m.texto)).toEqual(["oi"]);
    expect(segundoClaim?.tentativas).toBe(1);
  });
});
