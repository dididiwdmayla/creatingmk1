import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import {
  contadorComEnvio,
  contadorComFalha,
  contadorComInvalido,
  contadorComResposta,
  diaOperacionalKey,
  lerContadorFila,
  momentoFimIntervalo,
  momentoFimTetoHora,
} from "../contadores";

describe("diaOperacionalKey", () => {
  it("inicioHora=0 é a mesma chave do calendário em São Paulo", () => {
    // 2026-03-10T02:00Z = 2026-03-09 23:00 em São Paulo (UTC-3)
    const now = new Date("2026-03-10T02:00:00Z");
    expect(diaOperacionalKey(now, 0)).toBe("2026-03-09");
  });

  it("antes do corte, ainda conta como o dia anterior", () => {
    // 2026-03-10T07:00Z = 2026-03-10 04:00 em São Paulo
    const now = new Date("2026-03-10T07:00:00Z");
    expect(diaOperacionalKey(now, 5)).toBe("2026-03-09");
  });

  it("depois do corte, já é o dia novo", () => {
    // 2026-03-10T09:00Z = 2026-03-10 06:00 em São Paulo
    const now = new Date("2026-03-10T09:00:00Z");
    expect(diaOperacionalKey(now, 5)).toBe("2026-03-10");
  });
});

describe("lerContadorFila", () => {
  it("doc ausente → tudo zero, sem erro", async () => {
    const db = new FakeFirestore();
    const snapshot = await lerContadorFila(db, new Date("2026-03-10T12:00:00Z"), 0);
    expect(snapshot).toEqual({ totalDoDia: 0, ultimaHora: 0, segundosDesdeUltimoEvento: null });
  });

  it("total do dia vem de `enviados`; última hora filtra `envios` pela janela deslizante", async () => {
    const db = new FakeFirestore();
    const now = new Date("2026-03-10T12:00:00Z");
    db.seed("filaContadores/2026-03-10", {
      enviados: 5,
      envios: [
        "2026-03-10T11:50:00Z", // 10min atrás — dentro da hora
        "2026-03-10T11:10:00Z", // 50min atrás — dentro da hora
        "2026-03-10T10:00:00Z", // 2h atrás — fora
      ],
      ultimoEventoEm: "2026-03-10T11:50:00Z",
    });

    const snapshot = await lerContadorFila(db, now, 0);

    expect(snapshot.totalDoDia).toBe(5);
    expect(snapshot.ultimaHora).toBe(2);
    expect(snapshot.segundosDesdeUltimoEvento).toBe(600);
  });

  it("respeita o dia operacional (inicioDiaOperacionalHora), não a chave de calendário UTC", async () => {
    const db = new FakeFirestore();
    // 2026-03-10T07:00Z = 04:00 em São Paulo → antes do corte de 5h, dia operacional = 09
    db.seed("filaContadores/2026-03-09", { enviados: 3, envios: [], ultimoEventoEm: null });

    const snapshot = await lerContadorFila(db, new Date("2026-03-10T07:00:00Z"), 5);

    expect(snapshot.totalDoDia).toBe(3);
  });

  it("dado sujo (enviados não-número, envios não-array) não quebra — vira zero/vazio", async () => {
    const db = new FakeFirestore();
    db.seed("filaContadores/2026-03-10", { enviados: "cinco", envios: "não é lista" });

    const snapshot = await lerContadorFila(db, new Date("2026-03-10T12:00:00Z"), 0);

    expect(snapshot).toEqual({ totalDoDia: 0, ultimaHora: 0, segundosDesdeUltimoEvento: null });
  });
});

describe("contadorComEnvio / contadorComFalha / contadorComInvalido — puros", () => {
  const AGORA = new Date("2026-03-10T12:00:00Z");

  it("doc ausente começa com falhas/invalidos/semPrint em zero", () => {
    expect(contadorComEnvio(undefined, AGORA)).toMatchObject({
      enviados: 1,
      falhas: 0,
      invalidos: 0,
      semPrint: 0,
    });
  });

  it("contadorComEnvio com detalhe não vazio conta semPrint; sem detalhe, não", () => {
    expect(contadorComEnvio(undefined, AGORA, { semPrint: true }).semPrint).toBe(1);
    expect(contadorComEnvio(undefined, AGORA, { semPrint: false }).semPrint).toBe(0);
    expect(contadorComEnvio(undefined, AGORA).semPrint).toBe(0);
  });

  it("contadorComFalha incrementa falhas e NÃO toca envios/ultimoEventoEm", () => {
    const antes = { enviados: 2, envios: ["2026-03-10T11:00:00Z"], ultimoEventoEm: "2026-03-10T11:00:00Z" };
    const depois = contadorComFalha(antes);

    expect(depois).toEqual({
      enviados: 2,
      envios: ["2026-03-10T11:00:00Z"],
      ultimoEventoEm: "2026-03-10T11:00:00Z",
      falhas: 1,
      invalidos: 0,
      semPrint: 0,
      respostasEnviadas: 0,
    });
  });

  it("contadorComInvalido incrementa invalidos e NÃO toca envios/ultimoEventoEm", () => {
    const antes = { enviados: 2, envios: ["2026-03-10T11:00:00Z"], ultimoEventoEm: "2026-03-10T11:00:00Z" };
    const depois = contadorComInvalido(antes);

    expect(depois).toEqual({
      enviados: 2,
      envios: ["2026-03-10T11:00:00Z"],
      ultimoEventoEm: "2026-03-10T11:00:00Z",
      falhas: 0,
      invalidos: 1,
      semPrint: 0,
      respostasEnviadas: 0,
    });
  });

  it("falhas e invalidos empilham sobre o mesmo doc, cada um no seu campo", () => {
    const db = new FakeFirestore();
    const ref = db.collection("filaContadores").doc("2026-03-10");
    ref.set(contadorComFalha(undefined) as unknown as Record<string, unknown>);
    ref.set(contadorComFalha(db.getDoc("filaContadores/2026-03-10")) as unknown as Record<string, unknown>);
    ref.set(contadorComInvalido(db.getDoc("filaContadores/2026-03-10")) as unknown as Record<string, unknown>);

    expect(db.getDoc("filaContadores/2026-03-10")).toMatchObject({ falhas: 2, invalidos: 1, enviados: 0 });
  });
});

describe("momentoFimTetoHora — quando o portão teto_hora libera", () => {
  const AGORA = new Date("2026-03-10T12:00:00Z");

  it("undefined quando não há envio nenhum na janela (nada para esperar sair)", () => {
    expect(momentoFimTetoHora({ envios: [] }, 4, AGORA)).toBeUndefined();
  });

  it("um envio na janela, teto 1: libera 1h depois DELE", () => {
    const envios = ["2026-03-10T11:50:00Z"];
    expect(momentoFimTetoHora({ envios }, 1, AGORA)).toEqual(new Date("2026-03-10T12:50:00Z"));
  });

  it("teto 2 com 3 envios na janela: precisa do 2º mais antigo sair", () => {
    // 3 envios, teto 2 → precisa sair 3-2+1=2 dos mais antigos; libera
    // quando o 2º mais antigo (índice 1) completa 1h.
    const envios = [
      "2026-03-10T11:10:00Z", // mais antigo
      "2026-03-10T11:30:00Z",
      "2026-03-10T11:50:00Z",
    ];
    expect(momentoFimTetoHora({ envios }, 2, AGORA)).toEqual(new Date("2026-03-10T12:30:00Z"));
  });

  it("caso degenerado (tetoPorHora 0, janela vazia) devolve undefined em vez de mentir uma hora", () => {
    expect(momentoFimTetoHora({ envios: [] }, 0, AGORA)).toBeUndefined();
  });
});

describe("momentoFimIntervalo — quando o portão intervalo libera", () => {
  it("ultimoEventoEm + intervaloMinimoSegundos", () => {
    const doc = { ultimoEventoEm: "2026-03-10T11:57:00Z" };
    expect(momentoFimIntervalo(doc, 180)).toEqual(new Date("2026-03-10T12:00:00Z"));
  });

  it("undefined quando nunca houve evento", () => {
    expect(momentoFimIntervalo({ ultimoEventoEm: null }, 180)).toBeUndefined();
  });
});

describe("contadorComResposta — a coluna PRÓPRIA da resposta automática", () => {
  const doc = {
    enviados: 7,
    envios: ["2026-03-10T11:30:00.000Z"],
    ultimoEventoEm: "2026-03-10T11:30:00.000Z",
    falhas: 2,
    invalidos: 1,
    semPrint: 3,
    respostasEnviadas: 4,
  };

  it("anda SÓ respostasEnviadas", () => {
    expect(contadorComResposta(doc)).toEqual({ ...doc, respostasEnviadas: 5 });
  });

  it("não consome a meta de prospecção nem suja os portões de ritmo", () => {
    const depois = contadorComResposta(doc);
    // `enviados` é a metaDiaria; `envios`/`ultimoEventoEm` são o teto por
    // hora e o intervalo mínimo. Uma resposta que sai não pode fazer
    // nenhum dos três pensar que saiu uma abordagem.
    expect(depois.enviados).toBe(doc.enviados);
    expect(depois.envios).toEqual(doc.envios);
    expect(depois.ultimoEventoEm).toBe(doc.ultimoEventoEm);
    expect(depois.falhas).toBe(doc.falhas);
    expect(depois.invalidos).toBe(doc.invalidos);
    expect(depois.semPrint).toBe(doc.semPrint);
  });

  it("doc ausente começa do zero", () => {
    expect(contadorComResposta(undefined).respostasEnviadas).toBe(1);
  });

  it("o caminho inverso também vale: envio de prospecção não mexe nas respostas", () => {
    const now = new Date("2026-03-10T12:00:00Z");
    expect(contadorComEnvio(doc, now).respostasEnviadas).toBe(4);
    expect(contadorComFalha(doc).respostasEnviadas).toBe(4);
    expect(contadorComInvalido(doc).respostasEnviadas).toBe(4);
  });
});
