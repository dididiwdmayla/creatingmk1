import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import {
  atualizarUsuario,
  criarUsuario,
  excluirUsuario,
  getUsuario,
  getUsuarioPorNome,
  listUsuarios,
  seedUsuariosSeVazio,
} from "../repo";
import { hashSenha, verificarSenha } from "../senha";

const NOW = new Date("2026-07-02T12:00:00.000Z");

describe("senha (PBKDF2)", () => {
  it("hash confere com a senha original e rejeita outra", async () => {
    const hash = await hashSenha("minha-senha");

    expect(hash).toMatch(/^pbkdf2:100000:[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(await verificarSenha("minha-senha", hash)).toBe(true);
    expect(await verificarSenha("outra", hash)).toBe(false);
  });

  it("hash ausente ou malformado nunca confere", async () => {
    expect(await verificarSenha("x", undefined)).toBe(false);
    expect(await verificarSenha("x", "lixo")).toBe(false);
    expect(await verificarSenha("x", "pbkdf2:abc:00:00")).toBe(false);
  });

  it("dois hashes da mesma senha diferem (salt aleatório)", async () => {
    expect(await hashSenha("s")).not.toBe(await hashSenha("s"));
  });
});

describe("seedUsuariosSeVazio (migração da senha única)", () => {
  it("cria admin com a APP_PASSWORD + 2 membros sem senha", async () => {
    const db = new FakeFirestore();

    expect(await seedUsuariosSeVazio(db, "senha-antiga", NOW)).toBe(true);

    const admin = await getUsuario(db, "admin");
    expect(admin?.papel).toBe("admin");
    expect(await verificarSenha("senha-antiga", admin?.senhaHash)).toBe(true);
    const m1 = await getUsuario(db, "membro-1");
    expect(m1?.papel).toBe("membro");
    expect(m1?.ativo).toBe(true);
    expect(m1?.senhaHash).toBeUndefined();
    expect((await listUsuarios(db)).map((u) => u.id)).toEqual([
      "admin",
      "membro-1",
      "membro-2",
    ]);
  });

  it("não recria nada se a coleção já tem docs", async () => {
    const db = new FakeFirestore();
    db.seed("usuarios/x", { id: "x", nome: "x", papel: "membro", ativo: true, sessao: 0 });

    expect(await seedUsuariosSeVazio(db, "s", NOW)).toBe(false);
    expect(await getUsuario(db, "admin")).toBeUndefined();
  });
});

describe("criarUsuario / getUsuarioPorNome", () => {
  it("cria membro com senha e encontra por nome sem caixa", async () => {
    const db = new FakeFirestore();

    const criado = await criarUsuario(db, { nome: "Ana", senha: "1234" }, NOW);

    expect(criado.papel).toBe("membro");
    expect(criado.ativo).toBe(true);
    const achado = await getUsuarioPorNome(db, "  aNa ");
    expect(achado?.id).toBe(criado.id);
    expect(await verificarSenha("1234", achado?.senhaHash)).toBe(true);
  });

  it("rejeita nome duplicado (sem caixa) e senha curta", async () => {
    const db = new FakeFirestore();
    await criarUsuario(db, { nome: "Ana" }, NOW);

    await expect(criarUsuario(db, { nome: "ANA" }, NOW)).rejects.toThrow(/já existe/);
    await expect(criarUsuario(db, { nome: "Beto", senha: "12" }, NOW)).rejects.toThrow(
      /ao menos 4/,
    );
  });
});

describe("atualizarUsuario", () => {
  it("redefinir senha incrementa a versão de sessão (revoga cookies antigos)", async () => {
    const db = new FakeFirestore();
    const ana = await criarUsuario(db, { nome: "Ana", senha: "1234" }, NOW);

    const depois = await atualizarUsuario(db, ana.id, { senha: "nova-senha" }, NOW);

    expect(depois.sessao).toBe(ana.sessao + 1);
    expect(await verificarSenha("nova-senha", depois.senhaHash)).toBe(true);
    expect(await verificarSenha("1234", depois.senhaHash)).toBe(false);
  });

  it("desativar incrementa a sessão; renomear não", async () => {
    const db = new FakeFirestore();
    const ana = await criarUsuario(db, { nome: "Ana" }, NOW);

    const renomeada = await atualizarUsuario(db, ana.id, { nome: "Ana Paula" }, NOW);
    expect(renomeada.sessao).toBe(0);

    const desativada = await atualizarUsuario(db, ana.id, { ativo: false }, NOW);
    expect(desativada.ativo).toBe(false);
    expect(desativada.sessao).toBe(1);
  });

  it("guarda-corpo: o último admin ativo não pode ser desativado nem rebaixado", async () => {
    const db = new FakeFirestore();
    await seedUsuariosSeVazio(db, "s", NOW);

    await expect(atualizarUsuario(db, "admin", { ativo: false }, NOW)).rejects.toThrow(
      /último admin/,
    );
    await expect(atualizarUsuario(db, "admin", { papel: "membro" }, NOW)).rejects.toThrow(
      /último admin/,
    );

    // Com um segundo admin ativo, aí sim pode.
    await criarUsuario(db, { nome: "Beto", papel: "admin", senha: "1234" }, NOW);
    const rebaixado = await atualizarUsuario(db, "admin", { papel: "membro" }, NOW);
    expect(rebaixado.papel).toBe("membro");
  });

  it("usuário inexistente → NotFound", async () => {
    const db = new FakeFirestore();

    await expect(atualizarUsuario(db, "nope", { ativo: false }, NOW)).rejects.toThrow(
      /não encontrado/,
    );
  });
});

describe("excluirUsuario", () => {
  it("apaga o doc do usuário e os contadores de cota dele, mantendo os de outros", async () => {
    const db = new FakeFirestore();
    const ana = await criarUsuario(db, { nome: "Ana" }, NOW);
    const beto = await criarUsuario(db, { nome: "Beto" }, NOW);
    db.seed(`usage_users/${ana.id}/dias/2026-07-15`, { buscas: 3, enriquecimentos: 1 });
    db.seed(`usage_users/${ana.id}/dias/2026-07-16`, { buscas: 1, enriquecimentos: 0 });
    db.seed(`usage_users/${beto.id}/dias/2026-07-15`, { buscas: 5, enriquecimentos: 2 });

    await excluirUsuario(db, ana.id, beto.id);

    expect(await getUsuario(db, ana.id)).toBeUndefined();
    expect(db.getDoc(`usage_users/${ana.id}/dias/2026-07-15`)).toBeUndefined();
    expect(db.getDoc(`usage_users/${ana.id}/dias/2026-07-16`)).toBeUndefined();
    // Cotas de outro usuário não são tocadas.
    expect(db.getDoc(`usage_users/${beto.id}/dias/2026-07-15`)).toBeDefined();
  });

  it("bloqueia excluir a si mesmo", async () => {
    const db = new FakeFirestore();
    const ana = await criarUsuario(db, { nome: "Ana" }, NOW);

    await expect(excluirUsuario(db, ana.id, ana.id)).rejects.toThrow(/próprio usuário/);
    expect(await getUsuario(db, ana.id)).toBeDefined();
  });

  it("bloqueia excluir o último admin", async () => {
    const db = new FakeFirestore();
    await seedUsuariosSeVazio(db, "s", NOW);

    // Um "requisitante" qualquer (a rota já garante que só admin chega aqui;
    // o guarda-corpo do repositório é a defesa incondicional).
    await expect(excluirUsuario(db, "admin", "outro-id")).rejects.toThrow(/último admin/);
    expect(await getUsuario(db, "admin")).toBeDefined();
  });

  it("com um segundo admin, dá pra excluir um dos dois", async () => {
    const db = new FakeFirestore();
    await seedUsuariosSeVazio(db, "s", NOW);
    const beto = await criarUsuario(db, { nome: "Beto", papel: "admin" }, NOW);

    await excluirUsuario(db, "admin", beto.id);

    expect(await getUsuario(db, "admin")).toBeUndefined();
    expect(await getUsuario(db, beto.id)).toBeDefined();
  });

  it("usuário inexistente → NotFound", async () => {
    const db = new FakeFirestore();

    await expect(excluirUsuario(db, "nope", "quem-pediu")).rejects.toThrow(/não encontrado/);
  });
});
