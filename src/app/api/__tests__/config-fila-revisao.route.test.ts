import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EPOCH_ISO, RESERVA_DURACAO_MS } from "@/lib/fila/envios";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { GET } from "../config/fila/revisao/route";
import { DELETE } from "../config/fila/revisao/[leadId]/route";
import { POST as marcarContactado } from "../config/fila/revisao/[leadId]/contactado/route";

/**
 * A REVISÃO — claim que venceu sem o aparelho dizer nada (ver
 * `lib/fila/revisao.ts`). Ela NUNCA volta sozinha à fila: só sai por ação
 * explícita do operador — liberar (conferiu que não saiu) ou marcar como
 * contactado (conferiu que saiu). Sem esta lista o lead pararia em silêncio.
 *
 * Mesma divisão do resto do painel "Fila de envio": ADMIN ONLY nas três
 * rotas e sob `/api/config/` — o prefixo `/api/fila/` inteiro passa SEM
 * sessão de usuário (é o celular com Bearer, ver src/proxy.ts).
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
function semearSilenciosa(
  leadId: string,
  nome: string,
  reservadoEm: string,
  extra: Record<string, unknown> = {},
) {
  db.seed(`leads/${leadId}`, {
    placeId: leadId,
    nome,
    status: "novo",
    horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-03-01T00:00:00.000Z" },
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
  });
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
    ...extra,
  });
}

function getRequest(cookie?: string): Request {
  return new Request("http://localhost/api/config/fila/revisao", {
    headers: { ...(cookie && { cookie }) },
  });
}

function deleteRequest(leadId: string, cookie?: string): Request {
  return new Request(`http://localhost/api/config/fila/revisao/${leadId}`, {
    method: "DELETE",
    headers: { ...(cookie && { cookie }) },
  });
}

function contactadoRequest(leadId: string, cookie?: string): Request {
  return new Request(`http://localhost/api/config/fila/revisao/${leadId}/contactado`, {
    method: "POST",
    headers: { ...(cookie && { cookie }) },
  });
}

const params = (leadId: string) => ({ params: Promise.resolve({ leadId }) });

const admin = () => cookieDeSessao(db, { id: "admin", papel: "admin" });

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.stubEnv("RADAR_DEVICE_USER_ID", "radar-device");
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/config/fila/revisao (restrito ao admin)", () => {
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

  it("devolve nome, quando foi a reserva e QUANTAS VEZES o lead foi reservado", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z", { reservas: 3 });

    const res = await GET(getRequest(await admin()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      total: 1,
      linhas: [
        {
          leadId: "ChIJa",
          nome: "Ink House",
          reservadoEm: "2026-03-10T09:00:00.000Z",
          reservas: 3,
          dispositivo: "android",
        },
      ],
    });
  });

  it("doc anterior ao contador `reservas`: null (a tela diz \"1 ou mais\"), nunca 0", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");

    const { linhas } = await (await GET(getRequest(await admin()))).json();

    expect(linhas[0].reservas).toBeNull();
  });

  it("A CONTAGEM DO FUNIL BATE COM A LISTA — mesma varredura, uma verdade", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    semearSilenciosa("ChIJb", "Bar do Zé", "2026-03-10T10:00:00.000Z");
    semearSilenciosa("ChIJc", "Pet Center", "2026-03-10T11:00:00.000Z");
    // Ruído que NÃO pode contar: confirmada como falha, enviada, e uma claim
    // viva (que barra por ser viva, não por revisão).
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

  it("SEM PRAZO: claim silenciosa de 30 dias atrás continua em revisão", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-02-08T09:00:00.000Z");

    expect(await (await GET(getRequest(await admin()))).json()).toMatchObject({ total: 1 });
  });

  it("claim devolvida de propósito não aparece (nada saiu, e o servidor sabe)", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    // `liberarClaim`/`liberarRevisao` marcam `expiraEm` no EPOCH.
    db.seed("filaEnvios/ChIJa", {
      ...(db.getDoc("filaEnvios/ChIJa") as Record<string, unknown>),
      expiraEm: EPOCH_ISO,
    });

    expect(await (await GET(getRequest(await admin()))).json()).toMatchObject({ total: 0 });
  });

  it("lead que já não está em \"novo\" (reconciliado, contactado à mão) não aparece — não há o que revisar", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    db.seed("leads/ChIJa", { ...(db.getDoc("leads/ChIJa") as Record<string, unknown>), status: "contactado" });

    expect(await (await GET(getRequest(await admin()))).json()).toMatchObject({ total: 0, linhas: [] });
  });

  it("lead excluído não aparece: sem lead, a fila nunca o entrega", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    db.deleteDoc("leads/ChIJa");

    expect(await (await GET(getRequest(await admin()))).json()).toMatchObject({ total: 0 });
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

describe("DELETE /api/config/fila/revisao/{leadId} — liberar para a fila", () => {
  it("sem sessão → 401; membro → 403, e a revisão fica de pé", async () => {
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

  it("lead que não está em revisão → 404, e nenhum doc é criado", async () => {
    const res = await DELETE(deleteRequest("ChIJzz", await admin()), params("ChIJzz"));

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
    // `set` com merge CRIA doc ausente: um leadId errado não pode plantar
    // lixo em `filaEnvios`.
    expect(db.getDoc("filaEnvios/ChIJzz")).toBeUndefined();
  });

  it("claim já confirmada como falha não está em revisão — 404, e a falha fica de pé", async () => {
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

describe("POST /api/config/fila/revisao/{leadId}/contactado — o operador conferiu que SAIU", () => {
  it("sem sessão → 401; membro → 403, e nada muda", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    const antes = db.getDoc("filaEnvios/ChIJa");

    expect((await marcarContactado(contactadoRequest("ChIJa"), params("ChIJa"))).status).toBe(401);
    const membro = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });
    expect((await marcarContactado(contactadoRequest("ChIJa", membro), params("ChIJa"))).status).toBe(403);

    expect(db.getDoc("filaEnvios/ChIJa")).toEqual(antes);
    expect(db.getDoc("leads/ChIJa")?.status).toBe("novo");
  });

  it("fecha a claim como enviada, marca contactado com a data da reserva, conta 1 no dia e NÃO gira a rotação", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    db.seed("frasesProspeccao/barbearia-editorial", {
      skinId: "barbearia-editorial",
      frases: ["um", "dois"],
      indice: 0,
    });

    const res = await marcarContactado(contactadoRequest("ChIJa", await admin()), params("ChIJa"));

    expect(res.status).toBe(200);
    // A resposta traz a lista nova — o lead saiu dela.
    expect(await res.json()).toMatchObject({ total: 0, linhas: [] });
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({
      estado: "enviado",
      claimId: "claim-ChIJa",
      // O envio provável foi na reserva, não no clique.
      enviadoEm: "2026-03-10T09:00:00.000Z",
      ultimoErro: null,
    });
    expect(db.getDoc("leads/ChIJa")).toMatchObject({
      status: "contactado",
      contato: { primeiroContatoEm: "2026-03-10T09:00:00.000Z", primeiroContatoPor: "radar-device" },
      seloContato: { userId: "radar-device", em: "2026-03-10T09:00:00.000Z", origem: "revisao" },
    });
    expect((db.getDoc("leads/ChIJa")?.registrosEnvio as Array<{ origem?: string }>)[0].origem).toBe("revisao");
    // Contado UMA vez no dia operacional da ação (o envio saiu e nunca foi
    // contado), sem empurrar a janela de 1h nem o intervalo — a mensagem não
    // saiu agora.
    expect(db.getDoc("filaContadores/2026-03-10")).toMatchObject({ enviados: 1, envios: [], ultimoEventoEm: null });
    expect(db.getDoc("frasesProspeccao/barbearia-editorial")?.indice).toBe(0);
  });

  it("lead que já avançou (respondeu) não é rebaixado — a claim fecha e o contador anda", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    db.seed("leads/ChIJa", { ...(db.getDoc("leads/ChIJa") as Record<string, unknown>), status: "respondeu" });

    const res = await marcarContactado(contactadoRequest("ChIJa", await admin()), params("ChIJa"));

    expect(res.status).toBe(200);
    expect(db.getDoc("leads/ChIJa")?.status).toBe("respondeu");
    expect(db.getDoc("filaEnvios/ChIJa")?.estado).toBe("enviado");
  });

  it("RECUSA com claim ATIVA: 409 claim_ativa, nada muda", async () => {
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T11:58:00.000Z");
    const antes = db.getDoc("filaEnvios/ChIJa");

    const res = await marcarContactado(contactadoRequest("ChIJa", await admin()), params("ChIJa"));

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("claim_ativa");
    expect(db.getDoc("filaEnvios/ChIJa")).toEqual(antes);
    expect(db.getDoc("leads/ChIJa")?.status).toBe("novo");
  });

  it("lead fora da revisão → 404 sem plantar doc; marcar duas vezes, a segunda é 404", async () => {
    const cookie = await admin();
    expect((await marcarContactado(contactadoRequest("ChIJzz", cookie), params("ChIJzz"))).status).toBe(404);
    expect(db.getDoc("filaEnvios/ChIJzz")).toBeUndefined();

    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");
    expect((await marcarContactado(contactadoRequest("ChIJa", cookie), params("ChIJa"))).status).toBe(200);
    expect((await marcarContactado(contactadoRequest("ChIJa", cookie), params("ChIJa"))).status).toBe(404);
    expect(db.getDoc("filaContadores/2026-03-10")?.enviados).toBe(1);
  });

  it("sem RADAR_DEVICE_USER_ID → 503, nada muda (o autor seria inventado)", async () => {
    vi.stubEnv("RADAR_DEVICE_USER_ID", "");
    semearSilenciosa("ChIJa", "Ink House", "2026-03-10T09:00:00.000Z");

    const res = await marcarContactado(contactadoRequest("ChIJa", await admin()), params("ChIJa"));

    expect(res.status).toBe(503);
    expect(db.getDoc("filaEnvios/ChIJa")?.estado).toBe("reservado");
  });
});
