import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FILA_CANDIDATOS_COLLECTION, FILA_CANDIDATOS_DOC } from "@/lib/fila/candidatos";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { GET as getDiagnostico } from "../fila/diagnostico/route";
import { GET as getProximo } from "../fila/proximo/route";
import { GET as getResumo } from "../fila/resumo/route";

/**
 * O CORTE DO LEGADO NA FILA — ver "O corte do legado" em ARCHITECTURE.md.
 *
 * O defeito: o planejador da automação aplicava `corteLegado` (lead criado
 * antes da data de corte não ganha demo — antes de `registrosEnvio`
 * existir, quem foi abordado à mão não deixou rastro), mas a ELEGIBILIDADE
 * da fila não aplicava. E a fila ordena do mais antigo para o mais novo:
 * lead legado sem vestígio, com uma demo feita à mão, ia para o TOPO — e
 * recebia de novo uma mensagem que já tinha recebido meses antes.
 *
 * A regra: o MESMO campo (`config/automacao.corteLegado`) e a MESMA função
 * que o planejador usa; lead sem `criadoEm` conta como legado; o lead
 * marcado à mão (`filaManual`) passa pelo corte — foi o operador que olhou.
 */

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const CHAVE = "chave-do-celular";
/** Terça, 10h no fuso do lead (offset 0): faixa `bom` da barbearia. */
const TERCA_10H = new Date("2026-09-29T10:00:00Z");

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-09-01T00:00:00.000Z" },
    demo: { skinId: "barbearia-editorial" },
    horarios: { faixas: [], utcOffsetMinutes: 0, obtidoEm: "2026-09-01T00:00:00.000Z" },
    capturas: {
      estado: "pronto",
      execucaoId: "exec-1",
      pedidoEm: "2026-09-01T00:00:00.000Z",
      imagens: [
        { ancora: "hero", tela: "celular", ordem: 1, url: "https://storage/hero-cel.png", largura: 780, altura: 1688 },
      ],
    },
    criadoEm: "2026-09-20T00:00:00.000Z",
    atualizadoEm: "2026-09-20T00:00:00.000Z",
    ...overrides,
  } as Lead;
}

function semear(...leads: Array<Lead | Record<string, unknown>>) {
  for (const l of leads) db.seed(`leads/${(l as Lead).placeId}`, l as unknown as Record<string, unknown>);
}

function semCriadoEm(id: string): Record<string, unknown> {
  const { criadoEm: _sem, ...resto } = lead(id);
  void _sem;
  return resto as unknown as Record<string, unknown>;
}

const autorizado = { authorization: `Bearer ${CHAVE}` };

async function proximo() {
  return (await getProximo(new Request("http://localhost/api/fila/proximo", { headers: autorizado }))).json();
}

function esquecerPool() {
  db.deleteDoc(`${FILA_CANDIDATOS_COLLECTION}/${FILA_CANDIDATOS_DOC}`);
}

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("RADAR_DEVICE_KEY", CHAVE);
  vi.stubEnv("RADAR_DEVICE_USER_ID", "admin");
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.useFakeTimers();
  vi.setSystemTime(TERCA_10H);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/fila/proximo — o corte do legado", () => {
  it("REPRODUÇÃO: lead legado sem vestígio NÃO passa na frente — e nem sai", async () => {
    // Corte padrão (2026-08-10, sem doc de config): o legado é de junho.
    semear(
      lead("ChIJlegado", { criadoEm: "2026-06-01T00:00:00.000Z" }),
      lead("ChIJnovo", { criadoEm: "2026-09-20T00:00:00.000Z" }),
    );

    const primeira = await proximo();
    const segunda = await proximo();

    expect(primeira.leadId).toBe("ChIJnovo");
    expect(segunda).toMatchObject({ temTarefa: false, motivo: "sem_leads_elegiveis" });
    expect(db.getDoc("filaEnvios/ChIJlegado")).toBeUndefined();
  });

  it("REPRODUÇÃO: lead SEM criadoEm conta como legado e não é entregue", async () => {
    semear(semCriadoEm("ChIJsemData"));

    const corpo = await proximo();

    expect(corpo).toMatchObject({ temTarefa: false, motivo: "sem_leads_elegiveis" });
    expect(db.getDoc("filaEnvios/ChIJsemData")).toBeUndefined();
  });

  it("lê o MESMO campo do planejador: corte em config/automacao.corteLegado", async () => {
    db.seed("config/automacao", { corteLegado: "2026-05-01" });
    semear(lead("ChIJjunho", { criadoEm: "2026-06-01T00:00:00.000Z" }));

    expect((await proximo()).leadId).toBe("ChIJjunho");
  });

  it("o dia do corte é em São Paulo e ENTRA (>= corte), o complemento exato do planejador", async () => {
    db.seed("config/automacao", { corteLegado: "2026-09-01" });
    semear(
      // 02:00Z de 1/9 = 23:00 de 31/8 em São Paulo → legado.
      lead("ChIJvespera", { criadoEm: "2026-09-01T02:00:00.000Z" }),
      // 03:00Z de 1/9 = 00:00 de 1/9 em São Paulo → entra.
      lead("ChIJdia", { criadoEm: "2026-09-01T03:00:00.000Z" }),
    );

    expect((await proximo()).leadId).toBe("ChIJdia");
    expect((await proximo()).motivo).toBe("sem_leads_elegiveis");
  });

  it("lead legado marcado à mão (`filaManual`) passa pelo corte — foi o operador que decidiu", async () => {
    semear(lead("ChIJlegadoManual", { criadoEm: "2026-06-01T00:00:00.000Z", filaManual: true }));

    expect((await proximo()).leadId).toBe("ChIJlegadoManual");
  });

  it("lead manual SEM criadoEm também passa, sem quebrar a ordenação", async () => {
    semear(
      { ...semCriadoEm("ChIJmanualSemData"), filaManual: true },
      lead("ChIJnovo"),
    );

    const primeira = await proximo();
    const segunda = await proximo();

    expect([primeira.leadId, segunda.leadId].sort()).toEqual(["ChIJmanualSemData", "ChIJnovo"]);
  });

  it("corte mudado com o pool ainda no TTL vale NA HORA — a releitura do lead barra", async () => {
    db.seed("config/automacao", { corteLegado: "2026-05-01" });
    semear(lead("ChIJjunho", { criadoEm: "2026-06-01T00:00:00.000Z" }));
    // O resumo constrói o pool (com o lead dentro) sem reservar nada.
    await getResumo(new Request("http://localhost/api/fila/resumo", { headers: autorizado }));

    db.seed("config/automacao", { corteLegado: "2026-08-10" });
    const corpo = await proximo();

    expect(corpo.temTarefa).toBe(false);
    // Reserva aberta na tentativa é devolvida, não fica pendurada.
    const envio = db.getDoc("filaEnvios/ChIJjunho");
    expect(envio === undefined || envio.expiraEm === new Date(0).toISOString()).toBe(true);
  });
});

describe("o funil conta o legado com etiqueta própria", () => {
  it("pool.estrutural.legado conta o legado sem vestígio; o contactado fora da fila continua na peneira dele", async () => {
    semear(
      lead("ChIJlegado", { criadoEm: "2026-06-01T00:00:00.000Z" }),
      semCriadoEm("ChIJsemData"),
      // Legado E com selo: conta pelo PRIMEIRO motivo (contactadoForaDaFila).
      lead("ChIJlegadoComSelo", {
        criadoEm: "2026-06-01T00:00:00.000Z",
        seloContato: { userId: "membro-1", em: "2026-06-02T00:00:00.000Z" },
      }),
      lead("ChIJnovo"),
    );
    esquecerPool();
    await getResumo(new Request("http://localhost/api/fila/resumo", { headers: autorizado }));
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await getDiagnostico(
      new Request("http://localhost/api/fila/diagnostico", { headers: { cookie } }),
    )).json();

    expect(corpo.pool.estrutural.legado).toBe(2);
    expect(corpo.pool.estrutural.contactadoForaDaFila).toBe(1);
    expect(corpo.elegiveis).toBe(1);
    // A data de corte viaja junto: a etiqueta do funil a mostra.
    expect(corpo.corteLegado).toBe("2026-08-10");
  });
});
