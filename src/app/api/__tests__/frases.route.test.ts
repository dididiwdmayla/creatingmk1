import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SKINS } from "@/lib/demos/registry";
import { FRASES_COLLECTION } from "@/lib/frases/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST as AVANCAR } from "../frases/avancar/route";
import { GET, PUT } from "../frases/route";

let db: FakeFirestore;

const BARBEARIA = "barbearia-editorial";

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
const avancarRequest = (body: unknown) => corpoRequest("/api/frases/avancar", "POST", body);

interface ConjuntoJson {
  skinId: string;
  skinNome: string;
  nicho: string;
  frases: string[];
  indice: number;
}

async function listar(): Promise<ConjuntoJson[]> {
  const { conjuntos } = await (await GET()).json();
  return conjuntos;
}

function doConjunto(conjuntos: ConjuntoJson[], skinId: string): ConjuntoJson {
  const achado = conjuntos.find((c) => c.skinId === skinId);
  if (!achado) throw new Error(`skin ${skinId} fora da listagem`);
  return achado;
}

describe("GET /api/frases", () => {
  it("lista UMA entrada por skin do registro, mesmo sem frases preenchidas", async () => {
    const conjuntos = await listar();

    expect(conjuntos.map((c) => c.skinId)).toEqual(SKINS.map((skin) => skin.id));
    expect(conjuntos[0].frases).toEqual(["", "", ""]);
  });

  it("devolve nome e nicho da skin resolvidos (a tela não importa o registro)", async () => {
    const conjunto = doConjunto(await listar(), BARBEARIA);

    expect(conjunto.skinNome).toBe("Barbearia Editorial");
    expect(conjunto.nicho).toBe("barbearia");
  });

  it("doc legado chaveado por texto de nicho NÃO vira linha na tela", async () => {
    db.seed(`${FRASES_COLLECTION}/barbearia`, { nicho: "barbearia", frases: ["antiga", "", ""] });
    db.seed(`${FRASES_COLLECTION}/__genericas__`, { nicho: "", frases: ["genérica", "", ""] });

    const conjuntos = await listar();

    expect(conjuntos).toHaveLength(SKINS.length);
    expect(conjuntos.every((c) => c.frases[0] !== "antiga" && c.frases[0] !== "genérica")).toBe(
      true,
    );
  });
});

describe("PUT /api/frases (restrito ao admin)", () => {
  it("admin salva os três slots e o GET seguinte reflete", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PUT(putRequest({ skinId: BARBEARIA, frases: ["a", "b", "c"] }, cookie));

    expect(res.status).toBe(200);
    expect(doConjunto(await listar(), BARBEARIA).frases).toEqual(["a", "b", "c"]);
  });

  it("cada skin tem o seu conjunto — salvar uma não mexe na irmã do mesmo nicho", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    await PUT(putRequest({ skinId: BARBEARIA, frases: ["a", "", ""] }, cookie));

    expect(doConjunto(await listar(), "barbearia2-sul").frases).toEqual(["", "", ""]);
  });

  it("sem sessão → 401 unauthorized", async () => {
    const res = await PUT(putRequest({ skinId: BARBEARIA, frases: [] }));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("membro → 403 forbidden", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await PUT(putRequest({ skinId: BARBEARIA, frases: [] }, cookie));

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
  });

  it("corpo inválido → 400 validation_error com problemas", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PUT(putRequest({ skinId: BARBEARIA, frases: [1], indice: 9 }, cookie));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
    expect(error.problemas).toEqual(["chave desconhecida: indice", "frases[0] deve ser string"]);
  });

  it("skinId fora do registro → 400 e nenhum doc criado", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PUT(putRequest({ skinId: "barbearia old school", frases: ["x"] }, cookie));

    expect(res.status).toBe(400);
    expect(db.getDoc(`${FRASES_COLLECTION}/barbearia old school`)).toBeUndefined();
  });
});

describe("POST /api/frases/avancar", () => {
  async function seedFrases(skinId: string, frases: string[]) {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    await PUT(putRequest({ skinId, frases }, cookie));
  }

  it("gira 1→2→3→1 no contador compartilhado", async () => {
    await seedFrases(BARBEARIA, ["a", "b", "c"]);

    const indices: number[] = [];
    for (let i = 0; i < 4; i++) {
      indices.push((await (await AVANCAR(avancarRequest({ skinId: BARBEARIA }))).json()).indice);
    }

    expect(indices).toEqual([1, 2, 0, 1]);
  });

  it("qualquer sessão avança — o contador é do time inteiro", async () => {
    await seedFrases(BARBEARIA, ["a", "b", "c"]);

    const res = await AVANCAR(avancarRequest({ skinId: BARBEARIA }));

    expect(res.status).toBe(200);
  });

  it("avançar não sobrescreve os textos que o admin acabou de salvar", async () => {
    await seedFrases(BARBEARIA, ["a", "b", "c"]);

    await AVANCAR(avancarRequest({ skinId: BARBEARIA }));

    const conjunto = doConjunto(await listar(), BARBEARIA);
    expect(conjunto.frases).toEqual(["a", "b", "c"]);
    expect(conjunto.indice).toBe(1);
  });

  it("skin sem conjunto salvo devolve 0 e não cria doc", async () => {
    const res = await AVANCAR(avancarRequest({ skinId: BARBEARIA }));

    expect((await res.json()).indice).toBe(0);
    expect(db.getDoc(`${FRASES_COLLECTION}/${BARBEARIA}`)).toBeUndefined();
  });

  it("skin fora do registro → 400", async () => {
    const res = await AVANCAR(avancarRequest({ skinId: "dentista" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
  });
});
