import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { saveDemo } from "@/lib/leads/repo";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET as PROXIMO } from "../fila/proximo/route";
import { PUT as PUT_DEMO } from "../leads/[id]/demo/route";
import { POST as APROVACAO } from "../leads/[id]/demo/aprovacao/route";

/**
 * O PORTÃO DA APROVAÇÃO, de ponta a ponta pela rota que o celular chama:
 * demo automática pendente NUNCA sai; aprovada sai; manual sem `origem`
 * sai como sempre saiu. E as duas portas que poderiam furar o portão sem
 * ninguém perceber: o PUT do editor (que reescreve a demo inteira) e o
 * apagar da demo reprovada.
 */

const CHAVE = "chave-do-celular";
const TERCA_10H = new Date("2026-03-10T10:00:00Z");

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

function lead(id: string, demo: Partial<NonNullable<Lead["demo"]>> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
    demo: {
      skinId: "barbearia-editorial",
      themeId: "creme",
      dados: {},
      criadoEm: "2026-03-01T00:00:00.000Z",
      atualizadoEm: "2026-03-01T00:00:00.000Z",
      ...demo,
    },
    horarios: { faixas: [], utcOffsetMinutes: 0, obtidoEm: "2026-03-01T00:00:00.000Z" },
    capturas: {
      estado: "pronto",
      execucaoId: "exec-1",
      pedidoEm: "2026-03-01T00:00:00.000Z",
      imagens: [
        { ancora: "hero", tela: "celular", ordem: 1, url: "https://storage/hero-cel.png", largura: 780, altura: 1688 },
      ],
    },
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
  } as Lead;
}

function semear(l: Lead) {
  db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
}

async function proximo() {
  db.deleteDoc("filaCandidatos/pool");
  const res = await PROXIMO(
    new Request("http://localhost/api/fila/proximo", { headers: { authorization: `Bearer ${CHAVE}` } }),
  );
  return res.json();
}

function aprovar(id: string, aprovacao: string, cookie: string) {
  return APROVACAO(
    new Request(`http://localhost/api/leads/${id}/demo/aprovacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ aprovacao }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  db = new FakeFirestore();
  // Os leads deste arquivo são de março; o corte do legado tem testes
  // próprios (fila-legado.route.test.ts) — aqui ele fica antes deles.
  db.seed("config/automacao", { corteLegado: "2000-01-01" });
  vi.stubEnv("RADAR_DEVICE_KEY", CHAVE);
  // A fila só entrega com o que o confirmar exige configurado (lib/fila/saude.ts).
  vi.stubEnv("RADAR_DEVICE_USER_ID", "admin");
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.useFakeTimers();
  vi.setSystemTime(TERCA_10H);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("portão da aprovação na fila (/api/fila/proximo)", () => {
  it("demo automática PENDENTE não é entregue", async () => {
    semear(lead("ChIJpend", { origem: "automacao", aprovacao: "pendente" }));
    const corpo = await proximo();
    expect(corpo.temTarefa).toBe(false);
  });

  it("demo automática sem campo aprovação conta como pendente", async () => {
    semear(lead("ChIJpend", { origem: "automacao" }));
    expect((await proximo()).temTarefa).toBe(false);
  });

  it("demo automática REPROVADA não é entregue", async () => {
    semear(lead("ChIJrep", { origem: "automacao", aprovacao: "reprovada" }));
    expect((await proximo()).temTarefa).toBe(false);
  });

  it("demo automática APROVADA é entregue — com o contrato achatado de sempre", async () => {
    semear(lead("ChIJok", { origem: "automacao", aprovacao: "aprovada" }));
    const corpo = await proximo();
    expect(corpo.temTarefa).toBe(true);
    expect(corpo.leadId).toBe("ChIJok");
    // Contrato de /proximo inalterado: as MESMAS onze chaves, nenhuma nova.
    expect(Object.keys(corpo).sort()).toEqual(
      ["temTarefa", "tipo", "teste", "id", "leadId", "nome", "numero", "texto", "printUrl", "expiraEm", "motivo"].sort(),
    );
  });

  it("demo manual sem origem segue elegível como hoje", async () => {
    semear(lead("ChIJmanual"));
    const corpo = await proximo();
    expect(corpo.temTarefa).toBe(true);
    expect(corpo.leadId).toBe("ChIJmanual");
  });
});

describe("aprovar/reprovar (POST /api/leads/[id]/demo/aprovacao)", () => {
  it("aprovar à mão libera o lead na fila", async () => {
    semear(lead("ChIJpend", { origem: "automacao", aprovacao: "pendente" }));
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    const res = await aprovar("ChIJpend", "aprovada", cookie);
    expect(res.status).toBe(200);
    const { lead: salvo } = await res.json();
    expect(salvo.demo).toMatchObject({ aprovacao: "aprovada", aprovacaoPor: "m1" });
    expect((await proximo()).leadId).toBe("ChIJpend");
  });

  it("reprovar marca o LEAD e não apaga a demo", async () => {
    semear(lead("ChIJpend", { origem: "automacao", aprovacao: "pendente" }));
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    const { lead: salvo } = await (await aprovar("ChIJpend", "reprovada", cookie)).json();
    expect(salvo.demo.aprovacao).toBe("reprovada");
    expect(salvo.demo.skinId).toBe("barbearia-editorial");
    expect(salvo.automacaoReprovada).toMatchObject({ por: "m1" });
  });

  it("demo manual → 400 (não existe aprovação para ela)", async () => {
    semear(lead("ChIJmanual"));
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    expect((await aprovar("ChIJmanual", "aprovada", cookie)).status).toBe(400);
  });

  it("valor inválido → 400", async () => {
    semear(lead("ChIJpend", { origem: "automacao" }));
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    expect((await aprovar("ChIJpend", "pendente", cookie)).status).toBe(400);
  });
});

describe("o editor não fura o portão", () => {
  it("salvar a demo automática pelo PUT do editor preserva origem e aprovação pendente", async () => {
    semear(lead("ChIJpend", { origem: "automacao", aprovacao: "pendente", execucaoAutomacao: "exec-9" }));
    const res = await PUT_DEMO(
      new Request("http://localhost/api/leads/ChIJpend/demo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinId: "barbearia-editorial", themeId: "creme", dados: { slogan: "Novo" } }),
      }),
      { params: Promise.resolve({ id: "ChIJpend" }) },
    );
    expect(res.status).toBe(200);
    const { lead: salvo } = await res.json();
    expect(salvo.demo).toMatchObject({
      origem: "automacao",
      aprovacao: "pendente",
      execucaoAutomacao: "exec-9",
      dados: { slogan: "Novo" },
    });
    expect((await proximo()).temTarefa).toBe(false);
  });

  it("o corpo do PUT não aceita origem/aprovação (400)", async () => {
    semear(lead("ChIJpend", { origem: "automacao", aprovacao: "pendente" }));
    const res = await PUT_DEMO(
      new Request("http://localhost/api/leads/ChIJpend/demo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skinId: "barbearia-editorial", themeId: "creme", aprovacao: "aprovada" }),
      }),
      { params: Promise.resolve({ id: "ChIJpend" }) },
    );
    expect(res.status).toBe(400);
  });

  it("saveDemo grava a meta na criação e ela sobrevive a um segundo save sem meta", async () => {
    const base = lead("ChIJnovo");
    delete base.demo;
    semear(base);
    await saveDemo(db, "ChIJnovo", { skinId: "barbearia-editorial", themeId: "creme", dados: {} }, TERCA_10H, "automacao", {
      origem: "automacao",
      aprovacao: "pendente",
      execucaoAutomacao: "exec-1",
    });
    const depois = await saveDemo(db, "ChIJnovo", { skinId: "barbearia-editorial", themeId: "creme", dados: { slogan: "x" } });
    expect(depois.demo).toMatchObject({ origem: "automacao", aprovacao: "pendente", execucaoAutomacao: "exec-1", criadoPor: "automacao" });
  });
});
