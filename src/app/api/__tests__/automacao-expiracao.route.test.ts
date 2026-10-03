import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { motivoInelegivelAutomacao } from "@/lib/automacao/elegivel";
import { motivoNaoExpira } from "@/lib/automacao/expiracao";
import type { ExecucaoAutomacao } from "@/lib/automacao/execucao";
import { VARREDURA_MAX } from "@/lib/automacao/varredura";
import type { DemoStorage } from "@/lib/demos/imagens";
import type { LeadDemo } from "@/lib/demos/types";
import type { FilaEnvioDoc } from "@/lib/fila/estado";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { FakeDemoStorage } from "@/lib/testing/fake-storage";
import { POST as FINALIZAR } from "../automacao/finalizar/route";
import { POST as PLANEJAR } from "../automacao/planejar/route";

/**
 * A VARREDURA das demos automáticas vencidas, pela rota que a roda de
 * verdade — `POST /api/automacao/planejar`, a primeira chamada da execução
 * diária. FakeFirestore, Storage em memória e o relógio congelado na
 * madrugada do agendamento (06:30 UTC). O critério puro tem os casos de
 * borda em `lib/automacao/__tests__/expiracao.test.ts`; aqui é o banco, o
 * Storage, a transação e o planejador.
 */

const SEGREDO = "segredo-automacao";
const AGORA = new Date("2026-10-03T06:30:00.000Z");
const HORA = 3_600_000;

let db: FakeFirestore;
let storage: DemoStorage;
vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));
vi.mock("@/lib/firebase/storage", () => ({ getDemoStorage: () => storage }));

function horasAtras(h: number): string {
  return new Date(AGORA.getTime() - h * HORA).toISOString();
}

/** A demo como a unidade "demo" da automação a grava. */
function demoAuto(overrides: Partial<LeadDemo> = {}): LeadDemo {
  return {
    skinId: "barbearia-editorial",
    themeId: "creme",
    dados: {},
    criadoEm: horasAtras(80),
    criadoPor: "automacao",
    atualizadoEm: horasAtras(80),
    origem: "automacao",
    aprovacao: "pendente",
    execucaoAutomacao: "exec-velha",
    envios: [
      { token: "t-link", geradoEm: horasAtras(80), canal: "link" },
      { token: "t-wa", geradoEm: horasAtras(80), canal: "whatsapp" },
    ],
    ...overrides,
  };
}

/** Lead novo, elegível para a automação, com demo automática de 80h e print pronto. */
function lead(id: string, extra: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Barbearia ${id}`,
    endereco: "Rua A, 1 - Maringá, PR, Brasil",
    status: "novo",
    enriquecido: false,
    telefone: "(44) 3222-0000",
    telefoneIntl: "+55 44 3222-0000",
    busca: { nicho: "barbearia", regiao: "Maringá PR", em: "2026-09-01T00:00:00.000Z" },
    demo: demoAuto(),
    capturas: {
      estado: "pronto",
      execucaoId: "cap-1",
      pedidoEm: horasAtras(79),
      imagens: [
        {
          ancora: "hero",
          tela: "celular",
          ordem: 1,
          url: `https://storage.googleapis.com/bucket-teste/capturas/${id}/celular-01-hero.png`,
          largura: 780,
          altura: 1688,
        },
      ],
    },
    criadoEm: "2026-09-01T00:00:00.000Z",
    atualizadoEm: horasAtras(79),
    ...extra,
  } as Lead;
}

function semear(l: Lead) {
  db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
}

/** Os arquivos que a demo deixa no Storage: as capturas e um upload do editor. */
async function arquivos(id: string) {
  const bytes = new Uint8Array([1, 2, 3]);
  await storage.save(`capturas/${id}/celular-01-hero.png`, bytes, "image/png");
  await storage.save(`capturas/${id}/previa-1.jpg`, bytes, "image/jpeg");
  await storage.save(`demos/${id}/hero-1.webp`, bytes, "image/webp");
}

function caminhos(): string[] {
  return (storage as FakeDemoStorage).paths();
}

function envio(id: string, extra: Partial<FilaEnvioDoc> = {}): Record<string, unknown> {
  return {
    leadId: id,
    estado: "reservado",
    claimId: "claim-1",
    reservadoEm: horasAtras(30),
    expiraEm: new Date(AGORA.getTime() - 30 * HORA + 5 * 60_000).toISOString(),
    reservas: 1,
    dispositivo: "android",
    tentativas: 0,
    ultimoErro: null,
    enviadoEm: null,
    ...extra,
  };
}

function config(extra: Record<string, unknown> = {}) {
  db.seed("config/automacao", { ativo: true, alvoEstoque: 1, ...extra });
}

function req(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: `Bearer ${SEGREDO}` },
    body: JSON.stringify(body),
  });
}

async function planejar() {
  const res = await PLANEJAR(req("/api/automacao/planejar", { disparo: "schedule" }));
  expect(res.status).toBe(200);
  return res.json();
}

function execucao(id: string): ExecucaoAutomacao {
  return db.getDoc(`automacaoExecucoes/${id}`) as unknown as ExecucaoAutomacao;
}

function leadSalvo(id: string): Lead {
  return db.getDoc(`leads/${id}`) as unknown as Lead;
}

beforeEach(() => {
  db = new FakeFirestore();
  storage = new FakeDemoStorage();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("api.github.com")) return new Response(null, { status: 204 });
      throw new Error(`fetch inesperado: ${url}`);
    }),
  );
  vi.stubEnv("AUTOMACAO_SECRET", SEGREDO);
  // A fila saudável: sem as duas exigidas, a varredura não roda (a fila
  // não teve chance de mandar).
  vi.stubEnv("RADAR_DEVICE_KEY", "chave-aparelho");
  vi.stubEnv("RADAR_DEVICE_USER_ID", "admin");
  vi.stubEnv("GITHUB_CAPTURAS_TOKEN", "token-gh");
  vi.stubEnv("GITHUB_CAPTURAS_REPO", "dono/radar");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("o prazo", () => {
  it("demo automática não enviada é apagada no prazo; antes do prazo, não", async () => {
    config();
    semear(lead("vencida"));
    semear(lead("nova", { demo: demoAuto({ criadoEm: horasAtras(71) }) }));
    await arquivos("vencida");
    await arquivos("nova");

    const corpo = await planejar();

    expect(leadSalvo("vencida").demo).toBeUndefined();
    expect(leadSalvo("nova").demo).toBeDefined();
    expect(caminhos().some((p) => p.includes("/vencida/"))).toBe(false);
    expect(caminhos().filter((p) => p.includes("/nova/"))).toHaveLength(3);
    expect(corpo.varredura).toMatchObject({ prazoHoras: 72, candidatas: 1, apagadas: 1, puladas: 0, apagados: ["vencida"] });
  });

  it("o prazo é o da config", async () => {
    config({ expiracaoDemoHoras: 96 });
    semear(lead("a"));
    await planejar();
    expect(leadSalvo("a").demo).toBeDefined();
  });
});

describe("demo enviada NÃO é apagada — cada critério sozinho", () => {
  const casos: Array<[string, Partial<Lead>, ((id: string) => void) | undefined, string]> = [
    ["status contactado", { status: "contactado" }, undefined, "status"],
    ["selo de contato", { seloContato: { userId: "admin", em: horasAtras(40) } }, undefined, "contato"],
    [
      "registro de envio",
      { registrosEnvio: [{ em: horasAtras(40), horaLocalLead: "10:00", diaSemanaLocalLead: 3 }] },
      undefined,
      "contato",
    ],
    ["primeiroContatoEm", { contato: { primeiroContatoEm: horasAtras(40) } }, undefined, "contato"],
    [
      "visita à demo",
      { demoVisitas: [{ id: "v1", em: horasAtras(40), interna: false, canal: "whatsapp" }] },
      undefined,
      "visita",
    ],
    [
      "token consumido",
      {
        demo: demoAuto({
          envios: [
            { token: "t-wa-2", geradoEm: horasAtras(40), canal: "whatsapp" },
            { token: "t-link", geradoEm: horasAtras(80), canal: "link" },
            { token: "t-wa", geradoEm: horasAtras(80), canal: "whatsapp" },
          ],
        }),
      },
      undefined,
      "tokenConsumido",
    ],
    [
      "reserva viva em filaEnvios",
      {},
      (id) =>
        db.seed(`filaEnvios/${id}`, envio(id, { reservadoEm: horasAtras(0.02), expiraEm: new Date(AGORA.getTime() + 60_000).toISOString() })),
      "filaEnvios",
    ],
    // A claim que venceu sem confirmação: está em REVISÃO, e pode ter saído.
    ["claim em revisão", {}, (id) => db.seed(`filaEnvios/${id}`, envio(id)), "filaEnvios"],
    [
      "claim devolvida (nada saiu, e mesmo assim protege: houve reserva)",
      {},
      (id) => db.seed(`filaEnvios/${id}`, envio(id, { expiraEm: "1970-01-01T00:00:00.000Z" })),
      "filaEnvios",
    ],
    [
      "claim que falhou",
      {},
      (id) => db.seed(`filaEnvios/${id}`, envio(id, { estado: "falhou", tentativas: 1, ultimoErro: "x" })),
      "filaEnvios",
    ],
  ];

  for (const [nome, extra, preparar, motivo] of casos) {
    it(nome, async () => {
      config();
      semear(lead("x", extra));
      preparar?.("x");
      await arquivos("x");

      const corpo = await planejar();

      expect(leadSalvo("x").demo).toBeDefined();
      expect(leadSalvo("x").capturas).toBeDefined();
      expect(leadSalvo("x").automacaoExpirada).toBeUndefined();
      expect(caminhos()).toHaveLength(3);
      expect(corpo.varredura).toMatchObject({ apagadas: 0 });
      // Protegida já na seleção — nem chega a ser candidata.
      expect(corpo.varredura.candidatas).toBe(0);
      // E protegida por ESTE critério, não por outro que a fixture tenha
      // deixado escapar: o primeiro motivo do critério é o do caso.
      const temDocFila = db.getDoc("filaEnvios/x") !== undefined;
      expect(motivoNaoExpira(leadSalvo("x"), { temDocFila }, { now: AGORA, prazoHoras: 72 })).toBe(motivo);
    });
  }

  it("ciclo em filaEnvios/{id}/ciclos (sem o doc principal) protege na releitura", async () => {
    config();
    semear(lead("x"));
    db.seed("filaEnvios/x/ciclos/claim-1", { claimId: "claim-1", leadId: "x", reservadoEm: horasAtras(30) });
    await arquivos("x");

    const corpo = await planejar();

    expect(leadSalvo("x").demo).toBeDefined();
    expect(caminhos()).toHaveLength(3);
    // A seleção não lê subcoleção; quem apaga lê — e pula.
    expect(corpo.varredura).toMatchObject({ candidatas: 1, apagadas: 0, puladas: 1, porMotivo: { ciclo: 1 } });
  });
});

describe("demo manual ou sem origem comprovada nunca é apagada", () => {
  it("manual, sem origem e automática sem as três marcas — mesmo com um ano", async () => {
    config();
    const umAno = horasAtras(24 * 365);
    semear(lead("manual", { demo: demoAuto({ origem: "manual", criadoPor: "admin", execucaoAutomacao: undefined, criadoEm: umAno }) }));
    semear(lead("antiga", { demo: demoAuto({ origem: undefined, criadoPor: "admin", execucaoAutomacao: undefined, criadoEm: umAno }) }));
    semear(lead("sem-execucao", { demo: demoAuto({ execucaoAutomacao: undefined, criadoEm: umAno }) }));
    semear(lead("autor-humano", { demo: demoAuto({ criadoPor: "admin", criadoEm: umAno }) }));
    for (const id of ["manual", "antiga", "sem-execucao", "autor-humano"]) await arquivos(id);

    const corpo = await planejar();

    for (const id of ["manual", "antiga", "sem-execucao", "autor-humano"]) {
      expect(leadSalvo(id).demo).toBeDefined();
    }
    expect(caminhos()).toHaveLength(12);
    expect(corpo.varredura).toMatchObject({ candidatas: 0, apagadas: 0 });
  });
});

describe("apagar", () => {
  it("remove as capturas e o estado de captura; o lead não volta ao planejador", async () => {
    config({ alvoEstoque: 5 });
    semear(lead("a", { demo: demoAuto({ aprovacao: "aprovada", aprovacaoEm: horasAtras(60) }) }));
    await arquivos("a");

    const corpo = await planejar();

    const salvo = leadSalvo("a");
    expect(salvo.demo).toBeUndefined();
    expect(salvo.capturas).toBeUndefined();
    expect(caminhos()).toEqual([]);
    // A marca do lead, já sem a pendência de Storage (os arquivos saíram).
    expect(salvo.automacaoExpirada).toEqual({
      em: AGORA.toISOString(),
      demoCriadaEm: horasAtras(80),
      skinId: "barbearia-editorial",
      aprovacao: "aprovada",
      execucaoId: corpo.execucaoId,
    });
    // O resto do lead continua lá.
    expect(salvo).toMatchObject({ status: "novo", nome: "Barbearia a", telefoneIntl: "+55 44 3222-0000" });
    expect(motivoInelegivelAutomacao(salvo, false, "2026-08-10")).toBe("expirada");

    // NA MESMA NOITE: o plano não o inclui (sem lead elegível, só a busca).
    expect(corpo.acao).toBe("executar");
    const plano = execucao(corpo.execucaoId);
    expect(plano.unidades.some((u) => u.tipo === "demo" && u.leadId === "a")).toBe(false);
    expect(plano.varredura).toMatchObject({ apagadas: 1, apagados: ["a"] });

    // E NA NOITE SEGUINTE também não.
    await FINALIZAR(req("/api/automacao/finalizar", { execucaoId: corpo.execucaoId }));
    vi.setSystemTime(new Date(AGORA.getTime() + 24 * HORA));
    const seguinte = await planejar();
    expect(execucao(seguinte.execucaoId).unidades.some((u) => u.tipo === "demo" && u.leadId === "a")).toBe(false);
    expect(leadSalvo("a").demo).toBeUndefined();
  });

  it("a demo apagada deixa de contar no estoque, e a mesma noite repõe", async () => {
    config({ alvoEstoque: 1 });
    // Aprovada, com print e fuso: conta como PRONTO.
    semear(
      lead("pronta-velha", {
        demo: demoAuto({ aprovacao: "aprovada" }),
        horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: horasAtras(80) },
      }),
    );
    // Elegível para a automação, sem demo.
    semear(lead("candidato", { demo: undefined, capturas: undefined }));

    const corpo = await planejar();

    expect(corpo).toMatchObject({ acao: "executar", estoque: { total: 0 }, falta: 1 });
    expect(execucao(corpo.execucaoId).unidades).toEqual([
      expect.objectContaining({ tipo: "demo", leadId: "candidato" }),
    ]);
  });

  it("aprovada ou reprovada, sem envio, vence igual", async () => {
    config();
    semear(lead("aprovada", { demo: demoAuto({ aprovacao: "aprovada" }) }));
    semear(lead("reprovada", { demo: demoAuto({ aprovacao: "reprovada" }), automacaoReprovada: { em: horasAtras(70), por: "admin" } }));
    const corpo = await planejar();
    expect(corpo.varredura.apagados.sort()).toEqual(["aprovada", "reprovada"]);
    expect(leadSalvo("reprovada").automacaoReprovada).toBeDefined();
  });
});

describe("lead que vira ENVIADO entre a seleção e a exclusão é pulado", () => {
  it("o aparelho reserva o lead depois que a transação leu filaEnvios", async () => {
    config();
    semear(lead("x"));
    await arquivos("x");
    // Logo depois da leitura de filaEnvios/x DENTRO da transação: a reserva
    // da fila chega. O commit falha, a transação roda de novo e vê o doc.
    db.aoLer("filaEnvios/x", async () => {
      db.seed("filaEnvios/x", envio("x", { reservadoEm: AGORA.toISOString(), expiraEm: new Date(AGORA.getTime() + 300_000).toISOString() }));
    });

    const corpo = await planejar();

    expect(leadSalvo("x").demo).toBeDefined();
    expect(leadSalvo("x").automacaoExpirada).toBeUndefined();
    expect(caminhos()).toHaveLength(3);
    expect(corpo.varredura).toMatchObject({ candidatas: 1, apagadas: 0, puladas: 1, porMotivo: { filaEnvios: 1 } });
  });

  it("o operador clica no WhatsApp da ficha no meio da exclusão", async () => {
    config();
    semear(lead("x"));
    await arquivos("x");
    db.aoLer("leads/x", async () => {
      semear(lead("x", { seloContato: { userId: "admin", em: AGORA.toISOString() } }));
    });

    const corpo = await planejar();

    expect(leadSalvo("x").demo).toBeDefined();
    expect(leadSalvo("x").seloContato).toBeDefined();
    expect(caminhos()).toHaveLength(3);
    expect(corpo.varredura).toMatchObject({ apagadas: 0, puladas: 1, porMotivo: { contato: 1 } });
  });
});

describe("quando a varredura NÃO roda", () => {
  it("automação desligada: nada é apagado e a execução nem varre", async () => {
    config({ ativo: false });
    semear(lead("a"));
    const corpo = await planejar();
    expect(leadSalvo("a").demo).toBeDefined();
    expect(execucao(corpo.execucaoId).varredura).toBeUndefined();
  });

  it("fila de envio pausada: a fila não teve chance de mandar", async () => {
    config();
    db.seed("config/fila", { ativo: false });
    semear(lead("a"));
    const corpo = await planejar();
    expect(leadSalvo("a").demo).toBeDefined();
    expect(corpo.varredura).toMatchObject({ apagadas: 0, candidatas: 0 });
    expect(corpo.varredura.naoRodou).toMatch(/pausada/);
    expect(execucao(corpo.execucaoId).varredura?.naoRodou).toMatch(/pausada/);
  });

  it("fila bloqueada por config ausente (RADAR_DEVICE_USER_ID)", async () => {
    config();
    vi.stubEnv("RADAR_DEVICE_USER_ID", "");
    semear(lead("a"));
    const corpo = await planejar();
    expect(leadSalvo("a").demo).toBeDefined();
    expect(corpo.varredura.naoRodou).toMatch(/bloqueada/);
  });

  it("Storage indisponível: apagar deixaria captura órfã", async () => {
    config();
    storage = {
      save: async () => {},
      deleteByPrefix: async () => {},
      publicUrl: (p) => p,
    };
    // A fábrica que lança, como `getDemoStorage` sem FIREBASE_STORAGE_BUCKET.
    vi.doMock("@/lib/firebase/storage", () => ({
      getDemoStorage: () => {
        throw new Error("FIREBASE_STORAGE_BUCKET ausente");
      },
    }));
    vi.resetModules();
    const { POST } = await import("../automacao/planejar/route");
    semear(lead("a"));
    const corpo = await (await POST(req("/api/automacao/planejar", { disparo: "schedule" }))).json();
    vi.doUnmock("@/lib/firebase/storage");
    expect(leadSalvo("a").demo).toBeDefined();
    expect(corpo.varredura.naoRodou).toMatch(/Storage/);
  });
});

describe("Storage: nada órfão sobra", () => {
  it("limpeza que falha deixa o lead marcado, e a próxima execução termina", async () => {
    config();
    semear(lead("a"));
    await arquivos("a");
    const real = storage as FakeDemoStorage;
    storage = {
      save: real.save.bind(real),
      publicUrl: real.publicUrl.bind(real),
      deleteByPrefix: async () => {
        throw new Error("503 do Storage");
      },
    };

    const primeira = await planejar();

    expect(leadSalvo("a").demo).toBeUndefined();
    expect(leadSalvo("a").automacaoExpirada?.storagePendente).toBe(true);
    expect(real.paths()).toHaveLength(3);
    expect(primeira.varredura).toMatchObject({ apagadas: 1, storageFalhou: 1 });

    // Na noite seguinte o Storage voltou — e a fila está PAUSADA: terminar
    // uma limpeza não é apagar demo, então roda mesmo assim.
    await FINALIZAR(req("/api/automacao/finalizar", { execucaoId: primeira.execucaoId }));
    storage = real;
    db.seed("config/fila", { ativo: false });
    vi.setSystemTime(new Date(AGORA.getTime() + 24 * HORA));
    const segunda = await planejar();

    expect(real.paths()).toEqual([]);
    expect(leadSalvo("a").automacaoExpirada?.storagePendente).toBeUndefined();
    expect(segunda.varredura).toMatchObject({ storageConcluido: 1, storageFalhou: 0 });
  });
});

describe("teto por execução", () => {
  it(`apaga no máximo ${VARREDURA_MAX}, a mais velha primeiro; o resto fica para a próxima`, async () => {
    config({ alvoEstoque: 0 });
    for (let i = 0; i <= VARREDURA_MAX; i++) {
      const id = `l${String(i).padStart(2, "0")}`;
      // l00 é a MAIS NOVA (criada 80h atrás); cada uma seguinte, uma hora mais velha.
      semear(lead(id, { demo: demoAuto({ criadoEm: horasAtras(80 + i) }) }));
    }

    const corpo = await planejar();

    expect(corpo.varredura).toMatchObject({ candidatas: VARREDURA_MAX + 1, apagadas: VARREDURA_MAX, restantes: 1 });
    // Sobrou a mais nova.
    expect(leadSalvo("l00").demo).toBeDefined();
    expect(leadSalvo(`l${VARREDURA_MAX}`).demo).toBeUndefined();
  });
});
