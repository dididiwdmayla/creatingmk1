import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FILA_CANDIDATOS_COLLECTION, FILA_CANDIDATOS_DOC } from "@/lib/fila/candidatos";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { PUT as putConfig } from "../config/fila/route";
import { POST as confirmar } from "../fila/confirmar/route";
import { GET as getProximo } from "../fila/proximo/route";

/**
 * CLAIM SEM CONFIRMAÇÃO NUNCA VOLTA SOZINHA — ver "Revisão" em
 * ARCHITECTURE.md.
 *
 * O defeito B: a retenção (`retencaoEnvioHoras`, 12h) segurava a claim
 * silenciosa e a LIBERAVA ao vencer — sem teto de tentativas (silêncio não
 * conta tentativa) e sem girar a frase (só "enviado" gira). Um lead cujo
 * confirmar não chega saía com o MESMO texto cerca de uma vez por dia,
 * indefinidamente. O princípio é o de toda a fila: o servidor nunca depende
 * de o aparelho reportar; na dúvida, bloqueia.
 *
 * Este arquivo usa só as rotas que já existiam (`/proximo`, `/confirmar` e o
 * PUT da config), para a reprodução poder ficar vermelha antes da correção.
 * As rotas novas da revisão têm testes próprios.
 */

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const CHAVE = "chave-do-celular";
/** Terça, 10h no fuso do lead (offset 0): faixa `bom` da barbearia. */
const TERCA_10H = new Date("2026-03-10T10:00:00Z");
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const SKIN = "barbearia-editorial";

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
    demo: { skinId: SKIN },
    // Faixa vazia + offset 0: aberto e "bom" das 9h às 11h30 todo dia útil.
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
    ...overrides,
  } as Lead;
}

async function proximo() {
  return (
    await getProximo(new Request("http://localhost/api/fila/proximo", { headers: { authorization: `Bearer ${CHAVE}` } }))
  ).json();
}

function confirmarClaim(corpo: Record<string, unknown>) {
  return confirmar(
    new Request("http://localhost/api/fila/confirmar", {
      method: "POST",
      headers: { authorization: `Bearer ${CHAVE}`, "content-type": "application/json" },
      body: JSON.stringify(corpo),
    }),
  );
}

/** Pula o relógio e tira o pool do caminho (ele é cache de 10 min). */
function avancar(ms: number) {
  vi.setSystemTime(new Date(Date.now() + ms));
  db.deleteDoc(`${FILA_CANDIDATOS_COLLECTION}/${FILA_CANDIDATOS_DOC}`);
}

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("config/automacao", { corteLegado: "2000-01-01" });
  // Duas frases na skin: se a rotação girasse, o texto mudaria.
  db.seed(`frasesProspeccao/${SKIN}`, { skinId: SKIN, frases: ["Oi {nome}, frase A", "Oi {nome}, frase B"], indice: 0 });
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

describe("claim vencida sem confirmação — nunca volta sozinha", () => {
  it("REPRODUÇÃO: 12h01 depois, o lead NÃO sai de novo com o mesmo texto", async () => {
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    const primeira = await proximo();
    expect(primeira.leadId).toBe("ChIJa");
    // O aparelho leva a tarefa e nunca confirma nada.

    avancar(12 * HORA + 60_000);
    // Mesmo dia da semana não serve (22h01 está fora da janela): vai ao dia seguinte, 10h.
    avancar(DIA - 12 * HORA - 60_000);
    const segunda = await proximo();

    expect(segunda).toMatchObject({ temTarefa: false, motivo: "sem_leads_elegiveis" });
    expect(db.getDoc(`frasesProspeccao/${SKIN}`)?.indice).toBe(0);
  });

  it("REPRODUÇÃO: nem 30 dias depois — a revisão não tem prazo", async () => {
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    await proximo();

    for (let dia = 1; dia <= 30; dia += 1) {
      avancar(DIA);
      expect((await proximo()).temTarefa).toBe(false);
    }
    expect(db.getDoc("filaEnvios/ChIJa")?.estado).toBe("reservado");
  });

  it("REPRODUÇÃO: o doc conta quantas vezes o lead foi reservado (`reservas`), e a conta sobrevive à re-reserva", async () => {
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    const tarefa = await proximo();
    expect(db.getDoc("filaEnvios/ChIJa")?.reservas).toBe(1);

    await confirmarClaim({ id: tarefa.id, leadId: "ChIJa", resultado: "falhou", detalhe: "whatsapp travou" });
    avancar(60_000);
    expect((await proximo()).leadId).toBe("ChIJa");

    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ reservas: 2, tentativas: 1 });
  });
});

describe("o aparelho que fala, mesmo tarde, é ouvido", () => {
  it("'enviado' com a claim ATUAL chegando com o lead em revisão segue o caminho normal e o tira da revisão", async () => {
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    const tarefa = await proximo();
    avancar(3 * HORA);

    const res = await confirmarClaim({ id: tarefa.id, leadId: "ChIJa", resultado: "enviado", detalhe: "" });

    expect(res.status).toBe(200);
    expect(db.getDoc("filaEnvios/ChIJa")?.estado).toBe("enviado");
    expect(db.getDoc("leads/ChIJa")?.status).toBe("contactado");
    // Caminho normal inteiro: a rotação gira e o contador anda.
    expect(db.getDoc(`frasesProspeccao/${SKIN}`)?.indice).toBe(1);
  });

  it("'falhou' com a claim atual mantém a política de 3 tentativas: o lead volta à fila", async () => {
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    const tarefa = await proximo();
    avancar(3 * HORA);

    await confirmarClaim({ id: tarefa.id, leadId: "ChIJa", resultado: "falhou", detalhe: "sem rede" });
    avancar(DIA - 3 * HORA);

    expect((await proximo()).leadId).toBe("ChIJa");
    expect(db.getDoc("filaEnvios/ChIJa")?.tentativas).toBe(1);
  });
});

describe("retencaoEnvioHoras saiu da config", () => {
  it("REPRODUÇÃO: PUT com retencaoEnvioHoras é chave desconhecida (400)", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await putConfig(
      new Request("http://localhost/api/config/fila", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ retencaoEnvioHoras: 24 }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("doc antigo com retencaoEnvioHoras gravado não quebra a leitura nem muda nada", async () => {
    db.seed("config/fila", { retencaoEnvioHoras: 0 });
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    await proximo();
    avancar(DIA);

    // Com a regra antiga, 0 desligava a retenção e o lead voltaria em 5 min.
    expect((await proximo()).temTarefa).toBe(false);
  });
});
