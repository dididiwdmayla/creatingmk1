import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chavePar, idBuscaAutomacao } from "@/lib/automacao/pares";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../config/automacao/operador/route";

let db: FakeFirestore;
vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function busca(id: string, nicho: string, regiao: string, extra: Record<string, unknown> = {}) {
  db.seed(`buscas/${id}`, {
    id,
    nome: `${nicho} ${regiao}`,
    nicho,
    regiao,
    cor: "#2f82e0",
    criadaEm: "2026-09-01T00:00:00.000Z",
    totalCriados: 4,
    totalExistentes: 1,
    ...extra,
  });
}

/** Doc da automação do par com as execuções dadas (novos por noite, mais recente primeiro). */
function automacaoDoPar(nicho: string, regiao: string, novos: number[]) {
  const id = idBuscaAutomacao(chavePar(nicho, regiao));
  busca(id, nicho, regiao, { origem: "automacao", criadaEm: "2026-09-10T00:00:00.000Z" });
  novos.forEach((n, i) => {
    db.seed(`buscas/${id}/execucoes/e${i}`, {
      em: `2026-09-${String(25 - i).padStart(2, "0")}T06:30:00.000Z`,
      novos: n,
      existentes: 5,
    });
  });
}

function get(cookie?: string) {
  return GET(new Request("http://localhost/api/config/automacao/operador", { headers: { ...(cookie && { cookie }) } }));
}

describe("GET /api/config/automacao/operador", () => {
  it("nichos sem skin com buscas e leads, o de mais leads primeiro", async () => {
    busca("b1", "dentista", "Maringá PR");
    busca("b2", "Dentista", "Londrina PR");
    busca("b3", "barbearia", "Maringá PR"); // tem skin: fora
    busca("b4", "Pet Shop", "Maringá PR"); // sinônimo de petshop: fora
    busca("b5", "contabilidade", "Maringá PR", { totalCriados: 1, totalExistentes: 0 });

    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const corpo = await (await get(cookie)).json();
    expect(corpo.nichosSemSkin).toEqual([
      { nicho: "dentista", buscas: 2, leads: 10 },
      { nicho: "contabilidade", buscas: 1, leads: 1 },
    ]);
  });

  it("pares saturados pela régua da config — e só os que a automação já buscou", async () => {
    busca("op1", "barbearia", "Maringá PR");
    automacaoDoPar("barbearia", "Maringá PR", [0, 1, 1, 9]); // 3 últimas somam 2 < 3
    busca("op2", "barbearia", "Londrina PR");
    automacaoDoPar("barbearia", "Londrina PR", [2, 1, 0]); // somam 3: não saturado
    busca("op3", "barbearia", "Cascavel PR"); // nunca buscado pela automação

    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const corpo = await (await get(cookie)).json();
    expect(corpo.saturacao).toEqual({ execucoes: 3, minNovos: 3 });
    expect(corpo.paresSaturados).toEqual([
      {
        chave: chavePar("barbearia", "Maringá PR"),
        nicho: "barbearia",
        regiao: "Maringá PR",
        novos: [0, 1, 1],
        ultimaEm: "2026-09-25T06:30:00.000Z",
      },
    ]);

    // A régua é a da config: afrouxada, o par sai da lista.
    db.seed("config/automacao", { saturacaoMinNovos: 2 });
    expect((await (await get(cookie)).json()).paresSaturados).toEqual([]);
  });

  it("membro → 403, sem sessão → 401, segredo do laço → 401", async () => {
    vi.stubEnv("AUTOMACAO_SECRET", "segredo-do-laco");
    const membro = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    expect((await get(membro)).status).toBe(403);
    expect((await get()).status).toBe(401);
    const comSegredo = await GET(
      new Request("http://localhost/api/config/automacao/operador", {
        headers: { authorization: "Bearer segredo-do-laco" },
      }),
    );
    expect(comSegredo.status).toBe(401);
  });
});
