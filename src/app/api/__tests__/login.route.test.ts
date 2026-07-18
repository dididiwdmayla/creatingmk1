import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lerSessaoToken } from "@/lib/auth";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { hashSenha } from "@/lib/usuarios";
import { POST } from "../login/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function login(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

function cookieToken(res: Response): string {
  const cookie = res.headers.get("set-cookie") ?? "";
  return /radar_session=([^;]+)/.exec(cookie)?.[1] ?? "";
}

describe("POST /api/login (multiusuário)", () => {
  it("seed inicial: 1ª tentativa cria admin (senha = APP_PASSWORD) + 2 membros sem senha", async () => {
    const res = await login({ nome: "admin", senha: "segredo123" });

    expect(res.status).toBe(204);
    const admin = db.getDoc("usuarios/admin");
    expect(admin?.papel).toBe("admin");
    expect(admin?.ativo).toBe(true);
    expect(String(admin?.senhaHash)).toMatch(/^pbkdf2:/);
    for (const id of ["membro-1", "membro-2"]) {
      const membro = db.getDoc(`usuarios/${id}`);
      expect(membro?.papel).toBe("membro");
      expect(membro?.senhaHash).toBeUndefined();
    }
  });

  it("cookie carrega o id do usuário num token assinado httpOnly", async () => {
    const res = await login({ nome: "admin", senha: "segredo123" });

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie.toLowerCase()).toContain("httponly");
    const sessao = await lerSessaoToken(cookieToken(res), "segredo123");
    expect(sessao).toEqual({ userId: "admin", papel: "admin", versao: 0 });
  });

  it("nome ausente cai em admin (compat com o fluxo antigo de senha única)", async () => {
    const res = await login({ senha: "segredo123" });

    expect(res.status).toBe(204);
    expect((await lerSessaoToken(cookieToken(res), "segredo123"))?.userId).toBe("admin");
  });

  it("membro loga com a própria senha e o token carrega o id dele", async () => {
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 2,
      senhaHash: await hashSenha("senha-da-ana"),
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const res = await login({ nome: "ana", senha: "senha-da-ana" });

    expect(res.status).toBe(204);
    const sessao = await lerSessaoToken(cookieToken(res), "segredo123");
    expect(sessao).toEqual({ userId: "m1", papel: "membro", versao: 2 });
  });

  it("senha errada → 401 invalid_credentials, sem cookie", async () => {
    const res = await login({ nome: "admin", senha: "chute" });

    expect(res.status).toBe(401);
    const { error } = await res.json();
    expect(error.code).toBe("invalid_credentials");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("membro do seed sem senha definida → 401 (não loga até o admin definir)", async () => {
    await login({ nome: "admin", senha: "segredo123" }); // dispara o seed

    const res = await login({ nome: "membro-1", senha: "" });

    expect(res.status).toBe(401);
  });

  it("usuário desativado → 401 mesmo com a senha certa", async () => {
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: false,
      sessao: 0,
      senhaHash: await hashSenha("senha-da-ana"),
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const res = await login({ nome: "Ana", senha: "senha-da-ana" });

    expect(res.status).toBe(401);
  });

  it("com /usuarios já populada o seed não recria nada", async () => {
    await login({ nome: "admin", senha: "segredo123" });
    db.seed("usuarios/admin", {
      id: "admin",
      nome: "admin",
      papel: "admin",
      ativo: true,
      sessao: 1,
      senhaHash: await hashSenha("nova-senha"),
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    // A senha antiga (APP_PASSWORD) deixou de valer: o doc é a fonte da verdade.
    const res = await login({ nome: "admin", senha: "segredo123" });
    expect(res.status).toBe(401);

    const ok = await login({ nome: "admin", senha: "nova-senha" });
    expect(ok.status).toBe(204);
    expect((await lerSessaoToken(cookieToken(ok), "segredo123"))?.versao).toBe(1);
  });

  it("sem APP_PASSWORD no servidor → 503 config_error", async () => {
    vi.stubEnv("APP_PASSWORD", "");

    const res = await login({ nome: "admin", senha: "qualquer" });

    expect(res.status).toBe(503);
    const { error } = await res.json();
    expect(error.code).toBe("config_error");
  });
});
