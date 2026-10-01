import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESERVA_DURACAO_MS } from "@/lib/fila/envios";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { GET, POST } from "../config/fila/reconciliacao/route";

/**
 * A RECONCILIAÇÃO — o conserto do estrago de quando `RADAR_DEVICE_USER_ID`
 * faltava em produção (ver "Saúde da fila" e "Reconciliação" em
 * ARCHITECTURE.md): todo `/confirmar` de prospecção respondeu 503, então
 * todo lead que a fila de fato mandou continuou "novo" e voltou a receber a
 * mesma mensagem.
 *
 * A regra é a do resto da fila: NA DÚVIDA, BLOQUEIA. Reservado conta como
 * enviado — com o 503, nenhum estado gravado em `filaEnvios` é confiável.
 *
 * Duas etapas, as duas admin only: a PRÉVIA (GET) e o APLICAR (POST) com
 * confirmação explícita. Aplicar marca contactado (nunca rebaixa), grava selo
 * e registro marcados como reconciliação, e NÃO toca contador do dia,
 * rotação de frases nem `filaEnvios`.
 */

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const AGORA = new Date("2026-10-01T15:00:00Z");
const DEVICE_USER = "admin";

function semearLead(leadId: string, overrides: Record<string, unknown> = {}) {
  db.seed(`leads/${leadId}`, {
    placeId: leadId,
    nome: `Lead ${leadId}`,
    status: "novo",
    enriquecido: false,
    horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-09-01T00:00:00.000Z" },
    criadoEm: "2026-06-01T00:00:00.000Z",
    atualizadoEm: "2026-06-01T00:00:00.000Z",
    ...overrides,
  });
}

function semearEnvio(leadId: string, reservadoEm: string, overrides: Record<string, unknown> = {}) {
  db.seed(`filaEnvios/${leadId}`, {
    leadId,
    estado: "reservado",
    claimId: `claim-${leadId}`,
    reservadoEm,
    expiraEm: new Date(new Date(reservadoEm).getTime() + RESERVA_DURACAO_MS).toISOString(),
    dispositivo: "android",
    tentativas: 0,
    ultimoErro: null,
    enviadoEm: null,
    rotacaoSkinId: "barbearia-editorial",
    ...overrides,
  });
}

function getRequest(cookie?: string) {
  return new Request("http://localhost/api/config/fila/reconciliacao", {
    headers: { ...(cookie && { cookie }) },
  });
}

function postRequest(corpo: unknown, cookie?: string) {
  return new Request("http://localhost/api/config/fila/reconciliacao", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify(corpo),
  });
}

const admin = () => cookieDeSessao(db, { id: "admin", papel: "admin" });

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.stubEnv("RADAR_DEVICE_USER_ID", DEVICE_USER);
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("reconciliação — permissão", () => {
  it("GET e POST: sem sessão → 401, membro → 403, e o membro não muda nada", async () => {
    semearLead("ChIJa");
    semearEnvio("ChIJa", "2026-09-20T22:00:00.000Z");
    const membro = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    expect((await GET(getRequest())).status).toBe(401);
    expect((await GET(getRequest(membro))).status).toBe(403);
    expect((await POST(postRequest({ leadIds: ["ChIJa"], confirmar: true }))).status).toBe(401);
    expect((await POST(postRequest({ leadIds: ["ChIJa"], confirmar: true }, membro))).status).toBe(403);

    expect(db.getDoc("leads/ChIJa")?.status).toBe("novo");
  });
});

describe("GET /api/config/fila/reconciliacao — a prévia", () => {
  it("lista SÓ leads com doc em filaEnvios cujo status ainda é novo — qualquer estado da claim", async () => {
    // Reservado em silêncio, falhou, inválido e devolvido: todos contam —
    // com o 503, nenhum estado gravado é prova de que nada saiu.
    semearLead("ChIJsilencio");
    semearEnvio("ChIJsilencio", "2026-09-28T22:00:00.000Z");
    semearLead("ChIJfalhou");
    semearEnvio("ChIJfalhou", "2026-09-27T22:00:00.000Z", { estado: "falhou", tentativas: 2 });
    semearLead("ChIJdevolvida");
    semearEnvio("ChIJdevolvida", "2026-09-26T22:00:00.000Z", { expiraEm: new Date(0).toISOString() });
    // Fora: já contactado, sem doc de fila, e o doc de fila de lead excluído.
    semearLead("ChIJjaContactado", { status: "contactado" });
    semearEnvio("ChIJjaContactado", "2026-09-25T22:00:00.000Z");
    semearLead("ChIJsemFila");
    semearEnvio("ChIJexcluido", "2026-09-24T22:00:00.000Z");

    const res = await GET(getRequest(await admin()));
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(corpo.linhas.map((l: { leadId: string }) => l.leadId)).toEqual([
      // Mais recente primeiro: é a conversa que está no topo do WhatsApp.
      "ChIJsilencio",
      "ChIJfalhou",
      "ChIJdevolvida",
    ]);
    expect(corpo.total).toBe(3);
    expect(corpo.leadsExcluidos).toBe(1);
    expect(corpo.linhas[1]).toEqual({
      leadId: "ChIJfalhou",
      nome: "Lead ChIJfalhou",
      reservadoEm: "2026-09-27T22:00:00.000Z",
      estado: "falhou",
      tentativas: 2,
    });
    expect(corpo.autorPresente).toBe(true);
  });

  it("a prévia não escreve nada", async () => {
    semearLead("ChIJa");
    semearEnvio("ChIJa", "2026-09-20T22:00:00.000Z");
    const antesLead = db.getDoc("leads/ChIJa");
    const antesEnvio = db.getDoc("filaEnvios/ChIJa");

    await GET(getRequest(await admin()));

    expect(db.getDoc("leads/ChIJa")).toEqual(antesLead);
    expect(db.getDoc("filaEnvios/ChIJa")).toEqual(antesEnvio);
  });

  it("base sem envio nenhum: lista vazia, nunca erro", async () => {
    const corpo = await (await GET(getRequest(await admin()))).json();
    expect(corpo).toMatchObject({ linhas: [], total: 0, leadsExcluidos: 0 });
  });

  it("sem RADAR_DEVICE_USER_ID a prévia avisa que o aplicar está bloqueado", async () => {
    vi.stubEnv("RADAR_DEVICE_USER_ID", "");
    const corpo = await (await GET(getRequest(await admin()))).json();
    expect(corpo.autorPresente).toBe(false);
  });
});

describe("POST /api/config/fila/reconciliacao — aplicar", () => {
  it("marca contactado com a data da RESERVA, selo e registro de reconciliação, autor = RADAR_DEVICE_USER_ID", async () => {
    semearLead("ChIJa");
    semearEnvio("ChIJa", "2026-09-20T22:00:00.000Z");

    const res = await POST(postRequest({ leadIds: ["ChIJa"], confirmar: true }, await admin()));
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(corpo).toEqual({ reconciliados: ["ChIJa"], pulados: [] });
    const lead = db.getDoc("leads/ChIJa");
    expect(lead).toMatchObject({
      status: "contactado",
      contato: {
        primeiroContatoEm: "2026-09-20T22:00:00.000Z",
        primeiroContatoPor: DEVICE_USER,
      },
      seloContato: { userId: DEVICE_USER, em: "2026-09-20T22:00:00.000Z", origem: "reconciliacao" },
      atualizadoEm: AGORA.toISOString(),
    });
    expect(lead?.registrosEnvio).toEqual([
      // Hora local do lead NA RESERVA (UTC−3: 22h UTC = 19h local, domingo).
      { em: "2026-09-20T22:00:00.000Z", horaLocalLead: "19:00", diaSemanaLocalLead: 0, origem: "reconciliacao" },
    ]);
  });

  it("não mexe em contador do dia, rotação de frases nem filaEnvios", async () => {
    semearLead("ChIJa");
    semearEnvio("ChIJa", "2026-09-20T22:00:00.000Z");
    db.seed("frasesProspeccao/barbearia-editorial", {
      skinId: "barbearia-editorial",
      frases: ["um", "dois"],
      indice: 0,
    });
    const antesEnvio = db.getDoc("filaEnvios/ChIJa");

    await POST(postRequest({ leadIds: ["ChIJa"], confirmar: true }, await admin()));

    expect(db.getDoc("filaContadores/2026-10-01")).toBeUndefined();
    expect(db.getDoc("filaContadores/2026-09-20")).toBeUndefined();
    expect(db.getDoc("frasesProspeccao/barbearia-editorial")?.indice).toBe(0);
    expect(db.getDoc("filaEnvios/ChIJa")).toEqual(antesEnvio);
  });

  it("nunca rebaixa: lead que avançou entre a prévia e o clique é pulado, intacto", async () => {
    semearLead("ChIJa", { status: "respondeu", contato: { respondeuEm: "2026-09-30T10:00:00.000Z" } });
    semearEnvio("ChIJa", "2026-09-20T22:00:00.000Z");
    const antes = db.getDoc("leads/ChIJa");

    const corpo = await (await POST(postRequest({ leadIds: ["ChIJa"], confirmar: true }, await admin()))).json();

    expect(corpo).toEqual({ reconciliados: [], pulados: [{ leadId: "ChIJa", motivo: "nao_novo" }] });
    expect(db.getDoc("leads/ChIJa")).toEqual(antes);
  });

  it("selo que já existia (clique manual) prevalece; o registro de reconciliação é somado", async () => {
    semearLead("ChIJa", {
      seloContato: { userId: "membro-1", em: "2026-09-01T12:00:00.000Z" },
      registrosEnvio: [{ em: "2026-09-01T12:00:00.000Z" }],
    });
    semearEnvio("ChIJa", "2026-09-20T22:00:00.000Z");

    await POST(postRequest({ leadIds: ["ChIJa"], confirmar: true }, await admin()));

    const lead = db.getDoc("leads/ChIJa");
    expect(lead?.seloContato).toEqual({ userId: "membro-1", em: "2026-09-01T12:00:00.000Z" });
    expect(lead?.registrosEnvio).toHaveLength(2);
    expect((lead?.registrosEnvio as Array<{ origem?: string }>)[1].origem).toBe("reconciliacao");
  });

  it("idempotente: aplicar de novo não soma registro nem mexe em nada", async () => {
    semearLead("ChIJa");
    semearEnvio("ChIJa", "2026-09-20T22:00:00.000Z");
    const cookie = await admin();
    await POST(postRequest({ leadIds: ["ChIJa"], confirmar: true }, cookie));
    const depoisDaPrimeira = db.getDoc("leads/ChIJa");

    const corpo = await (await POST(postRequest({ leadIds: ["ChIJa"], confirmar: true }, cookie))).json();

    expect(corpo.pulados).toEqual([{ leadId: "ChIJa", motivo: "nao_novo" }]);
    expect(db.getDoc("leads/ChIJa")).toEqual(depoisDaPrimeira);
  });

  it("lead sem doc em filaEnvios não é marcado: a reconciliação só vale para quem a fila reservou", async () => {
    semearLead("ChIJsemFila");

    const corpo = await (await POST(postRequest({ leadIds: ["ChIJsemFila"], confirmar: true }, await admin()))).json();

    expect(corpo.pulados).toEqual([{ leadId: "ChIJsemFila", motivo: "sem_reserva" }]);
    expect(db.getDoc("leads/ChIJsemFila")?.status).toBe("novo");
  });

  it("lead excluído é pulado sem plantar doc", async () => {
    semearEnvio("ChIJexcluido", "2026-09-20T22:00:00.000Z");

    const corpo = await (await POST(postRequest({ leadIds: ["ChIJexcluido"], confirmar: true }, await admin()))).json();

    expect(corpo.pulados).toEqual([{ leadId: "ChIJexcluido", motivo: "lead_excluido" }]);
    expect(db.getDoc("leads/ChIJexcluido")).toBeUndefined();
  });

  it("sem confirmação explícita → 400, nada muda", async () => {
    semearLead("ChIJa");
    semearEnvio("ChIJa", "2026-09-20T22:00:00.000Z");
    const cookie = await admin();

    for (const corpo of [{ leadIds: ["ChIJa"] }, { leadIds: ["ChIJa"], confirmar: "sim" }]) {
      expect((await POST(postRequest(corpo, cookie))).status).toBe(400);
    }
    expect(db.getDoc("leads/ChIJa")?.status).toBe("novo");
  });

  it("leadIds vazio, não-lista ou acima do lote → 400", async () => {
    const cookie = await admin();
    const lote = Array.from({ length: 51 }, (_, i) => `ChIJ${i}`);
    for (const leadIds of [[], "ChIJa", lote, [1]]) {
      expect((await POST(postRequest({ leadIds, confirmar: true }, cookie))).status).toBe(400);
    }
  });

  it("sem RADAR_DEVICE_USER_ID → 503, nada muda (o autor seria inventado)", async () => {
    vi.stubEnv("RADAR_DEVICE_USER_ID", "");
    semearLead("ChIJa");
    semearEnvio("ChIJa", "2026-09-20T22:00:00.000Z");

    const res = await POST(postRequest({ leadIds: ["ChIJa"], confirmar: true }, await admin()));

    expect(res.status).toBe(503);
    expect(db.getDoc("leads/ChIJa")?.status).toBe("novo");
  });
});
