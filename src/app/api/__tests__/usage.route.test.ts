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
      usage: { textSearch: 0, detailsEssentials: 0, detailsPro: 0 },
      caps: DEFAULT_CONFIG.caps,
      cotaGratis: DEFAULT_CONFIG.precos.cotaGratis,
      custoProjetado: { usd: 0, brl: 0 },
    });
  });

  it("projeta custo do excedente com preços e câmbio da config", async () => {
    db.seed(`usage/${PERIOD}`, { textSearch: 11_000, detailsPro: 5_100 });
    db.seed("config/app", { precos: { usdBrl: 5.0 } });

    const res = await GET();

    const data = await res.json();
    // 1.000 × $32/1000 = $32; 100 × $17/1000 = $1,70 → $33,70 → R$168,50
    expect(data.custoProjetado.usd).toBeCloseTo(33.7, 10);
    expect(data.custoProjetado.brl).toBeCloseTo(168.5, 10);
    expect(data.usage.textSearch).toBe(11_000);
  });

  it("ecoa caps customizados da config", async () => {
    db.seed("config/app", { caps: { textSearch: 500 } });

    const data = await (await GET()).json();

    expect(data.caps.textSearch).toBe(500);
    expect(data.caps.detailsPro).toBe(DEFAULT_CONFIG.caps.detailsPro);
  });
});
