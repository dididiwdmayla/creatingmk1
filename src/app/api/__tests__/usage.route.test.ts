import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/config";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { GET } from "../usage/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const PERIOD = new Date().toISOString().slice(0, 7);

beforeEach(() => {
  db = new FakeFirestore();
});

describe("GET /api/usage", () => {
  it("estado zerado quando não há uso no mês", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      period: PERIOD,
      usage: {
        textSearch: 0,
        textSearchEnterprise: 0,
        detailsEssentials: 0,
        detailsEnterprise: 0,
        geocoding: 0,
      },
      caps: DEFAULT_CONFIG.caps,
      cotaGratis: DEFAULT_CONFIG.precos.cotaGratis,
      custoProjetado: { usd: 0, brl: 0 },
    });
  });

  it("projeta custo do excedente com preços e câmbio da config", async () => {
    db.seed(`usage/${PERIOD}`, { textSearch: 6_000, detailsEnterprise: 1_100 });
    db.seed("config/app", { precos: { usdBrl: 5.0 } });

    const res = await GET();

    const data = await res.json();
    // 1.000 × $32/1000 = $32; 100 × $20/1000 = $2 → $34 → R$170
    expect(data.custoProjetado.usd).toBeCloseTo(34, 10);
    expect(data.custoProjetado.brl).toBeCloseTo(170, 10);
    expect(data.usage.textSearch).toBe(6_000);
  });

  it("migração: contador legado detailsPro entra como detailsEnterprise", async () => {
    db.seed(`usage/${PERIOD}`, { detailsPro: 900 });

    const data = await (await GET()).json();

    expect(data.usage.detailsEnterprise).toBe(900);
  });

  it("ecoa caps customizados da config", async () => {
    db.seed("config/app", { caps: { textSearch: 500 } });

    const data = await (await GET()).json();

    expect(data.caps.textSearch).toBe(500);
    expect(data.caps.detailsEnterprise).toBe(DEFAULT_CONFIG.caps.detailsEnterprise);
  });
});
