import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EPOCH_ISO } from "@/lib/fila/envios";
import { injetarTeste } from "@/lib/fila/teste";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { GET as getSaude } from "../config/fila/saude/route";
import { GET as getProximo } from "../fila/proximo/route";
import { GET as getResumo } from "../fila/resumo/route";

/**
 * A FILA NÃO ENTREGA O QUE NÃO CONSEGUE REGISTRAR — ver "Saúde da fila" em
 * ARCHITECTURE.md.
 *
 * O incidente: em produção existia `RADAR_DEVICE_KEY` mas não
 * `RADAR_DEVICE_USER_ID`. `/proximo` entregava lead normalmente; o aparelho
 * mandava a mensagem; `POST /confirmar` respondia 503 sem gravar nada. Lead
 * nenhum virou "contactado", o contador nunca andou (meta, teto e intervalo
 * nunca seguraram), e a claim silenciosa devolvia o lead à fila — a mesma
 * mensagem saía de novo. A tarefa de TESTE passava (o confirmar dela desvia
 * antes da checagem), então o ensaio dizia que estava tudo certo.
 *
 * A regra: faltando qualquer config que o confirmar exige, `/proximo` não
 * reserva nem entrega lead — responde `pausado`, o motivo que já existe e
 * que a macro já sabe esperar. Formato da resposta intacto.
 */

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const CHAVE = "chave-do-celular";
const TERCA_10H = new Date("2026-03-10T10:00:00Z");

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
    demo: { skinId: "barbearia-editorial" },
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

function semear(...leads: Lead[]) {
  for (const l of leads) db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
}

const autorizado = { authorization: `Bearer ${CHAVE}` };

async function proximo() {
  return (await getProximo(new Request("http://localhost/api/fila/proximo", { headers: autorizado }))).json();
}

async function resumo() {
  return (await getResumo(new Request("http://localhost/api/fila/resumo", { headers: autorizado }))).json();
}

beforeEach(() => {
  db = new FakeFirestore();
  // Os leads deste arquivo são de março; o corte do legado tem testes
  // próprios (fila-legado.route.test.ts) — aqui ele fica antes deles.
  db.seed("config/automacao", { corteLegado: "2000-01-01" });
  vi.stubEnv("RADAR_DEVICE_KEY", CHAVE);
  vi.stubEnv("RADAR_DEVICE_USER_ID", "admin");
  vi.stubEnv("APP_PUBLIC_URL", "https://radar.exemplo.com");
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.useFakeTimers();
  vi.setSystemTime(TERCA_10H);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/fila/proximo — config que o confirmar exige", () => {
  it("REPRODUÇÃO: sem RADAR_DEVICE_USER_ID não entrega lead nem reserva claim — responde `pausado`", async () => {
    vi.stubEnv("RADAR_DEVICE_USER_ID", "");
    semear(lead("ChIJa"));

    const corpo = await proximo();

    expect(corpo).toEqual({
      temTarefa: false,
      tipo: "prospeccao",
      teste: false,
      id: "",
      leadId: "",
      nome: "",
      numero: "",
      texto: "",
      printUrl: "",
      expiraEm: "",
      motivo: "pausado",
    });
    // Nada reservado: a claim que o confirmar não conseguiria fechar nem nasce.
    expect(db.getDoc("filaEnvios/ChIJa")).toBeUndefined();
  });

  it("só espaços conta como ausente", async () => {
    vi.stubEnv("RADAR_DEVICE_USER_ID", "   ");
    semear(lead("ChIJa"));

    expect((await proximo()).motivo).toBe("pausado");
    expect(db.getDoc("filaEnvios/ChIJa")).toBeUndefined();
  });

  it("com a variável presente, entrega como sempre", async () => {
    semear(lead("ChIJa"));

    const corpo = await proximo();

    expect(corpo.temTarefa).toBe(true);
    expect(corpo.leadId).toBe("ChIJa");
  });

  it("a tarefa de TESTE continua saindo: o confirmar dela não precisa da variável", async () => {
    vi.stubEnv("RADAR_DEVICE_USER_ID", "");
    db.seed("config/fila", { numeroTeste: "5544984570105" });
    semear(lead("ChIJa"));
    const injetada = await injetarTeste(
      db,
      {
        leadId: "ChIJa",
        nome: "Lead ChIJa",
        numero: "5544984570105",
        texto: "Oi! Fiz um site de exemplo pra você.",
        printUrl: "https://storage/hero.png",
        criadoPor: "admin",
        pulou: [],
      },
      new Date(),
    );

    const corpo = await proximo();

    expect(corpo).toMatchObject({ temTarefa: true, teste: true, id: injetada.claimId });
    expect(db.getDoc("filaEnvios/ChIJa")).toBeUndefined();
  });
});

describe("GET /api/fila/proximo — guarda do {demo} sem resolver", () => {
  it("REPRODUÇÃO: frase com {demo} e sem APP_PUBLIC_URL não sai com o marcador literal", async () => {
    vi.stubEnv("APP_PUBLIC_URL", "");
    db.seed("config/app", { mensagemPadrao: "Oi {nome}, fiz isto pra você: {demo}" });
    semear(lead("ChIJa"));

    const corpo = await proximo();

    expect(corpo.temTarefa).toBe(false);
    expect(corpo.texto).toBe("");
    // A claim aberta na tentativa é DEVOLVIDA (expiraEm no EPOCH), não fica
    // pendurada como silêncio — nada saiu, e o servidor sabe.
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ estado: "reservado", expiraEm: EPOCH_ISO });
  });

  it("com APP_PUBLIC_URL o {demo} vira link e a tarefa sai", async () => {
    db.seed("config/app", { mensagemPadrao: "Oi {nome}, fiz isto pra você: {demo}" });
    semear(lead("ChIJa"));

    const corpo = await proximo();

    expect(corpo.temTarefa).toBe(true);
    expect(corpo.texto).not.toContain("{demo}");
    expect(corpo.texto).toContain("https://radar.exemplo.com/");
  });

  it("um lead barrado pela guarda não trava a fila: o próximo candidato sai", async () => {
    vi.stubEnv("APP_PUBLIC_URL", "");
    // Frase com {demo} só no grupo da busca do lead A; o B cai na global.
    db.seed("buscas/b-a", {
      id: "b-a",
      nome: "Barbearias Maringá",
      nicho: "barbearia",
      regiao: "Maringá",
      mensagemPadrao: "Oi {nome}: {demo}",
      criadaEm: "2026-03-01T00:00:00.000Z",
    });
    semear(
      lead("ChIJa", { buscaId: ["b-a"] }),
      lead("ChIJb", { criadoEm: "2026-03-02T00:00:00.000Z" }),
    );

    const corpo = await proximo();

    expect(corpo.leadId).toBe("ChIJb");
    expect(corpo.texto).not.toContain("{demo}");
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ expiraEm: EPOCH_ISO });
  });
});

describe("GET /api/fila/proximo — guarda de QUALQUER marcador sem resolver", () => {
  it("REPRODUÇÃO: {penetracao} sem o dado do lead não sai literal — a claim é devolvida", async () => {
    // Lead sem `siteProprio === false`: a linha de penetração não existe, e
    // `aplicarMarcadores` deixa o marcador intacto (nunca apaga em silêncio).
    db.seed("config/app", { mensagemPadrao: "Oi {nome}! {penetracao}" });
    semear(lead("ChIJa"));

    const corpo = await proximo();

    expect(corpo.temTarefa).toBe(false);
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ estado: "reservado", expiraEm: EPOCH_ISO });
  });

  it("REPRODUÇÃO: marcador digitado errado na frase ({Nome}) também não sai", async () => {
    db.seed("config/app", { mensagemPadrao: "Oi {Nome}, tudo bem?" });
    semear(lead("ChIJa"));

    const corpo = await proximo();

    expect(corpo.temTarefa).toBe(false);
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ expiraEm: EPOCH_ISO });
  });

  it("chave sem cara de marcador não barra: '{ }', '{:)}' e números entre chaves passam", async () => {
    db.seed("config/app", { mensagemPadrao: "Oi {nome} { } {:)} {2026}" });
    semear(lead("ChIJa"));

    const corpo = await proximo();

    expect(corpo.temTarefa).toBe(true);
    expect(corpo.texto).toBe("Oi Lead ChIJa { } {:)} {2026}");
  });
});

describe("GET /api/fila/resumo — mesma verdade que /proximo", () => {
  it("sem RADAR_DEVICE_USER_ID, motivoAtual é `pausado` e proximaJanela fica vazia", async () => {
    vi.stubEnv("RADAR_DEVICE_USER_ID", "");
    semear(lead("ChIJa"));

    const corpo = await resumo();

    expect(corpo.motivoAtual).toBe("pausado");
    expect(corpo.proximaJanela).toBe("");
    // O resumo nunca reserva.
    expect(db.getDoc("filaEnvios/ChIJa")).toBeUndefined();
  });
});

describe("GET /api/config/fila/saude (restrito ao admin)", () => {
  function request(cookie?: string) {
    return new Request("http://localhost/api/config/fila/saude", {
      headers: { ...(cookie && { cookie }) },
    });
  }

  it("sem sessão → 401; membro → 403", async () => {
    expect((await getSaude(request())).status).toBe(401);
    const membro = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    expect((await getSaude(request(membro))).status).toBe(403);
  });

  it("lista cada variável com presente/ausente — só o NOME, nunca o valor", async () => {
    vi.stubEnv("RADAR_DEVICE_USER_ID", "");
    const admin = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await getSaude(request(admin));
    const corpo = await res.json();
    const bruto = JSON.stringify(corpo);

    expect(res.status).toBe(200);
    expect(corpo.entregaLiberada).toBe(false);
    expect(corpo.faltando).toEqual(["RADAR_DEVICE_USER_ID"]);
    expect(corpo.variaveis.map((v: { nome: string }) => v.nome)).toEqual([
      "RADAR_DEVICE_KEY",
      "RADAR_DEVICE_USER_ID",
      "APP_PUBLIC_URL",
    ]);
    expect(corpo.variaveis).toEqual([
      expect.objectContaining({ nome: "RADAR_DEVICE_KEY", presente: true, exigida: true }),
      expect.objectContaining({ nome: "RADAR_DEVICE_USER_ID", presente: false, exigida: true }),
      expect.objectContaining({ nome: "APP_PUBLIC_URL", presente: true, exigida: false }),
    ]);
    // Nenhum valor vaza: nem a chave do aparelho, nem a URL.
    expect(bruto).not.toContain(CHAVE);
    expect(bruto).not.toContain("radar.exemplo.com");
  });

  it("tudo presente → entrega liberada, nada faltando", async () => {
    const admin = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await getSaude(request(admin))).json();

    expect(corpo.entregaLiberada).toBe(true);
    expect(corpo.faltando).toEqual([]);
  });
});
