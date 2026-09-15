import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { DEFAULT_FILA_CONFIG, loadFilaConfig, saveFilaConfig } from "../config";

const DOC = "config/fila";

describe("loadFilaConfig", () => {
  it("retorna os defaults quando o doc não existe (nunca erro, nunca envio irrestrito)", async () => {
    const db = new FakeFirestore();
    expect(await loadFilaConfig(db)).toEqual(DEFAULT_FILA_CONFIG);
  });

  it("mescla doc parcial sobre os defaults", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { metaDiaria: 30, ativo: false });

    const config = await loadFilaConfig(db);

    expect(config.metaDiaria).toBe(30);
    expect(config.ativo).toBe(false);
    expect(config.tetoPorHora).toBe(DEFAULT_FILA_CONFIG.tetoPorHora);
  });
});

describe("saveFilaConfig", () => {
  it("valida, mescla e persiste o doc completo", async () => {
    const db = new FakeFirestore();

    const salvo = await saveFilaConfig(db, { ativo: false, nichosPermitidos: ["dentista"] });

    expect(salvo.ativo).toBe(false);
    expect(salvo.nichosPermitidos).toEqual(["dentista"]);
    expect(salvo.metaDiaria).toBe(DEFAULT_FILA_CONFIG.metaDiaria);
    expect(db.getDoc(DOC)?.ativo).toBe(false);
  });

  it("substitui nichosPermitidos por inteiro (não é merge por item)", async () => {
    const db = new FakeFirestore();
    await saveFilaConfig(db, { nichosPermitidos: ["dentista", "barbearia"] });

    const salvo = await saveFilaConfig(db, { nichosPermitidos: [] });

    expect(salvo.nichosPermitidos).toEqual([]);
  });

  it("rejeita chave desconhecida", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { metaDiariaa: 10 })).rejects.toThrow(ValidationError);
  });

  it("rejeita metaDiaria negativa ou não inteira", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { metaDiaria: -1 })).rejects.toThrow(ValidationError);
    await expect(saveFilaConfig(db, { metaDiaria: 1.5 })).rejects.toThrow(ValidationError);
  });

  it("rejeita inicioDiaOperacionalHora fora de 0-23", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { inicioDiaOperacionalHora: 24 })).rejects.toThrow(
      ValidationError,
    );
    await expect(saveFilaConfig(db, { inicioDiaOperacionalHora: -1 })).rejects.toThrow(
      ValidationError,
    );
  });

  it("rejeita nichosPermitidos que não é lista de strings", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { nichosPermitidos: [1, 2] })).rejects.toThrow(
      ValidationError,
    );
  });

  it("respostaAgrupamentoSegundos vem 45 por default e é patcheável", async () => {
    const db = new FakeFirestore();
    expect((await loadFilaConfig(db)).respostaAgrupamentoSegundos).toBe(45);

    const salvo = await saveFilaConfig(db, { respostaAgrupamentoSegundos: 90 });
    expect(salvo.respostaAgrupamentoSegundos).toBe(90);
  });

  it("rejeita respostaAgrupamentoSegundos negativo ou não inteiro", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { respostaAgrupamentoSegundos: -1 })).rejects.toThrow(
      ValidationError,
    );
    await expect(saveFilaConfig(db, { respostaAgrupamentoSegundos: 1.5 })).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("resposta automática — os dois interruptores e o ritmo", () => {
  it("nasce DESLIGADA, e limitada à primeira resposta", () => {
    // O padrão de cada um é a decisão, não um detalhe: o mecanismo só liga
    // por ato explícito do admin, e ligado ele começa no recorte mais
    // conservador (só a primeira resposta do lead).
    expect(DEFAULT_FILA_CONFIG.respostaAutomatica).toBe(false);
    expect(DEFAULT_FILA_CONFIG.respostaAutomaticaApenasPrimeira).toBe(true);
  });

  it("doc ausente não liga nada", async () => {
    const db = new FakeFirestore();
    expect((await loadFilaConfig(db)).respostaAutomatica).toBe(false);
  });

  it("os dois são interruptores de verdade: ligam e desligam pelo patch", async () => {
    const db = new FakeFirestore();

    const ligada = await saveFilaConfig(db, {
      respostaAutomatica: true,
      respostaAutomaticaApenasPrimeira: false,
    });
    expect(ligada.respostaAutomatica).toBe(true);
    expect(ligada.respostaAutomaticaApenasPrimeira).toBe(false);

    // `false` explícito tem que sobrescrever o default `true` — é o caso que
    // um merge com `||` engoliria em silêncio.
    expect((await loadFilaConfig(db)).respostaAutomaticaApenasPrimeira).toBe(false);

    const desligada = await saveFilaConfig(db, { respostaAutomatica: false });
    expect(desligada.respostaAutomatica).toBe(false);
    // Desligar o mecanismo não mexe no outro interruptor.
    expect(desligada.respostaAutomaticaApenasPrimeira).toBe(false);
  });

  it("rejeita interruptor que não é booleano", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { respostaAutomatica: "sim" })).rejects.toThrow(
      ValidationError,
    );
    await expect(
      saveFilaConfig(db, { respostaAutomaticaApenasPrimeira: 1 }),
    ).rejects.toThrow(ValidationError);
  });

  it("o atraso vem 3 a 12 minutos e é patcheável", async () => {
    const db = new FakeFirestore();
    expect(DEFAULT_FILA_CONFIG.respostaDelayMinSegundos).toBe(180);
    expect(DEFAULT_FILA_CONFIG.respostaDelayMaxSegundos).toBe(720);

    const salvo = await saveFilaConfig(db, {
      respostaDelayMinSegundos: 60,
      respostaDelayMaxSegundos: 300,
    });
    expect(salvo.respostaDelayMinSegundos).toBe(60);
    expect(salvo.respostaDelayMaxSegundos).toBe(300);
  });

  it("aceita faixa INVERTIDA sem estourar — quem resolve é o sorteio", async () => {
    // Cada campo do painel salva no próprio blur: existe um instante em que
    // o mínimo já subiu e o máximo ainda não, e ele não pode virar erro.
    const db = new FakeFirestore();
    const salvo = await saveFilaConfig(db, { respostaDelayMinSegundos: 900 });
    expect(salvo.respostaDelayMinSegundos).toBe(900);
    expect(salvo.respostaDelayMaxSegundos).toBe(720);
  });

  it("rejeita atraso negativo ou não inteiro", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { respostaDelayMinSegundos: -1 })).rejects.toThrow(
      ValidationError,
    );
    await expect(saveFilaConfig(db, { respostaDelayMaxSegundos: 1.5 })).rejects.toThrow(
      ValidationError,
    );
  });

  it("a janela própria vem 8h–22h e aceita 0 a 23", async () => {
    const db = new FakeFirestore();
    expect(DEFAULT_FILA_CONFIG.respostaJanelaInicio).toBe(8);
    expect(DEFAULT_FILA_CONFIG.respostaJanelaFim).toBe(22);

    const salvo = await saveFilaConfig(db, { respostaJanelaInicio: 0, respostaJanelaFim: 23 });
    expect(salvo.respostaJanelaInicio).toBe(0);
    expect(salvo.respostaJanelaFim).toBe(23);
  });

  it("rejeita hora de janela fora de 0..23", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { respostaJanelaInicio: 24 })).rejects.toThrow(
      ValidationError,
    );
    await expect(saveFilaConfig(db, { respostaJanelaFim: -1 })).rejects.toThrow(ValidationError);
  });

  it("o teto diário de respostas é PRÓPRIO, separado da metaDiaria", async () => {
    const db = new FakeFirestore();
    expect(DEFAULT_FILA_CONFIG.respostasAutomaticasMaxDia).toBe(30);

    const salvo = await saveFilaConfig(db, { respostasAutomaticasMaxDia: 5 });
    expect(salvo.respostasAutomaticasMaxDia).toBe(5);
    // A cota de prospecção não se mexe junto.
    expect(salvo.metaDiaria).toBe(DEFAULT_FILA_CONFIG.metaDiaria);
  });

  it("rejeita teto de respostas negativo", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { respostasAutomaticasMaxDia: -1 })).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("numeroTeste — o destino do disparo de teste", () => {
  it("vem preenchido por default", () => {
    expect(DEFAULT_FILA_CONFIG.numeroTeste).toBe("5544984570105");
  });

  it("aceita dígitos com DDI e guarda sem espaço", async () => {
    const db = new FakeFirestore();
    const salvo = await saveFilaConfig(db, { numeroTeste: " 5544991543803 " });
    expect(salvo.numeroTeste).toBe("5544991543803");
  });

  it("aceita vazio — é o disparo de teste desligado, não um erro", async () => {
    const db = new FakeFirestore();
    const salvo = await saveFilaConfig(db, { numeroTeste: "" });
    expect(salvo.numeroTeste).toBe("");
  });

  it("recusa número com máscara: o WhatsApp do celular não resolve parêntese nem traço", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { numeroTeste: "(44) 99154-3803" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("recusa curto demais e comprido demais", async () => {
    const db = new FakeFirestore();
    await expect(saveFilaConfig(db, { numeroTeste: "123" })).rejects.toThrow(ValidationError);
    await expect(saveFilaConfig(db, { numeroTeste: "1".repeat(16) })).rejects.toThrow(
      ValidationError,
    );
  });

  it("doc com tipo errado no campo não derruba a leitura (o celular bate nela a noite toda)", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { numeroTeste: 5544984570105 });

    const config = await loadFilaConfig(db);

    expect(config.numeroTeste).toBe(DEFAULT_FILA_CONFIG.numeroTeste);
  });
});
