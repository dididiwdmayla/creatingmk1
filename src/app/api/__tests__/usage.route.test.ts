import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/config";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../usage/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const PERIOD = new Date().toISOString().slice(0, 7);

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(cookie?: string): Request {
  return new Request("http://localhost/api/usage", {
    headers: cookie ? { cookie } : {},
  });
}

describe("GET /api/usage", () => {
  it("estado zerado quando não há uso no mês", async () => {
    const res = await GET(request());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      period: PERIOD,
      usage: {
        textSearch: 0,
        textSearchEnterprise: 0,
        detailsEssentials: 0,
        detailsEnterprise: 0,
        detailsProHours: 0,
        geocoding: 0,
        aiGeneration: 0,
        aiTraducao: 0,
      },
      caps: DEFAULT_CONFIG.caps,
      cotaGratis: DEFAULT_CONFIG.precos.cotaGratis,
      custoProjetado: { usd: 0, brl: 0 },
    });
  });

  it("projeta custo do excedente com preços e câmbio da config", async () => {
    db.seed(`usage/${PERIOD}`, { textSearch: 6_000, detailsEnterprise: 1_100 });
    db.seed("config/app", { precos: { usdBrl: 5.0 } });

    const res = await GET(request());

    const data = await res.json();
    // 1.000 × $32/1000 = $32; 100 × $20/1000 = $2 → $34 → R$170
    expect(data.custoProjetado.usd).toBeCloseTo(34, 10);
    expect(data.custoProjetado.brl).toBeCloseTo(170, 10);
    expect(data.usage.textSearch).toBe(6_000);
  });

  it("migração: contador legado detailsPro entra como detailsEnterprise", async () => {
    db.seed(`usage/${PERIOD}`, { detailsPro: 900 });

    const data = await (await GET(request())).json();

    expect(data.usage.detailsEnterprise).toBe(900);
  });

  it("ecoa caps customizados da config", async () => {
    db.seed("config/app", { caps: { textSearch: 500 } });

    const data = await (await GET(request())).json();

    expect(data.caps.textSearch).toBe(500);
    expect(data.caps.detailsEnterprise).toBe(DEFAULT_CONFIG.caps.detailsEnterprise);
  });

  it("membro vê SÓ o próprio uso (e o custo projetado do uso dele)", async () => {
    db.seed(`usage/${PERIOD}`, {
      textSearch: 6_000,
      porUsuario: { m1: { textSearch: 10 }, admin: { textSearch: 5_990 } },
    });
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const data = await (await GET(request(cookie))).json();

    expect(data.usage.textSearch).toBe(10);
    expect(data.porUsuario).toBeUndefined();
    expect(data.custoProjetado.usd).toBe(0); // 10 requests: dentro da cota grátis
  });

  it("admin vê o agregado E a quebra porUsuario com nomes", async () => {
    db.seed(`usage/${PERIOD}`, {
      textSearch: 42,
      porUsuario: { m1: { textSearch: 12 }, admin: { textSearch: 30 } },
    });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 0,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const data = await (await GET(request(cookie))).json();

    expect(data.usage.textSearch).toBe(42);
    expect(data.porUsuario).toEqual([
      expect.objectContaining({ userId: "admin", nome: "admin" }),
      expect.objectContaining({ userId: "m1", nome: "Ana" }),
    ]);
    expect(data.porUsuario[1].usage.textSearch).toBe(12);
  });

  it("sessão de versão antiga (senha redefinida) volta ao agregado sem quebra", async () => {
    db.seed(`usage/${PERIOD}`, { textSearch: 7, porUsuario: { m1: { textSearch: 7 } } });
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro", sessao: 3 });
    // O doc agora diz sessao 5 — o cookie (versão 3) foi revogado.
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 5,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const data = await (await GET(request(cookie))).json();

    // Sem usuário identificável: resposta agregada, sem quebra (o proxy é
    // quem bloqueia anônimos de verdade).
    expect(data.usage.textSearch).toBe(7);
    expect(data.porUsuario).toBeUndefined();
  });
});
