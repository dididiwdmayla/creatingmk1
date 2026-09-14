import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FILA_CANDIDATOS_COLLECTION, FILA_CANDIDATOS_DOC } from "@/lib/fila/candidatos";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import type { Lead } from "@/lib/leads/types";
import { GET } from "../fila/proximo/route";

/**
 * A rota que o celular chama de minuto em minuto. O que estes testes
 * protegem, acima de tudo, é o MOTIVO: cada "sem tarefa" tem que dizer a
 * verdade sobre por que não saiu mensagem, porque é essa frase que explica,
 * de manhã, por que saíram 4 e não 15.
 *
 * A resposta é ACHATADA (um nível só, todas as chaves sempre presentes) de
 * propósito: quem lê é uma macro do MacroDroid que não resolve chave
 * aninhada (`tarefa.id` devolvia o marcador literal). Por isso os testes
 * abaixo também vigiam a FORMA do corpo — todas as chaves, nenhum aninhado,
 * nenhum `null` — e não só o conteúdo.
 */

const CHAVES_RESPOSTA = [
  "temTarefa",
  "id",
  "leadId",
  "nome",
  "numero",
  "texto",
  "printUrl",
  "expiraEm",
  "motivo",
] as const;

const CHAVE = "chave-do-celular";

/**
 * Terça-feira, 10h no fuso do lead (offset 0): dentro da faixa `bom` da
 * barbearia (9h–11h30) e dentro do expediente. É a hora "tudo certo" de
 * onde os outros cenários se afastam de um critério por vez.
 */
const TERCA_10H = new Date("2026-03-10T10:00:00Z");
/** Mesma terça, 3h da manhã: fechado, nenhuma faixa — fora de janela. */
const TERCA_3H = new Date("2026-03-10T03:00:00Z");
/** Mesma terça, meio-dia: aberto, faixa nenhuma cobre → nível "razoavel". */
const TERCA_12H = new Date("2026-03-10T12:00:00Z");

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

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

function proximo(headers: Record<string, string> = { authorization: `Bearer ${CHAVE}` }) {
  return GET(new Request("http://localhost/api/fila/proximo", { headers }));
}

/** O pool é cache: entre cenários do mesmo teste ele precisa sair do caminho. */
function esquecerPool() {
  db.deleteDoc(`${FILA_CANDIDATOS_COLLECTION}/${FILA_CANDIDATOS_DOC}`);
}

/** O corpo achatado esperado quando não há tarefa: toda chave, tudo vazio. */
function semTarefaEsperado(motivo: string) {
  return {
    temTarefa: false,
    id: "",
    leadId: "",
    nome: "",
    numero: "",
    texto: "",
    printUrl: "",
    expiraEm: "",
    motivo,
  };
}

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("RADAR_DEVICE_KEY", CHAVE);
  vi.useFakeTimers();
  vi.setSystemTime(TERCA_10H);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/fila/proximo — autenticação", () => {
  it("sem a chave correta devolve 401 e não toca em lead nenhum", async () => {
    semear(lead("ChIJa"));

    const res = await proximo({ authorization: "Bearer chave-errada" });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ erro: "nao_autorizado" });
    expect(db.getDoc("filaEnvios/ChIJa")).toBeUndefined();
  });

  it("sem header nenhum devolve 401", async () => {
    expect((await proximo({})).status).toBe(401);
  });
});

describe("GET /api/fila/proximo — a tarefa", () => {
  it("entrega UM lead com tudo que o celular precisa para enviar", async () => {
    semear(lead("ChIJa"));

    const corpo = await (await proximo()).json();

    expect(corpo).toMatchObject({
      temTarefa: true,
      leadId: "ChIJa",
      nome: "Lead ChIJa",
      numero: "5544991543803",
      printUrl: "https://storage/hero-cel.png",
      expiraEm: new Date(TERCA_10H.getTime() + 5 * 60 * 1000).toISOString(),
      motivo: "",
    });
    expect(corpo.texto).toContain("Lead ChIJa");
    expect(corpo.id).toEqual(expect.any(String));
  });

  it("reserva a claim na MESMA chamada, com o dispositivo do header", async () => {
    semear(lead("ChIJa"));

    const corpo = await (await proximo({
      authorization: `Bearer ${CHAVE}`,
      "x-radar-device": "celular-bancada",
    })).json();

    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({
      estado: "reservado",
      claimId: corpo.id,
      dispositivo: "celular-bancada",
    });
  });

  it("sem o header, o dispositivo é 'android'", async () => {
    semear(lead("ChIJa"));
    await proximo();

    expect(db.getDoc("filaEnvios/ChIJa")?.dispositivo).toBe("android");
  });

  it("duas chamadas seguidas nunca devolvem o mesmo lead", async () => {
    semear(lead("ChIJa"), lead("ChIJb"));

    const primeira = await (await proximo()).json();
    const segunda = await (await proximo()).json();

    expect(primeira.leadId).not.toBe(segunda.leadId);
    expect([primeira.leadId, segunda.leadId].sort()).toEqual(["ChIJa", "ChIJb"]);
  });

  it("claim expirada volta a ser entregue", async () => {
    semear(lead("ChIJa"));
    const primeira = await (await proximo()).json();

    // O celular travou: a claim morre sozinha 5 minutos depois.
    vi.setSystemTime(new Date(TERCA_10H.getTime() + 6 * 60 * 1000));
    const segunda = await (await proximo()).json();

    expect(segunda.leadId).toBe("ChIJa");
    expect(segunda.id).not.toBe(primeira.id);
  });

  it("prefere a captura COM moldura quando ela existe", async () => {
    semear(
      lead("ChIJa", {
        capturas: {
          estado: "pronto",
          execucaoId: "e1",
          pedidoEm: "2026-03-01T00:00:00.000Z",
          imagens: [
            { ancora: "servicos", tela: "celular", ordem: 2, url: "https://storage/servicos.png", largura: 1, altura: 1 },
            {
              ancora: "hero",
              tela: "celular",
              ordem: 1,
              url: "https://storage/hero-cru.png",
              largura: 1,
              altura: 1,
              composta: { url: "https://storage/hero-moldura.png", largura: 1, altura: 1 },
            },
          ],
        },
      } as Partial<Lead>),
    );

    const corpo = await (await proximo()).json();

    // Seção principal = menor ordem; e a versão que "se lê como um site num
    // aparelho" numa conversa.
    expect(corpo.printUrl).toBe("https://storage/hero-moldura.png");
  });
});

describe("GET /api/fila/proximo — os seis motivos", () => {
  it("pausado: config/fila.ativo === false", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { ativo: false });

    expect(await (await proximo()).json()).toEqual(semTarefaEsperado("pausado"));
  });

  it("meta_atingida: o contador do dia bateu a metaDiaria", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { metaDiaria: 2 });
    db.seed("filaContadores/2026-03-10", { enviados: 2, envios: [], ultimoEventoEm: null });

    expect(await (await proximo()).json()).toEqual(semTarefaEsperado("meta_atingida"));
  });

  it("teto_hora: envios demais na última hora corrida", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { tetoPorHora: 2 });
    db.seed("filaContadores/2026-03-10", {
      enviados: 2,
      envios: ["2026-03-10T09:30:00.000Z", "2026-03-10T09:45:00.000Z"],
      ultimoEventoEm: null,
    });

    expect(await (await proximo()).json()).toEqual(semTarefaEsperado("teto_hora"));
  });

  it("intervalo: o último envio foi agora há pouco", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { intervaloMinimoSegundos: 300 });
    db.seed("filaContadores/2026-03-10", {
      enviados: 1,
      envios: [],
      ultimoEventoEm: "2026-03-10T09:58:00.000Z", // 2 min atrás
    });

    expect(await (await proximo()).json()).toEqual(semTarefaEsperado("intervalo"));
  });

  it("fora_de_janela: há lead pronto, mas é madrugada onde ele está", async () => {
    semear(lead("ChIJa"));
    vi.setSystemTime(TERCA_3H);

    expect(await (await proximo()).json()).toEqual(semTarefaEsperado("fora_de_janela"));
  });

  it("sem_leads_elegiveis: não existe lead pronto para mandar", async () => {
    semear(lead("ChIJa", { status: "contactado" }));

    expect(await (await proximo()).json()).toEqual(semTarefaEsperado("sem_leads_elegiveis"));
  });

  it("base vazia também é sem_leads_elegiveis, não fora_de_janela", async () => {
    expect(await (await proximo()).json()).toEqual(semTarefaEsperado("sem_leads_elegiveis"));
  });
});

describe("GET /api/fila/proximo — a janela", () => {
  it("com exigirJanelaBoa false, a faixa razoável também sai", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { exigirJanelaBoa: false });
    vi.setSystemTime(TERCA_12H);

    const corpo = await (await proximo()).json();

    expect(corpo.leadId).toBe("ChIJa");
  });

  it("com exigirJanelaBoa true, a mesma hora razoável NÃO sai", async () => {
    semear(lead("ChIJa"));
    vi.setSystemTime(TERCA_12H);

    expect(await (await proximo()).json()).toEqual(semTarefaEsperado("fora_de_janela"));
  });

  it("lead sem fuso derivável nunca é entregue (não se manda às 3 da manhã)", async () => {
    semear(lead("ChIJa", { horarios: undefined, endereco: undefined }));

    expect(await (await proximo()).json()).toEqual(semTarefaEsperado("sem_leads_elegiveis"));
  });
});

describe("GET /api/fila/proximo — os filtros de elegibilidade", () => {
  const casos: Array<[string, Partial<Lead>]> = [
    ["lead sem capturas prontas nunca é entregue", { capturas: { estado: "rodando", execucaoId: "e", pedidoEm: "2026-03-01T00:00:00.000Z" } as Lead["capturas"] }],
    ["capturas prontas mas sem imagem de celular também não", { capturas: { estado: "pronto", execucaoId: "e", pedidoEm: "2026-03-01T00:00:00.000Z", imagens: [{ ancora: "hero", tela: "desktop", ordem: 1, url: "u", largura: 1, altura: 1 }] } as Lead["capturas"]}],
    ["lead sem demo não é entregue", { demo: undefined }],
    ["lead sem telefone não é entregue", { telefoneIntl: undefined }],
    ["lead com telefoneInvalido não é entregue", { telefoneInvalido: true }],
    ["lead descartado não é entregue", { descartado: true }],
    ["lead que não está 'novo' não é entregue", { status: "respondeu" }],
  ];

  for (const [nome, override] of casos) {
    it(nome, async () => {
      semear(lead("ChIJa", override));

      expect(await (await proximo()).json()).toEqual(semTarefaEsperado("sem_leads_elegiveis"));
      expect(db.getDoc("filaEnvios/ChIJa")).toBeUndefined();
    });
  }

  it("respeita nichosPermitidos quando não está vazio", async () => {
    semear(lead("ChIJa", { busca: { nicho: "barbearia masculina", regiao: "r", em: "2026-03-01T00:00:00.000Z" } }));
    db.seed("config/fila", { nichosPermitidos: ["tatuagem"] });

    expect(await (await proximo()).json()).toEqual(semTarefaEsperado("sem_leads_elegiveis"));

    // O mesmo lead passa quando o nicho dele entra na lista (por substring).
    db.seed("config/fila", { nichosPermitidos: ["barbearia"] });
    esquecerPool();

    expect((await (await proximo()).json()).leadId).toBe("ChIJa");
  });
});

describe("GET /api/fila/proximo — o pool é cache, nunca fonte de verdade", () => {
  it("lead que saiu da elegibilidade depois do pool não é entregue", async () => {
    semear(lead("ChIJa"), lead("ChIJb"));
    // Primeira chamada constrói o pool com os dois.
    await proximo();

    // Fora do Radar, o lead vira contactado — o pool ainda não sabe.
    db.seed("leads/ChIJb", { ...db.getDoc("leads/ChIJb"), status: "contactado" });

    const corpo = await (await proximo()).json();

    expect(corpo.temTarefa).toBe(false);
    expect(corpo.motivo).toBe("sem_leads_elegiveis");
    // E a claim que a tentativa abriu foi devolvida, não deixada pendurada.
    expect(db.getDoc("filaEnvios/ChIJb")?.expiraEm).toBe(new Date(0).toISOString());
  });

  it("reserva perdida para outro ciclo cai no próximo candidato, sem erro", async () => {
    semear(lead("ChIJa"), lead("ChIJb", { criadoEm: "2026-03-02T00:00:00.000Z" }));
    // ChIJa (mais antigo) já está reservado por alguém.
    db.seed("filaEnvios/ChIJa", {
      leadId: "ChIJa",
      estado: "reservado",
      claimId: "de-outro",
      reservadoEm: TERCA_10H.toISOString(),
      expiraEm: new Date(TERCA_10H.getTime() + 60_000).toISOString(),
      dispositivo: "outro",
      tentativas: 0,
      ultimoErro: null,
      enviadoEm: null,
    });

    const corpo = await (await proximo()).json();

    expect(corpo.leadId).toBe("ChIJb");
    expect(db.getDoc("filaEnvios/ChIJa")?.claimId).toBe("de-outro"); // intacta
  });
});

describe("GET /api/fila/proximo — a ordem de atendimento", () => {
  it("quem entrou na base primeiro é atendido primeiro", async () => {
    semear(
      lead("ChIJnovo", { criadoEm: "2026-03-05T00:00:00.000Z" }),
      lead("ChIJvelho", { criadoEm: "2026-01-01T00:00:00.000Z" }),
    );

    expect((await (await proximo()).json()).leadId).toBe("ChIJvelho");
  });

  it("janela boa vence janela razoável, mesmo o razoável sendo mais antigo", async () => {
    db.seed("config/fila", { exigirJanelaBoa: false });
    semear(
      // Offset 0 às 12h: aberto, sem faixa cobrindo → razoável.
      lead("ChIJrazoavel", { criadoEm: "2026-01-01T00:00:00.000Z" }),
      // Três horas a oeste: 9h local às 12h UTC → dentro da faixa boa.
      lead("ChIJbom", {
        criadoEm: "2026-03-05T00:00:00.000Z",
        horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-03-01T00:00:00.000Z" },
      }),
    );
    vi.setSystemTime(TERCA_12H);

    expect((await (await proximo()).json()).leadId).toBe("ChIJbom");
  });
});

describe("GET /api/fila/proximo — o contrato achatado", () => {
  it("com tarefa, todas as chaves estão presentes e nenhuma é objeto, array ou null", async () => {
    semear(lead("ChIJa"));

    const corpo = await (await proximo()).json();

    for (const chave of CHAVES_RESPOSTA) {
      expect(corpo).toHaveProperty(chave);
      expect(corpo[chave]).not.toBeNull();
      expect(typeof corpo[chave]).not.toBe("object");
    }
    expect(typeof corpo.temTarefa).toBe("boolean");
    for (const chave of CHAVES_RESPOSTA) {
      if (chave === "temTarefa") continue;
      expect(typeof corpo[chave]).toBe("string");
    }
    expect(corpo.motivo).toBe("");
  });

  it("sem tarefa, todas as chaves estão presentes e nenhuma é objeto, array ou null", async () => {
    // Base vazia: nenhum candidato, motivo "sem_leads_elegiveis".
    const corpo = await (await proximo()).json();

    for (const chave of CHAVES_RESPOSTA) {
      expect(corpo).toHaveProperty(chave);
      expect(corpo[chave]).not.toBeNull();
      expect(typeof corpo[chave]).not.toBe("object");
    }
    expect(typeof corpo.temTarefa).toBe("boolean");
    for (const chave of CHAVES_RESPOSTA) {
      if (chave === "temTarefa") continue;
      expect(typeof corpo[chave]).toBe("string");
    }
    expect(corpo.temTarefa).toBe(false);
    expect(corpo.motivo).not.toBe("");
  });

  it("o JSON serializado não omite nenhuma chave de valor vazio", async () => {
    const res = await proximo();
    const texto = await res.text();
    const corpo = JSON.parse(texto);

    for (const chave of CHAVES_RESPOSTA) {
      expect(Object.prototype.hasOwnProperty.call(corpo, chave)).toBe(true);
    }
    // As aspas vazias precisam sobreviver à serialização, não sumir do texto.
    expect(texto).toContain('"id":""');
    expect(texto).toContain('"leadId":""');
    expect(texto).toContain('"printUrl":""');
  });

  it("o formato não mudou: exatamente as CHAVES_RESPOSTA, nenhuma a mais — o diagnóstico interno da seleção não vaza aqui", async () => {
    semear(lead("ChIJa"));

    const comTarefa = await (await proximo()).json();
    expect(Object.keys(comTarefa).sort()).toEqual([...CHAVES_RESPOSTA].sort());

    // Sem tarefa nenhuma também: `ordenarCandidatos` agora devolve
    // `{ escolhido, diagnostico }` internamente, mas nada disso pode
    // aparecer no corpo achatado que o MacroDroid lê.
    const semTarefa = await (await proximo()).json();
    expect(Object.keys(semTarefa).sort()).toEqual([...CHAVES_RESPOSTA].sort());
    expect(semTarefa).not.toHaveProperty("diagnostico");
    expect(semTarefa).not.toHaveProperty("escolhido");
  });
});
