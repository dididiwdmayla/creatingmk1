import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../metrics/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(cookie?: string): Request {
  return new Request("http://localhost/api/metrics", {
    headers: cookie ? { cookie } : {},
  });
}

function seedLead(
  id: string,
  extra: Record<string, unknown>,
): void {
  db.seed(`leads/${id}`, {
    placeId: id,
    nome: id,
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...extra,
  });
}

describe("GET /api/metrics", () => {
  it("estado zerado sem leads", async () => {
    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      contatosHoje: 0,
      contatosSemana: 0,
      taxaResposta: 0,
      demosCriadas: 0,
    });
  });

  it("reflete os leads persistidos", async () => {
    seedLead("A", {
      status: "respondeu",
      contato: {
        primeiroContatoEm: new Date().toISOString(),
        respondeuEm: new Date().toISOString(),
      },
    });

    const res = await GET(request());

    const data = await res.json();
    expect(data.contatosHoje).toBe(1);
    expect(data.taxaResposta).toBe(1);
  });

  it("membro vê só as ações carimbadas com o id dele", async () => {
    const agora = new Date().toISOString();
    seedLead("A", {
      status: "contactado",
      contato: { primeiroContatoEm: agora, primeiroContatoPor: "m1" },
      demo: { skinId: "s", themeId: "t", dados: {}, criadoEm: agora, criadoPor: "m1", atualizadoEm: agora },
    });
    seedLead("B", {
      status: "contactado",
      contato: { primeiroContatoEm: agora, primeiroContatoPor: "outro" },
      demo: { skinId: "s", themeId: "t", dados: {}, criadoEm: agora, atualizadoEm: agora },
    });
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const data = await (await GET(request(cookie))).json();

    expect(data.contatosHoje).toBe(1);
    expect(data.demosCriadas).toBe(1);
    expect(data.porUsuario).toBeUndefined();
  });

  it("admin vê agregado + porUsuario (buscas, demos, contatos) com nomes", async () => {
    const agora = new Date().toISOString();
    seedLead("A", {
      status: "contactado",
      contato: { primeiroContatoEm: agora, primeiroContatoPor: "m1" },
      demo: { skinId: "s", themeId: "t", dados: {}, criadoEm: agora, criadoPor: "m1", atualizadoEm: agora },
    });
    db.seed("buscas/b1", {
      id: "b1",
      nome: "dentista 01/07",
      nicho: "dentista",
      regiao: "Sarandi PR",
      cor: "#2f82e0",
      criadaEm: agora,
      totalCriados: 3,
      totalExistentes: 0,
      userId: "m1",
    });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 0,
      criadoEm: agora,
      atualizadoEm: agora,
    });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const data = await (await GET(request(cookie))).json();

    expect(data.contatosHoje).toBe(1);
    expect(data.demosCriadas).toBe(1);
    expect(data.porUsuario).toEqual([
      { userId: "m1", nome: "Ana", buscas: 1, demos: 1, contatos: 1 },
    ]);
  });
});
