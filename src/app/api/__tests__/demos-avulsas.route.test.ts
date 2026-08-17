import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CAMPOS_IDENTIDADE_AVULSA, montarDemoDataAvulsa } from "@/lib/demos/avulsas/identidade";
import type { DemoAvulsa } from "@/lib/demos/avulsas/types";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { FakeDemoStorage } from "@/lib/testing/fake-storage";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET as LISTAR, POST as CRIAR } from "../demos-avulsas/route";
import { DELETE, GET, PATCH } from "../demos-avulsas/[id]/route";
import { PUT } from "../demos-avulsas/[id]/demo/route";

let db: FakeFirestore;
let storage: FakeDemoStorage;
let cookie: string;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));
vi.mock("@/lib/firebase/storage", () => ({ getDemoStorage: () => storage }));

const BASE = {
  skinId: DEFAULT_SKIN.id,
  themeId: DEFAULT_SKIN.themeDefault.id,
};

beforeEach(async () => {
  db = new FakeFirestore();
  storage = new FakeDemoStorage();
  vi.stubEnv("APP_PASSWORD", "segredo123");
  cookie = await cookieDeSessao(db, { id: "u1", nome: "Ana" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function criar(body: unknown, comCookie = cookie): Promise<Response> {
  return CRIAR(
    new Request("http://localhost/api/demos-avulsas", {
      method: "POST",
      ...(comCookie && { headers: { cookie: comCookie } }),
      body: JSON.stringify(body),
    }),
  );
}

function listar(comCookie = cookie): Promise<Response> {
  return LISTAR(
    new Request("http://localhost/api/demos-avulsas", {
      ...(comCookie && { headers: { cookie: comCookie } }),
    }),
  );
}

function ler(id: string, comCookie = cookie): Promise<Response> {
  return GET(
    new Request(`http://localhost/api/demos-avulsas/${id}`, {
      ...(comCookie && { headers: { cookie: comCookie } }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function patch(id: string, body: unknown, comCookie = cookie): Promise<Response> {
  return PATCH(
    new Request(`http://localhost/api/demos-avulsas/${id}`, {
      method: "PATCH",
      ...(comCookie && { headers: { cookie: comCookie } }),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function apagar(id: string, comCookie = cookie): Promise<Response> {
  return DELETE(
    new Request(`http://localhost/api/demos-avulsas/${id}`, {
      method: "DELETE",
      ...(comCookie && { headers: { cookie: comCookie } }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function salvar(id: string, body: unknown, comCookie = cookie): Promise<Response> {
  return PUT(
    new Request(`http://localhost/api/demos-avulsas/${id}/demo`, {
      method: "PUT",
      ...(comCookie && { headers: { cookie: comCookie } }),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

async function criada(extra: Record<string, unknown> = {}): Promise<DemoAvulsa> {
  const res = await criar({ ...BASE, nome: "Barbearia do Zé", ...extra });
  expect(res.status).toBe(201);
  return (await res.json()).avulsa as DemoAvulsa;
}

describe("POST /api/demos-avulsas", () => {
  it("cria a demo com a identidade digitada", async () => {
    const avulsa = await criada({
      pais: "Portugal",
      cidade: "Lisboa",
      telefone: "+351 21 000 0000",
      instagram: "@zebarbearia",
    });

    expect(avulsa.id).toBeTruthy();
    expect(avulsa.pais).toBe("Portugal");
    expect(avulsa.demo.dados.nome).toBe("Barbearia do Zé");
    expect(avulsa.demo.dados.cidade).toBe("Lisboa");
    expect(avulsa.demo.dados.telefone).toBe("+351 21 000 0000");
    expect(avulsa.demo.dados.instagram).toBe("@zebarbearia");
    expect(avulsa.criadoPor).toBe("u1");
  });

  it("aplica a configuração do diálogo (efeito e modo de imagem)", async () => {
    const avulsa = await criada({
      dados: { imagensModo: "grafico" },
      tema: { fundoEfeito: "gradiente" },
    });
    expect(avulsa.demo.dados.imagensModo).toBe("grafico");
    expect(avulsa.demo.tema?.fundoEfeito).toBe("gradiente");
  });

  it("campo de identidade não digitado some da página, nunca cai no template", async () => {
    const avulsa = await criada();
    const dados = montarDemoDataAvulsa(DEFAULT_SKIN.demoDataExemplo, avulsa.demo.dados, DEFAULT_SKIN.id);
    for (const campo of CAMPOS_IDENTIDADE_AVULSA) {
      expect(dados[campo], campo).toBe("");
    }
  });

  it("exige nome", async () => {
    const res = await criar({ ...BASE });
    expect(res.status).toBe(400);
    expect((await res.json()).error.problemas).toContain("nome é obrigatório");
  });

  it("recusa nome só com espaço", async () => {
    expect((await criar({ ...BASE, nome: "   " })).status).toBe(400);
  });

  it("recusa chave desconhecida", async () => {
    const res = await criar({ ...BASE, nome: "X", cnpj: "123" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.problemas).toContain("chave desconhecida: cnpj");
  });

  it("recusa skin fora do registro e preset que não é da skin", async () => {
    expect((await criar({ nome: "X", skinId: "inexistente", themeId: "a" })).status).toBe(400);
    expect((await criar({ ...BASE, nome: "X", themeId: "inexistente" })).status).toBe(400);
  });

  it("recusa conteúdo inválido pela MESMA validação do PUT do editor", async () => {
    const res = await criar({ ...BASE, nome: "X", dados: { chaveInventada: 1 } });
    expect(res.status).toBe(400);
  });

  it("401 sem sessão", async () => {
    expect((await criar({ ...BASE, nome: "X" }, "")).status).toBe(401);
  });
});

describe("GET /api/demos-avulsas", () => {
  it("lista as avulsas, mais recentes primeiro", async () => {
    await criada({ nome: "Primeira" });
    await criada({ nome: "Segunda" });

    const { avulsas } = await (await listar()).json();
    expect(avulsas).toHaveLength(2);
    expect(avulsas.every((a: DemoAvulsa) => a.demo.envios?.length)).toBe(true);
  });

  it("401 sem sessão", async () => {
    expect((await listar("")).status).toBe(401);
  });
});

describe("GET /api/demos-avulsas/[id]", () => {
  it("devolve a avulsa", async () => {
    const avulsa = await criada();
    const { avulsa: lida } = await (await ler(avulsa.id)).json();
    expect(lida.id).toBe(avulsa.id);
  });

  it("404 em id inexistente", async () => {
    expect((await ler("nao-existe")).status).toBe(404);
  });

  it("401 sem sessão", async () => {
    const avulsa = await criada();
    expect((await ler(avulsa.id, "")).status).toBe(401);
  });
});

describe("PUT /api/demos-avulsas/[id]/demo", () => {
  it("salva a configuração e preserva criadoEm/criadoPor", async () => {
    const avulsa = await criada();
    const res = await salvar(avulsa.id, { ...BASE, dados: { slogan: "Novo." } });
    expect(res.status).toBe(200);

    const { avulsa: salva } = await res.json();
    expect(salva.demo.dados.slogan).toBe("Novo.");
    expect(salva.demo.criadoEm).toBe(avulsa.demo.criadoEm);
    expect(salva.demo.criadoPor).toBe("u1");
  });

  it("recusa chave desconhecida no corpo (mesma validação da demo de lead)", async () => {
    const avulsa = await criada();
    expect((await salvar(avulsa.id, { ...BASE, dados: {}, inventada: 1 })).status).toBe(400);
  });

  it("404 em id inexistente e 401 sem sessão", async () => {
    expect((await salvar("nao-existe", { ...BASE, dados: {} })).status).toBe(404);
    const avulsa = await criada();
    expect((await salvar(avulsa.id, { ...BASE, dados: {} }, "")).status).toBe(401);
  });
});

describe("PATCH /api/demos-avulsas/[id]", () => {
  it("troca o país (idioma e moeda vêm dele)", async () => {
    const avulsa = await criada({ pais: "Portugal" });
    const { avulsa: depois } = await (await patch(avulsa.id, { pais: "Espanha" })).json();
    expect(depois.pais).toBe("Espanha");
  });

  it("string vazia apaga o país", async () => {
    const avulsa = await criada({ pais: "Portugal" });
    const { avulsa: depois } = await (await patch(avulsa.id, { pais: "" })).json();
    expect(depois.pais).toBeUndefined();
  });

  it("recusa chave desconhecida", async () => {
    const avulsa = await criada();
    expect((await patch(avulsa.id, { nome: "outro" })).status).toBe(400);
  });
});

describe("DELETE /api/demos-avulsas/[id]", () => {
  it("apaga o doc e as imagens do Storage", async () => {
    const avulsa = await criada();
    await storage.save(`demos/${avulsa.id}/hero-1.webp`, new Uint8Array([1]), "image/webp");

    expect((await apagar(avulsa.id)).status).toBe(200);
    expect((await ler(avulsa.id)).status).toBe(404);
    expect(storage.paths()).toEqual([]);
  });

  it("404 em id inexistente e 401 sem sessão", async () => {
    expect((await apagar("nao-existe")).status).toBe(404);
    const avulsa = await criada();
    expect((await apagar(avulsa.id, "")).status).toBe(401);
  });

  it("não toca em /leads", async () => {
    db.seed("leads/A", {
      placeId: "A",
      nome: "Lead",
      status: "novo",
      enriquecido: false,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
    const avulsa = await criada();
    await apagar(avulsa.id);
    expect((await db.collection("leads").get()).docs).toHaveLength(1);
  });
});
