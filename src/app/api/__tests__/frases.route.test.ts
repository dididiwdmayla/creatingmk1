import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BUSCAS_COLLECTION } from "@/lib/buscas/types";
import { CHAVE_GENERICAS, FRASES_COLLECTION } from "@/lib/frases/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST as AVANCAR } from "../frases/avancar/route";
import { GET, PUT } from "../frases/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function corpoRequest(path: string, method: string, body: unknown, cookie?: string): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const putRequest = (body: unknown, cookie?: string) =>
  corpoRequest("/api/frases", "PUT", body, cookie);
const avancarRequest = (body: unknown) =>
  corpoRequest("/api/frases/avancar", "POST", body);

function seedBusca(id: string, nicho: string) {
  db.seed(`${BUSCAS_COLLECTION}/${id}`, {
    id,
    nome: `${nicho} 01/08`,
    nicho,
    regiao: "Sarandi PR",
    cor: "#2f82e0",
    criadaEm: "2026-08-01T00:00:00.000Z",
    totalCriados: 3,
    totalExistentes: 0,
  });
}

describe("GET /api/frases", () => {
  it("lista todo nicho já visto em busca, mesmo sem frases preenchidas", async () => {
    seedBusca("b1", "dentista");
    seedBusca("b2", "petshop");

    const { conjuntos, genericas } = await (await GET()).json();

    expect(conjuntos.map((c: { nicho: string }) => c.nicho)).toEqual(["dentista", "petshop"]);
    expect(conjuntos[0].frases).toEqual(["", "", ""]);
    expect(genericas.frases).toEqual(["", "", ""]);
  });

  it("nicho novo entra sozinho na listagem, sem cadastro manual", async () => {
    seedBusca("b1", "dentista");
    const antes = await (await GET()).json();
    expect(antes.conjuntos).toHaveLength(1);

    seedBusca("b2", "tatuagem");

    const depois = await (await GET()).json();
    expect(depois.conjuntos.map((c: { nicho: string }) => c.nicho)).toEqual([
      "dentista",
      "tatuagem",
    ]);
  });

  it("grafias diferentes do mesmo nicho viram UMA linha", async () => {
    seedBusca("b1", "Dentista");
    seedBusca("b2", "  dentista ");

    const { conjuntos } = await (await GET()).json();

    expect(conjuntos).toHaveLength(1);
  });

  it("nicho com conjunto salvo mas sem busca continua na lista", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    await PUT(putRequest({ nicho: "barbearia", frases: ["a", "", ""] }, cookie));

    const { conjuntos } = await (await GET()).json();

    expect(conjuntos).toEqual([
      expect.objectContaining({ nicho: "barbearia", frases: ["a", "", ""] }),
    ]);
  });
});

describe("PUT /api/frases (restrito ao admin)", () => {
  it("admin salva os três slots e o GET seguinte reflete", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PUT(putRequest({ nicho: "dentista", frases: ["a", "b", "c"] }, cookie));

    expect(res.status).toBe(200);
    const { conjuntos } = await (await GET()).json();
    expect(conjuntos[0].frases).toEqual(["a", "b", "c"]);
  });

  it("salva o conjunto genérico com nicho null", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    await PUT(putRequest({ nicho: null, frases: ["g1", "g2", "g3"] }, cookie));

    const { genericas, conjuntos } = await (await GET()).json();
    expect(genericas.frases).toEqual(["g1", "g2", "g3"]);
    // O genérico não vira linha de nicho na tela.
    expect(conjuntos).toEqual([]);
  });

  it("sem sessão → 401 unauthorized", async () => {
    const res = await PUT(putRequest({ nicho: "dentista", frases: [] }));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("membro → 403 forbidden", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await PUT(putRequest({ nicho: "dentista", frases: [] }, cookie));

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
  });

  it("corpo inválido → 400 validation_error com problemas", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PUT(putRequest({ nicho: "a", frases: [1], indice: 9 }, cookie));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
    expect(error.problemas).toEqual(["chave desconhecida: indice", "frases[0] deve ser string"]);
  });

  it("nicho reservado pelo conjunto genérico → 400", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PUT(putRequest({ nicho: CHAVE_GENERICAS, frases: ["x"] }, cookie));

    expect(res.status).toBe(400);
    expect(db.getDoc(`${FRASES_COLLECTION}/${CHAVE_GENERICAS}`)).toBeUndefined();
  });
});

describe("POST /api/frases/avancar", () => {
  async function seedFrases(nicho: string | null, frases: string[]) {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    await PUT(putRequest({ nicho, frases }, cookie));
  }

  it("gira 1→2→3→1 no contador compartilhado", async () => {
    await seedFrases("dentista", ["a", "b", "c"]);

    const indices: number[] = [];
    for (let i = 0; i < 4; i++) {
      indices.push((await (await AVANCAR(avancarRequest({ nicho: "dentista" }))).json()).indice);
    }

    expect(indices).toEqual([1, 2, 0, 1]);
  });

  it("qualquer sessão avança — o contador é do time inteiro", async () => {
    await seedFrases("dentista", ["a", "b", "c"]);

    const res = await AVANCAR(avancarRequest({ nicho: "dentista" }));

    expect(res.status).toBe(200);
  });

  it("avançar não sobrescreve os textos que o admin acabou de salvar", async () => {
    await seedFrases("dentista", ["a", "b", "c"]);

    await AVANCAR(avancarRequest({ nicho: "dentista" }));

    const { conjuntos } = await (await GET()).json();
    expect(conjuntos[0].frases).toEqual(["a", "b", "c"]);
    expect(conjuntos[0].indice).toBe(1);
  });

  it("nicho sem conjunto salvo devolve 0 e não cria doc", async () => {
    const res = await AVANCAR(avancarRequest({ nicho: "inexistente" }));

    expect((await res.json()).indice).toBe(0);
    const { conjuntos } = await (await GET()).json();
    expect(conjuntos).toEqual([]);
  });

  it("avança o conjunto genérico com nicho null", async () => {
    await seedFrases(null, ["g1", "g2", ""]);

    const res = await AVANCAR(avancarRequest({ nicho: null }));

    expect((await res.json()).indice).toBe(1);
  });

  it("nicho inválido → 400", async () => {
    const res = await AVANCAR(avancarRequest({ nicho: 7 }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
  });
});
