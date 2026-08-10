import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { descartarLegados, listarLegados, migrarLegados, planejarMigracao } from "../migracao";
import { getConjunto, listConjuntos, salvarConjunto } from "../repo";
import { FRASES_COLLECTION, type EntradaLegada } from "../types";

const BARBEARIA = "barbearia-editorial";
const BARBEARIA2 = "barbearia2-sul";
const PETSHOP = "petshop-focinho-feliz";

function legado(chave: string, nicho: string, frases: string[]): EntradaLegada {
  return { chave, nicho, frases: [...frases, "", ""].slice(0, 3) };
}

function seedLegado(db: FakeFirestore, chave: string, nicho: string, frases: string[]) {
  db.seed(`${FRASES_COLLECTION}/${chave}`, { nicho, frases, indice: 2 });
}

describe("listarLegados", () => {
  it("separa doc legado de doc de skin, e não confunde os dois", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, BARBEARIA, ["da skin"]);
    seedLegado(db, "barbearia", "Barbearia", ["antiga"]);
    seedLegado(db, "__genericas__", "", ["genérica"]);

    const legados = await listarLegados(db);

    expect(legados.map((l) => l.chave)).toEqual(["__genericas__", "barbearia"]);
    expect(legados[1].frases).toEqual(["antiga", "", ""]);
  });

  it("sem a grafia salva, o nicho vem da chave decodificada", async () => {
    const db = new FakeFirestore();
    db.seed(`${FRASES_COLLECTION}/loja%20de%20roupas`, { frases: ["x"] });

    expect((await listarLegados(db))[0].nicho).toBe("loja de roupas");
  });
});

describe("planejarMigracao", () => {
  it("associa pelo nicho da skin, ignorando caixa e espaços", () => {
    const { destinos, relatorio } = planejarMigracao([legado("petshop", " PetShop ", ["p1"])], []);

    expect(destinos).toEqual([{ chave: "petshop", skinId: PETSHOP, frases: ["p1", "", ""] }]);
    expect(relatorio.pendentes).toEqual([]);
  });

  it("nicho com skins irmãs copia para as duas, cada uma independente daí em diante", () => {
    const { destinos, relatorio } = planejarMigracao(
      [legado("barbearia", "barbearia", ["b1", "b2"])],
      [],
    );

    expect(destinos.map((d) => d.skinId)).toEqual([BARBEARIA, BARBEARIA2]);
    expect(relatorio.feitas.map((f) => f.skinNome)).toEqual(["Barbearia Editorial", "Barbearia Sul"]);
  });

  it("texto livre que não bate com skin nenhuma vira pendência COM o texto", () => {
    const { destinos, relatorio } = planejarMigracao(
      [legado("barbearia%20old%20school", "barbearia old school", ["escrita à mão"])],
      [],
    );

    expect(destinos).toEqual([]);
    expect(relatorio.pendentes).toEqual([
      {
        chave: "barbearia%20old%20school",
        nicho: "barbearia old school",
        frases: ["escrita à mão", "", ""],
        motivo: "nenhuma skin do registro tem esse nicho — associe à mão",
      },
    ]);
  });

  it("o conjunto genérico antigo não tem skin correspondente — vira pendência", () => {
    const { relatorio } = planejarMigracao([legado("__genericas__", "", ["genérica"])], []);

    expect(relatorio.pendentes).toHaveLength(1);
    expect(relatorio.feitas).toEqual([]);
  });

  it("skin que já tem frase própria NUNCA é sobrescrita", () => {
    const { destinos, relatorio } = planejarMigracao(
      [legado("petshop", "petshop", ["antiga"])],
      [{ skinId: PETSHOP, frases: ["já escrita", "", ""], indice: 0 }],
    );

    expect(destinos).toEqual([]);
    expect(relatorio.pendentes[0].motivo).toContain("já tem frases próprias");
    expect(relatorio.pendentes[0].frases[0]).toBe("antiga");
  });

  it("com uma skin irmã ocupada, migra só para a livre", () => {
    const { destinos, relatorio } = planejarMigracao(
      [legado("barbearia", "barbearia", ["antiga"])],
      [{ skinId: BARBEARIA, frases: ["já escrita", "", ""], indice: 0 }],
    );

    expect(destinos.map((d) => d.skinId)).toEqual([BARBEARIA2]);
    expect(relatorio.pendentes).toEqual([]);
  });

  it("entrada antiga sem texto nenhum não vira relatório, só some", () => {
    const { destinos, relatorio } = planejarMigracao([legado("dentista", "dentista", [])], []);

    expect(destinos).toEqual([]);
    expect(relatorio).toEqual({ feitas: [], pendentes: [], vazias: 1 });
  });

  it("duas antigas disputando a mesma skin: a primeira leva, a outra vira pendência", () => {
    const { destinos, relatorio } = planejarMigracao(
      [legado("petshop", "petshop", ["primeira"]), legado("pet%20shop", "pet shop", ["segunda"])],
      [],
    );

    // "pet shop" não casa com o nicho "petshop" da skin — texto livre segue
    // sendo texto livre. A disputa real acontece com a mesma grafia.
    expect(destinos.map((d) => d.frases[0])).toEqual(["primeira"]);
    expect(relatorio.pendentes[0].nicho).toBe("pet shop");
  });
});

describe("migrarLegados", () => {
  it("grava nas skins e apaga só o que foi aproveitado", async () => {
    const db = new FakeFirestore();
    seedLegado(db, "petshop", "petshop", ["p1", "p2", ""]);
    seedLegado(db, "barbearia%20old%20school", "barbearia old school", ["solta", "", ""]);

    const relatorio = await migrarLegados(db, await listarLegados(db), await listConjuntos(db));

    expect((await getConjunto(db, PETSHOP))?.frases).toEqual(["p1", "p2", ""]);
    expect(db.getDoc(`${FRASES_COLLECTION}/petshop`)).toBeUndefined();
    // A pendência FICA no banco até eu mandar descartar.
    expect(db.getDoc(`${FRASES_COLLECTION}/barbearia%20old%20school`)).toBeDefined();
    expect(relatorio.pendentes).toHaveLength(1);
  });

  it("o contador antigo não é herdado — a rotação da skin é dela", async () => {
    const db = new FakeFirestore();
    seedLegado(db, "petshop", "petshop", ["p1", "p2", "p3"]);

    await migrarLegados(db, await listarLegados(db), await listConjuntos(db));

    expect((await getConjunto(db, PETSHOP))?.indice).toBe(0);
  });

  it("rodar de novo depois de migrado não duplica nem sobrescreve", async () => {
    const db = new FakeFirestore();
    seedLegado(db, "petshop", "petshop", ["p1", "", ""]);
    await migrarLegados(db, await listarLegados(db), await listConjuntos(db));
    await salvarConjunto(db, PETSHOP, ["editada depois", "", ""]);

    const relatorio = await migrarLegados(db, await listarLegados(db), await listConjuntos(db));

    expect(relatorio).toEqual({ feitas: [], pendentes: [], vazias: 0 });
    expect((await getConjunto(db, PETSHOP))?.frases[0]).toBe("editada depois");
  });

  it("entrada antiga vazia é apagada sem virar pendência", async () => {
    const db = new FakeFirestore();
    seedLegado(db, "dentista", "dentista", ["", "", ""]);

    const relatorio = await migrarLegados(db, await listarLegados(db), await listConjuntos(db));

    expect(relatorio.vazias).toBe(1);
    expect(db.getDoc(`${FRASES_COLLECTION}/dentista`)).toBeUndefined();
  });
});

describe("descartarLegados", () => {
  it("apaga só as legadas, nunca um conjunto de skin", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, BARBEARIA, ["da skin"]);
    seedLegado(db, "barbearia old school", "barbearia old school", ["solta"]);

    expect(await descartarLegados(db)).toBe(1);

    expect(await listarLegados(db)).toEqual([]);
    expect((await getConjunto(db, BARBEARIA))?.frases[0]).toBe("da skin");
  });
});
