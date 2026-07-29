import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET as getMe } from "../me/route";
import { GET as listar, POST as criar } from "../usuarios/route";
import { DELETE as excluir, PATCH as editar } from "../usuarios/[id]/route";

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

describe("PATCH /api/usuarios/[id] — limites individuais (admin)", () => {
  it("admin define limites e eles persistem no doc", async () => {
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

    const res = await editar(
      request("PATCH", cookie, { limites: { buscasDia: 30, enriquecimentosSemana: 100 } }),
      params("m1"),
    );

    expect(res.status).toBe(200);
    expect(db.getDoc("usuarios/m1")?.limites).toEqual({
      buscasDia: 30,
      enriquecimentosSemana: 100,
    });
    // Limites não são credencial: não revogam a sessão do usuário.
    expect(db.getDoc("usuarios/m1")?.sessao).toBe(0);
  });

  it("null limpa só o campo indicado, mantendo os demais", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 0,
      limites: { buscasDia: 30, buscasSemana: 100 },
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    await editar(request("PATCH", cookie, { limites: { buscasDia: null } }), params("m1"));

    expect(db.getDoc("usuarios/m1")?.limites).toEqual({ buscasSemana: 100 });
  });

  it("limpar todos os campos remove o objeto limites por completo (ausente = sem limite)", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 0,
      limites: { buscasDia: 30 },
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    await editar(request("PATCH", cookie, { limites: { buscasDia: null } }), params("m1"));

    expect(db.getDoc("usuarios/m1")).not.toHaveProperty("limites");
  });

  it("limites inválidos (negativo, não-inteiro, chave desconhecida) → 400", async () => {
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

    const res = await editar(
      request("PATCH", cookie, { limites: { buscasDia: -1, buscasMes: 1.5, chuta: 1 } }),
      params("m1"),
    );

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas).toEqual([
      "limites.chuta não é um campo de limite conhecido",
      "limites.buscasDia deve ser inteiro ≥ 0 ou null (sem limite)",
      "limites.buscasMes deve ser inteiro ≥ 0 ou null (sem limite)",
    ]);
  });

  it("membro não altera o próprio limite por nenhum caminho (403, nada muda)", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 0,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const res = await editar(
      request("PATCH", cookie, { limites: { buscasDia: 999 } }),
      params("m1"),
    );

    expect(res.status).toBe(403);
    expect(db.getDoc("usuarios/m1")).not.toHaveProperty("limites");
  });
});

describe("DELETE /api/usuarios/[id] — excluir usuário (item 3)", () => {
  function seedMembro(id: string, nome = id): void {
    db.seed(`usuarios/${id}`, {
      id,
      nome,
      papel: "membro",
      ativo: true,
      sessao: 0,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
  }

  it("membro não exclui usuário → 403", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    seedMembro("m2");

    const res = await excluir(request("DELETE", cookie), params("m2"));

    expect(res.status).toBe(403);
    expect(db.getDoc("usuarios/m2")).toBeDefined();
  });

  it("admin exclui um membro: doc some, cotas apagadas", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    seedMembro("m2", "Beto");
    db.seed("usage_users/m2/dias/2026-07-15", { buscas: 3, enriquecimentos: 1 });

    const res = await excluir(request("DELETE", cookie), params("m2"));

    expect(res.status).toBe(204);
    expect(db.getDoc("usuarios/m2")).toBeUndefined();
    expect(db.getDoc("usage_users/m2/dias/2026-07-15")).toBeUndefined();
  });

  it("não dá pra excluir a si mesmo → 403", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await excluir(request("DELETE", cookie), params("admin"));

    expect(res.status).toBe(403);
    expect(db.getDoc("usuarios/admin")).toBeDefined();
  });

  it("com 2 admins, dá pra excluir um (o outro segue como admin)", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    db.seed("usuarios/admin2", {
      id: "admin2",
      nome: "admin2",
      papel: "admin",
      ativo: true,
      sessao: 0,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const res = await excluir(request("DELETE", cookie), params("admin2"));

    expect(res.status).toBe(204);
    expect(db.getDoc("usuarios/admin2")).toBeUndefined();
  });

  it("usuário inexistente → 404", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await excluir(request("DELETE", cookie), params("nope"));

    expect(res.status).toBe(404);
  });
});
