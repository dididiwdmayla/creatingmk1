import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET as getMe } from "../me/route";
import { GET as listar, POST as criar } from "../usuarios/route";
import { PATCH as editar } from "../usuarios/[id]/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(
  method: string,
  cookie: string | undefined,
  body?: unknown,
): Request {
  return new Request("http://localhost/api/usuarios", {
    method,
    headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/me", () => {
  it("devolve o usuário logado sem o hash de senha", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", nome: "Ana", papel: "membro" });

    const res = await getMe(request("GET", cookie));

    expect(res.status).toBe(200);
    const { usuario } = await res.json();
    expect(usuario.id).toBe("m1");
    expect(usuario.papel).toBe("membro");
    expect(usuario.senhaHash).toBeUndefined();
  });

  it("sem sessão válida → 401", async () => {
    const res = await getMe(request("GET", undefined));

    expect(res.status).toBe(401);
  });

  it("sessão de versão antiga (revogada) → 401", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", sessao: 1 });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "m1",
      papel: "membro",
      ativo: true,
      sessao: 2,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const res = await getMe(request("GET", cookie));

    expect(res.status).toBe(401);
  });
});

describe("GET/POST /api/usuarios (admin)", () => {
  it("membro → 403; sem sessão → 401", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    expect((await listar(request("GET", cookie))).status).toBe(403);
    expect((await listar(request("GET", undefined))).status).toBe(401);
  });

  it("admin lista sem hashes e cria membro", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const criado = await criar(request("POST", cookie, { nome: "Ana", senha: "1234" }));
    expect(criado.status).toBe(200);
    const { usuario } = await criado.json();
    expect(usuario.temSenha).toBe(true);
    expect(usuario.senhaHash).toBeUndefined();

    const lista = await (await listar(request("GET", cookie))).json();
    expect(lista.usuarios.map((u: { nome: string }) => u.nome)).toEqual(["admin", "Ana"]);
  });

  it("payload inválido → 400 com problemas", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await criar(request("POST", cookie, { nome: "", papel: "chefe", x: 1 }));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas).toEqual([
      "nome deve ser string não vazia",
      "papel deve ser um de: admin, membro",
      "chave desconhecida: x",
    ]);
  });
});

describe("PATCH /api/usuarios/[id] (admin)", () => {
  it("admin redefine senha de um membro (sessão do membro é revogada)", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 0,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const res = await editar(request("PATCH", cookie, { senha: "nova-1234" }), params("m1"));

    expect(res.status).toBe(200);
    const { usuario } = await res.json();
    expect(usuario.temSenha).toBe(true);
    expect(usuario.sessao).toBe(1);
  });

  it("membro não edita usuários → 403", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await editar(request("PATCH", cookie, { ativo: false }), params("m1"));

    expect(res.status).toBe(403);
  });

  it("sem nenhum campo → 400; usuário inexistente → 404", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    expect((await editar(request("PATCH", cookie, {}), params("admin"))).status).toBe(400);
    expect(
      (await editar(request("PATCH", cookie, { ativo: false }), params("nope"))).status,
    ).toBe(404);
  });
});
