import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarDemoAvulsa } from "@/lib/demos/avulsas/repo";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { saveDemo } from "@/lib/leads/repo";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET as GET_HOJE } from "../hoje/route";
import { GET as GET_LEADS } from "../leads/route";
import { GET as GET_METRICS } from "../metrics/route";

/**
 * A contraparte de rota do `fora-do-funil.test.ts` da lib: as telas do
 * funil consomem ESTAS respostas, e é aqui que um vazamento apareceria
 * pro operador. Cada teste compara a resposta ANTES e DEPOIS de existirem
 * demos avulsas — nada pode mudar.
 */

let db: FakeFirestore;
let cookie: string;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const CONFIG = { skinId: DEFAULT_SKIN.id, themeId: DEFAULT_SKIN.themeDefault.id };

beforeEach(async () => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
  // Admin: é o papel que enxerga o agregado + a quebra por usuário, ou
  // seja, a visão mais ampla possível do funil. Se a avulsa não vaza aqui,
  // não vaza pra ninguém.
  cookie = await cookieDeSessao(db, { id: "u1", nome: "Ana", papel: "admin" });

  db.seed("leads/A", {
    placeId: "A",
    nome: "Lead de verdade",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-08-01T00:00:00.000Z",
    atualizadoEm: "2026-08-01T00:00:00.000Z",
  });
  await saveDemo(db, "A", { ...CONFIG, dados: {} }, new Date("2026-08-01T00:00:00.000Z"), "u1");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function criarAvulsas() {
  await criarDemoAvulsa(db, { nome: "Avulsa 1" }, CONFIG, new Date(), "u1");
  await criarDemoAvulsa(db, { nome: "Avulsa 2" }, CONFIG, new Date(), "u1");
}

function req(url: string): Request {
  return new Request(url, { headers: { cookie } });
}

describe("GET /api/leads", () => {
  it("não devolve demo avulsa nenhuma", async () => {
    const antes = await (await GET_LEADS(req("http://localhost/api/leads"))).json();
    await criarAvulsas();
    const depois = await (await GET_LEADS(req("http://localhost/api/leads"))).json();

    expect(depois).toEqual(antes);
    expect(depois.leads).toHaveLength(1);
    expect(depois.leads[0].placeId).toBe("A");
  });
});

describe("GET /api/metrics", () => {
  it("`demosCriadas` e o rollup por usuário ignoram as avulsas", async () => {
    const antes = await (await GET_METRICS(req("http://localhost/api/metrics"))).json();
    await criarAvulsas();
    const depois = await (await GET_METRICS(req("http://localhost/api/metrics"))).json();

    expect(depois).toEqual(antes);
    expect(antes.demosCriadas).toBe(1);
    // Mesmo autor nas duas famílias: só a demo do lead conta pra ele.
    expect(antes.porUsuario.find((u: { userId: string }) => u.userId === "u1").demos).toBe(1);
  });
});

describe("GET /api/hoje", () => {
  // Esta rota CARIMBA a visita do usuário a cada chamada (é o delta de
  // "novos"), então comparar antes/depois compararia dois deltas
  // diferentes. A afirmação aqui é direta: com as avulsas já criadas, a
  // fila tem só o lead.
  it("nenhuma seção da fila conhece as avulsas", async () => {
    await criarAvulsas();
    const fila = await (await GET_HOJE(req("http://localhost/api/hoje"))).json();

    // "Demo pronta e lead ainda novo" é a seção que uma avulsa vazaria
    // primeiro, se ela fosse um lead: é demo salva com status "novo".
    expect(fila.demosParadas.map((l: { placeId: string }) => l.placeId)).toEqual(["A"]);
    expect(fila.novos.map((l: { placeId: string }) => l.placeId)).toEqual(["A"]);
    expect(fila.followUps).toEqual([]);
    expect(fila.abriramNaoResponderam).toEqual([]);
    // A meta de prospecção lê o contador `buscas` de usage_users, que uma
    // avulsa nunca toca.
    expect(fila.metaProspeccao.dia.usado).toBe(0);
  });
});
