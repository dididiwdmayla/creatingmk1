import { describe, expect, it } from "vitest";

import { FakeFirestore } from "../../testing/fake-firestore";
import { getUsoUsuario, zerarCotaDia } from "../userQuota";

const NOW = new Date("2026-07-02T12:00:00Z"); // quinta-feira, 02/07/2026

describe("getUsoUsuario", () => {
  it("tudo zero e sem limite quando não há docs nem limites configurados", async () => {
    const db = new FakeFirestore();

    const uso = await getUsoUsuario(db, "membro-1", "buscas", undefined, NOW);

    expect(uso.dia.usado).toBe(0);
    expect(uso.dia.limite).toBeUndefined();
    expect(uso.semana.usado).toBe(0);
    expect(uso.mes.usado).toBe(0);
  });

  it("soma os dias certos em cada janela (semana começa segunda)", async () => {
    const db = new FakeFirestore();
    db.seed("usage_users/membro-1/dias/2026-07-01", { buscas: 4 }); // quarta, mesma semana/mês
    db.seed("usage_users/membro-1/dias/2026-07-02", { buscas: 3 }); // hoje
    db.seed("usage_users/membro-1/dias/2026-06-15", { buscas: 10 }); // mês anterior — fora das duas janelas

    const uso = await getUsoUsuario(
      db,
      "membro-1",
      "buscas",
      { buscasDia: 5, buscasSemana: 20, buscasMes: 50 },
      NOW,
    );

    expect(uso.dia).toMatchObject({ usado: 3, limite: 5 });
    expect(uso.semana.usado).toBe(7);
    expect(uso.mes.usado).toBe(7);
  });

  it("contadores malformados viram 0", async () => {
    const db = new FakeFirestore();
    db.seed("usage_users/membro-1/dias/2026-07-02", { buscas: "muitos" });

    const uso = await getUsoUsuario(db, "membro-1", "buscas", undefined, NOW);
    expect(uso.dia.usado).toBe(0);
  });

  it("enriquecimentos e buscas são contadores independentes", async () => {
    const db = new FakeFirestore();
    db.seed("usage_users/membro-1/dias/2026-07-02", { buscas: 5, enriquecimentos: 2 });

    const buscas = await getUsoUsuario(db, "membro-1", "buscas", undefined, NOW);
    const enrich = await getUsoUsuario(db, "membro-1", "enriquecimentos", undefined, NOW);

    expect(buscas.dia.usado).toBe(5);
    expect(enrich.dia.usado).toBe(2);
  });
});

describe("zerarCotaDia", () => {
  it("zera só o contador do dia corrente, preservando outros dias", async () => {
    const db = new FakeFirestore();
    db.seed("usage_users/membro-1/dias/2026-07-02", { buscas: 9, enriquecimentos: 4 });
    db.seed("usage_users/membro-1/dias/2026-07-01", { buscas: 2 });

    await zerarCotaDia(db, "membro-1", NOW);

    expect(db.getDoc("usage_users/membro-1/dias/2026-07-02")).toMatchObject({
      buscas: 0,
      enriquecimentos: 0,
    });
    expect(db.getDoc("usage_users/membro-1/dias/2026-07-01")).toEqual({ buscas: 2 });
  });
});
