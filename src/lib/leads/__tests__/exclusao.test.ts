import { describe, expect, it } from "vitest";

import type { DemoStorage } from "@/lib/demos/imagens";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { excluirLeadDefinitivo, excluirLeadsDefinitivo } from "../exclusao";
import { getLead } from "../repo";

/**
 * A ÚNICA exclusão do app que destrói o doc de `/leads` — ver o cabeçalho
 * de `lib/leads/exclusao.ts` para o que ela destrói junto e por quê. O que
 * este teste cobra é exatamente a lista que a confirmação da tela promete.
 */

/** Storage em memória, no padrão do fake do Firestore. */
function fakeStorage() {
  const arquivos = new Set<string>();
  const storage: DemoStorage & { arquivos: Set<string> } = {
    arquivos,
    async save(path) {
      arquivos.add(path);
    },
    async deleteByPrefix(prefix) {
      for (const path of [...arquivos]) if (path.startsWith(prefix)) arquivos.delete(path);
    },
    publicUrl: (path) => `https://storage.example/${path}`,
    // `arquivos` fica exposto só para o teste conferir o que sobrou.
  };
  return storage;
}

function semearLeadCompleto(db: FakeFirestore, id: string) {
  db.seed(`leads/${id}`, {
    placeId: id,
    nome: "Barbearia Antiga",
    status: "novo",
    enriquecido: false,
    demo: {
      skinId: "barbearia-editorial",
      themeId: "creme",
      dados: {},
      criadoEm: "2026-07-01T12:00:00.000Z",
      atualizadoEm: "2026-07-01T12:00:00.000Z",
      envios: [{ token: "tok", geradoEm: "2026-07-01T12:00:00.000Z", canal: "link" }],
    },
    capturas: { estado: "pronto", imagens: [] },
    criadoEm: "2026-07-01T12:00:00.000Z",
    atualizadoEm: "2026-07-01T12:00:00.000Z",
  });
}

function semearEnvio(db: FakeFirestore, leadId: string) {
  db.seed(`filaEnvios/${leadId}`, {
    leadId,
    estado: "falhou",
    claimId: "c1",
    reservadoEm: "2026-07-02T23:00:00.000Z",
    expiraEm: "2026-07-02T23:05:00.000Z",
    dispositivo: "moto-g",
    tentativas: 3,
    ultimoErro: "sem whatsapp",
    enviadoEm: null,
  });
}

describe("excluirLeadDefinitivo", () => {
  it("apaga o doc do lead E o de filaEnvios", async () => {
    const db = new FakeFirestore();
    semearLeadCompleto(db, "A");
    semearEnvio(db, "A");

    const r = await excluirLeadDefinitivo(db, fakeStorage(), "A");

    expect(r).toMatchObject({ excluido: true, filaEnvioRemovido: true, storageFalhou: false });
    expect(await getLead(db, "A")).toBeUndefined();
    expect((await db.collection("filaEnvios").doc("A").get()).exists).toBe(false);
  });

  /**
   * A demo morava no campo `demo` do doc do lead: apagado o doc, a rota
   * pública não tem de onde ler e volta a 404. É o que a confirmação diz,
   * e é o que este teste fixa.
   */
  it("o lead some da base — /demo/{leadId} passa a não ter de onde ler", async () => {
    const db = new FakeFirestore();
    semearLeadCompleto(db, "A");
    await excluirLeadDefinitivo(db, fakeStorage(), "A");
    expect(await getLead(db, "A")).toBeUndefined();
  });

  it("apaga as imagens de demo E as capturas do lead no Storage", async () => {
    const db = new FakeFirestore();
    semearLeadCompleto(db, "A");
    semearLeadCompleto(db, "B");
    const storage = fakeStorage();
    await storage.save("demos/A/hero-1.webp", new Uint8Array(), "image/webp");
    await storage.save("capturas/A/hero-celular.png", new Uint8Array(), "image/png");
    await storage.save("capturas/A/previa.png", new Uint8Array(), "image/png");
    await storage.save("demos/B/hero-1.webp", new Uint8Array(), "image/webp");

    await excluirLeadDefinitivo(db, storage, "A");

    // Nada de "A" sobra; o vizinho não é tocado.
    expect([...storage.arquivos]).toEqual(["demos/B/hero-1.webp"]);
  });

  /**
   * Mesma postura das rotas de demo: a limpeza do Storage vem DEPOIS e não
   * derruba a operação. Doc apagado com arquivo sobrando é órfão; arquivo
   * apagado com doc de pé seria demo quebrada, que é pior.
   */
  it("falha no Storage não impede a exclusão — é contada, não propagada", async () => {
    const db = new FakeFirestore();
    semearLeadCompleto(db, "A");
    const storage: DemoStorage = {
      async save() {},
      async deleteByPrefix() {
        throw new Error("bucket fora do ar");
      },
      publicUrl: (p) => p,
    };

    const r = await excluirLeadDefinitivo(db, storage, "A");

    expect(r).toMatchObject({ excluido: true, storageFalhou: true });
    expect(await getLead(db, "A")).toBeUndefined();
  });

  it("lead sem doc em filaEnvios é apagado do mesmo jeito", async () => {
    const db = new FakeFirestore();
    semearLeadCompleto(db, "A");
    const r = await excluirLeadDefinitivo(db, fakeStorage(), "A");
    expect(r).toMatchObject({ excluido: true, filaEnvioRemovido: false });
  });

  it("id inexistente é no-op, não erro (duas abas mandando o mesmo lote)", async () => {
    const db = new FakeFirestore();
    const r = await excluirLeadDefinitivo(db, fakeStorage(), "fantasma");
    expect(r).toMatchObject({ excluido: false, filaEnvioRemovido: false });
  });
});

describe("excluirLeadsDefinitivo — o lote", () => {
  it("soma o que de fato aconteceu, ignorando o que já não existia", async () => {
    const db = new FakeFirestore();
    semearLeadCompleto(db, "A");
    semearEnvio(db, "A");
    semearLeadCompleto(db, "B");
    semearLeadCompleto(db, "C");

    const total = await excluirLeadsDefinitivo(db, fakeStorage(), ["A", "B", "fantasma"]);

    expect(total).toEqual({ excluidos: 2, filaEnviosRemovidos: 1, storageFalhou: 0 });
    expect(await getLead(db, "A")).toBeUndefined();
    expect(await getLead(db, "B")).toBeUndefined();
    // O que não estava no lote fica de pé.
    expect(await getLead(db, "C")).toBeDefined();
  });
});
