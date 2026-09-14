import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { diaOperacionalKey, lerContadorFila } from "../contadores";

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
