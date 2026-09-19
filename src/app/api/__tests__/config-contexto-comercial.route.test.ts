import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET, PUT } from "../config/contexto-comercial/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function putRequest(body: unknown, cookie?: string): Request {
  return new Request("http://localhost/api/config/contexto-comercial", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/config/contexto-comercial (aberto a qualquer sessão)", () => {
  it("devolve texto vazio quando não há doc", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ contexto: { texto: "" } });
  });

  it("membro comum também lê — não há sessão exigida", async () => {
    db.seed("config/contextoComercial", { texto: "Vendemos site a partir de R$1.500." });

    const res = await GET();

    expect((await res.json()).contexto.texto).toBe("Vendemos site a partir de R$1.500.");
  });
});

describe("PUT /api/config/contexto-comercial (restrito ao admin)", () => {
  it("admin salva e o GET seguinte reflete", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PUT(putRequest({ texto: "Fazemos site institucional." }, cookie));

    expect(res.status).toBe(200);
    expect((await res.json()).contexto.texto).toBe("Fazemos site institucional.");
    expect((await (await GET()).json()).contexto.texto).toBe("Fazemos site institucional.");
  });

  it("sem sessão → 401 unauthorized", async () => {
    const res = await PUT(putRequest({ texto: "x" }));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("membro → 403 forbidden, e nada é salvo", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await PUT(putRequest({ texto: "x" }, cookie));

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
    expect(db.getDoc("config/contextoComercial")).toBeUndefined();
  });

  it("chave desconhecida → 400 validation_error", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PUT(putRequest({ texto: "x", outraCoisa: 1 }, cookie));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
    expect(error.problemas).toEqual(["chave desconhecida: outraCoisa"]);
  });
});
