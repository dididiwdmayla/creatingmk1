import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EPOCH_ISO, RESERVA_DURACAO_MS } from "@/lib/fila/envios";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { GET } from "../config/fila/retidos/route";
import { DELETE } from "../config/fila/retidos/[leadId]/route";

/**
 * A lista de RETIDOS e a liberação manual — a vitrine da retenção por claim
 * não confirmada (ver `lib/fila/retidos.ts`). A retenção tira o lead da fila
 * sem que nada no lead mude, então sem esta lista ele pararia em silêncio.
 *
 * Mesma divisão do resto do painel "Fila de envio": ADMIN ONLY nas duas
 * rotas, leitura e escrita, e sob `/api/config/` — o prefixo `/api/fila/`
 * inteiro passa SEM sessão de usuário (é o celular com Bearer, ver
 * src/proxy.ts), e pendurar uma tela de admin lá a tiraria da sessão junto.
 */

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

/** Meio-dia; as claims silenciosas abaixo foram reservadas de manhã. */
const AGORA = new Date("2026-03-10T12:00:00Z");

/**
 * Uma claim que MORREU EM SILÊNCIO: reservada, prazo vencido, nunca
 * confirmada. `expiraEm = reservadoEm + 5min`, exatamente como
 * `reservarLead` grava — é essa relação que distingue silêncio de claim
 * devolvida de propósito.
 */
function semearSilenciosa(leadId: string, nome: string, reservadoEm: string) {
  db.seed(`leads/${leadId}`, { placeId: leadId, nome, status: "novo" });
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
  });
}

function getRequest(cookie?: string): Request {
  return new Request("http://localhost/api/config/fila/retidos", {
    headers: { ...(cookie && { cookie }) },
  });
}

function deleteRequest(leadId: string, cookie?: string): Request {
  return new Request(`http://localhost/api/config/fila/retidos/${leadId}`, {
    method: "DELETE",
    headers: { ...(cookie && { cookie }) },
  });
}

const params = (leadId: string) => ({ params: Promise.resolve({ leadId }) });

const admin = () => cookieDeSessao(db, { id: "admin", papel: "admin" });

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/config/fila/retidos (restrito ao admin)", () => {
  it("sem sessão → 401", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");

    const res = await GET(getRequest());

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("membro → 403, sem vazar uma linha da lista", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    const cookie = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });

    const res = await GET(getRequest(cookie));

    expect(res.status).toBe(403);
    const corpo = await res.json();
    expect(corpo.error.code).toBe("forbidden");
    expect(corpo.linhas).toBeUndefined();
    expect(corpo.total).toBeUndefined();
  });

  it("devolve nome, quando foi a reserva e quando a retenção vence", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");

    const res = await GET(getRequest(await admin()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      total: 1,
      retencaoHoras: 12,
      linhas: [
        {
          leadId: "ChIJa",
          nome: "Ink House",
          reservadoEm: "2026-03-10T09:00:00.000Z",
          // reservadoEm + 12h — a âncora é o envio provável, não a expiração.
          venceEm: "2026-03-10T21:00:00.000Z",
          dispositivo: "android",
        },
      ],
    });
  });

  it("A CONTAGEM DO FUNIL BATE COM A LISTA — mesma varredura, uma verdade", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    semearSilenciosa("ChIJb", "Bar do Zé", "2026-03-10T10:00:00.000Z");
    semearSilenciosa("ChIJc", "Pet Center", "2026-03-10T11:00:00.000Z");
    // Ruído que NÃO pode contar: confirmada como falha, enviada, e uma claim
    // viva (que barra por ser viva, não por retenção).
    db.seed("filaEnvios/ChIJd", {
      leadId: "ChIJd",
      estado: "falhou",
      claimId: "c-d",
      reservadoEm: "2026-03-10T09:00:00.000Z",
      expiraEm: "2026-03-10T09:05:00.000Z",
      dispositivo: "android",
      tentativas: 1,
      ultimoErro: "WhatsApp não abriu",
      enviadoEm: null,
    });
    db.seed("filaEnvios/ChIJe", {
      leadId: "ChIJe",
      estado: "enviado",
      claimId: "c-e",
      reservadoEm: "2026-03-10T09:00:00.000Z",
      expiraEm: "2026-03-10T09:05:00.000Z",
      dispositivo: "android",
      tentativas: 0,
      ultimoErro: null,
      enviadoEm: "2026-03-10T09:01:00.000Z",
    });
    semearSilenciosa("ChIJf", "Viva", "2026-03-10T11:58:00.000Z"); // claim VIVA

    const { total, linhas } = await (await GET(getRequest(await admin()))).json();

    expect(total).toBe(3);
    expect(total).toBe(linhas.length);
    // Do mais RECENTE para o mais antigo: a conversa mais nova é a que o
    // operador ainda consegue conferir no WhatsApp.
    expect(linhas.map((l: { leadId: string }) => l.leadId)).toEqual(["ChIJc", "ChIJb", "ChIJa"]);
  });

  it("retenção vencida não aparece — o lead já voltou ao pool", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-09T23:00:00.000Z"); // 13h atrás

    expect(await (await GET(getRequest(await admin()))).json()).toMatchObject({
      total: 0,
      linhas: [],
    });
  });

  it("claim devolvida de propósito não aparece (nada saiu, e o servidor sabe)", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    // `liberarClaim`/`liberarRetido` marcam `expiraEm` no EPOCH.
    db.seed("filaEnvios/ChIJa", {
      ...(db.getDoc("filaEnvios/ChIJa") as Record<string, unknown>),
      expiraEm: EPOCH_ISO,
    });

    expect(await (await GET(getRequest(await admin()))).json()).toMatchObject({ total: 0 });
  });

  it("`retencaoEnvioHoras: 0` devolve lista vazia e diz que está desligada", async () => {
    db.seed("config/fila", { retencaoEnvioHoras: 0 });
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");

    expect(await (await GET(getRequest(await admin()))).json()).toEqual({
      total: 0,
      linhas: [],
      retencaoHoras: 0,
    });
  });

  it("lead excluído não apaga a retenção — some o nome, fica o id", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    db.deleteDoc("leads/ChIJa");

    const { linhas } = await (await GET(getRequest(await admin()))).json();

    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ leadId: "ChIJa", nome: "" });
  });

  it("não varre /leads atrás de nomes: filtra primeiro, lê POR ID depois", async () => {
    for (let i = 0; i < 5; i += 1) {
      db.seed(`leads/ruido-${i}`, { placeId: `ruido-${i}`, nome: `Ruído ${i}`, status: "novo" });
    }
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    const cookie = await admin();

    const varreduras: Record<string, number> = {};
    const real = db.collection.bind(db);
    db.collection = (name: string) => {
      const col = real(name);
      return {
        ...col,
        doc: (id: string) => col.doc(id),
        get: async () => {
          varreduras[name] = (varreduras[name] ?? 0) + 1;
          return col.get();
        },
      };
    };

    await GET(getRequest(cookie));

    expect(varreduras.filaEnvios).toBe(1);
    expect(varreduras.leads ?? 0).toBe(0);
  });
});

describe("DELETE /api/config/fila/retidos/{leadId} — liberação manual", () => {
  it("sem sessão → 401; membro → 403, e a retenção fica de pé", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");

    const semSessao = await DELETE(deleteRequest("ChIJa"), params("ChIJa"));
    expect(semSessao.status).toBe(401);

    const membro = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });
    const res = await DELETE(deleteRequest("ChIJa", membro), params("ChIJa"));

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
    // Nada foi liberado: a claim continua byte a byte como estava.
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({
      expiraEm: "2026-03-10T09:05:00.000Z",
    });
  });

  it("admin libera: o lead sai da lista e volta a ser reservável", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    semearSilenciosa("ChIJb", "Bar do Zé", "2026-03-10T10:00:00.000Z");

    const res = await DELETE(deleteRequest("ChIJa", await admin()), params("ChIJa"));

    expect(res.status).toBe(200);
    const corpo = await res.json();
    // A resposta já traz a lista NOVA — a tela não adivinha o resultado.
    expect(corpo.total).toBe(1);
    expect(corpo.linhas.map((l: { leadId: string }) => l.leadId)).toEqual(["ChIJb"]);

    const doc = db.getDoc("filaEnvios/ChIJa") as Record<string, unknown>;
    // Semântica de `liberarClaim`: expiraEm no passado. Sem campo novo, sem
    // estado novo — e `reservadoEm` fica intacto, é o rastro do envio provável.
    expect(doc.expiraEm).toBe(EPOCH_ISO);
    expect(doc.reservadoEm).toBe("2026-03-10T09:00:00.000Z");
    expect(doc.estado).toBe("reservado");
    expect(doc.claimId).toBe("claim-ChIJa");
  });

  it("RECUSA com claim ATIVA: 409, motivo visível, e nada é alterado", async () => {
    // Claim viva: o aparelho pode estar com o WhatsApp aberto neste segundo.
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T11:58:00.000Z");
    const antes = { ...(db.getDoc("filaEnvios/ChIJa") as Record<string, unknown>) };

    const res = await DELETE(deleteRequest("ChIJa", await admin()), params("ChIJa"));

    expect(res.status).toBe(409);
    const corpo = await res.json();
    expect(corpo.error.code).toBe("claim_ativa");
    expect(corpo.error.message).toMatch(/reservado/i);
    expect(corpo.error.expiraEm).toBe("2026-03-10T12:03:00.000Z");
    expect(db.getDoc("filaEnvios/ChIJa")).toEqual(antes);
  });

  it("lead que não está retido → 404, e nenhum doc é criado", async () => {
    const res = await DELETE(deleteRequest("ChIJzz", await admin()), params("ChIJzz"));

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
    // `set` com merge CRIA doc ausente: um leadId errado não pode plantar
    // lixo em `filaEnvios`.
    expect(db.getDoc("filaEnvios/ChIJzz")).toBeUndefined();
  });

  it("claim já confirmada como falha não é 'retida' — 404, e a falha fica de pé", async () => {
    db.seed("filaEnvios/ChIJa", {
      leadId: "ChIJa",
      estado: "falhou",
      claimId: "c-a",
      reservadoEm: "2026-03-10T09:00:00.000Z",
      expiraEm: "2026-03-10T09:05:00.000Z",
      dispositivo: "android",
      tentativas: 1,
      ultimoErro: "WhatsApp não abriu",
      enviadoEm: null,
    });

    const res = await DELETE(deleteRequest("ChIJa", await admin()), params("ChIJa"));

    expect(res.status).toBe(404);
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ estado: "falhou", tentativas: 1 });
  });

  it("liberar duas vezes: a segunda é 404, não um segundo efeito", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    const cookie = await admin();

    expect((await DELETE(deleteRequest("ChIJa", cookie), params("ChIJa"))).status).toBe(200);
    expect((await DELETE(deleteRequest("ChIJa", cookie), params("ChIJa"))).status).toBe(404);
  });
});
