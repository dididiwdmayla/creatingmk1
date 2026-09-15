import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEAD_TESTE_ID } from "@/lib/fila/leadTeste";
import { FILA_TESTES_COLLECTION, FILA_TESTE_DOC } from "@/lib/fila/teste";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET, POST } from "../fila/teste/route";

/**
 * A ROTA DO DISPARO DE TESTE — o botão da tela.
 *
 * Dois produtos, e os dois são testados aqui: o disparo em si (que injeta a
 * tarefa que `/proximo` vai entregar) e, quando ele não sai, QUAL ETAPA
 * barrou — nominalmente. Dizer só "não deu" transformaria a ferramenta de
 * diagnóstico em outra caixa preta, que é exatamente o que ela existe para
 * abrir.
 *
 * A rota é ADMIN: ela faz o celular do admin acordar a tela e mandar
 * mensagem. Vive sob `/api/fila/*`, o prefixo que o proxy isenta da sessão
 * (porque é lá que o aparelho bate com a RADAR_DEVICE_KEY), então faz a
 * própria checagem de sessão + papel — e há teste para os dois lados.
 */

/** Terça, 10h no fuso do lead: dentro da faixa `bom` da barbearia (9h–11h30). */
const TERCA_10H = new Date("2026-03-10T10:00:00Z");
/** Mesma terça, 3h da manhã: fechado, faixa nenhuma. */
const TERCA_3H = new Date("2026-03-10T03:00:00Z");
/** Mesma terça, meio-dia: aberto e sem faixa cobrindo → nível "razoavel". */
const TERCA_12H = new Date("2026-03-10T12:00:00Z");

const TESTE_DOC = `${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`;

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
      execucaoId: "e1",
      pedidoEm: "2026-03-01T00:00:00.000Z",
      imagens: [
        { ancora: "hero", tela: "celular", ordem: 1, url: "https://storage/hero.png", largura: 1, altura: 1 },
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

function getReq(cookie?: string) {
  return new Request("http://localhost/api/fila/teste", {
    headers: { ...(cookie && { cookie }) },
  });
}

function postReq(corpo: unknown, cookie?: string) {
  return new Request("http://localhost/api/fila/teste", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify(corpo),
  });
}

async function admin() {
  return cookieDeSessao(db, { id: "admin", papel: "admin" });
}

/** Dispara e devolve o corpo já em JSON — o caminho de quase todo teste. */
async function disparar(corpo: unknown = {}) {
  const res = await POST(postReq(corpo, await admin()));
  return { status: res.status, corpo: await res.json() };
}

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.useFakeTimers();
  vi.setSystemTime(TERCA_10H);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("permissão — o painel inteiro é do admin", () => {
  it("GET sem sessão → 401", async () => {
    expect((await GET(getReq())).status).toBe(401);
  });

  it("GET de membro → 403, e nada do disparo vaza no corpo", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await GET(getReq(cookie));

    expect(res.status).toBe(403);
    const corpo = await res.json();
    expect(corpo).not.toHaveProperty("numeroTeste");
    expect(corpo).not.toHaveProperty("atual");
  });

  it("POST sem sessão → 401 e nada é injetado", async () => {
    const res = await POST(postReq({}));

    expect(res.status).toBe(401);
    expect(db.getDoc(TESTE_DOC)).toBeUndefined();
  });

  it("POST de membro → 403 e nada é injetado — é comando sobre o aparelho do admin", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await POST(postReq({}, cookie));

    expect(res.status).toBe(403);
    expect(db.getDoc(TESTE_DOC)).toBeUndefined();
  });

  it("o membro nem chega a criar o lead fixo de teste", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    await GET(getReq(cookie));

    expect(db.getDoc(`leads/${LEAD_TESTE_ID}`)).toBeUndefined();
  });
});

describe("GET /api/fila/teste — o estado do disparo", () => {
  it("cria o lead fixo de teste na primeira abertura do painel", async () => {
    const res = await GET(getReq(await admin()));
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(corpo.leadDeTeste.leadId).toBe(LEAD_TESTE_ID);
    expect(corpo.leadDeTeste.nome).toBe("Barbearia Dom Aurélio");
    // Sem captura ainda: o painel manda o operador gerar uma vez.
    expect(corpo.leadDeTeste.pronto).toBe(false);
    expect(db.getDoc(`leads/${LEAD_TESTE_ID}`)?.leadDeTeste).toBe(true);
  });

  it("não sobrescreve o lead fixo já existente — a captura gerada à mão sobrevive", async () => {
    semear(lead(LEAD_TESTE_ID, { leadDeTeste: true, nome: "Barbearia Dom Aurélio" }));

    const corpo = await (await GET(getReq(await admin()))).json();

    expect(corpo.leadDeTeste.pronto).toBe(true);
    expect(db.getDoc(`leads/${LEAD_TESTE_ID}`)?.capturas).toMatchObject({ execucaoId: "e1" });
  });

  it("devolve o numeroTeste e a tarefa atual", async () => {
    semear(lead(LEAD_TESTE_ID, { leadDeTeste: true }));
    await disparar();

    const corpo = await (await GET(getReq(await admin()))).json();

    expect(corpo.numeroTeste).toBe("5544984570105");
    expect(corpo.atual).toMatchObject({ estado: "pendente", leadId: LEAD_TESTE_ID });
  });

  it("sem teste nenhum, `atual` é null e não erro", async () => {
    const corpo = await (await GET(getReq(await admin()))).json();
    expect(corpo.atual).toBeNull();
  });
});

describe("POST /api/fila/teste — o alvo", () => {
  it("sem leadId, o alvo é o lead fixo de teste (o PADRÃO, não o único)", async () => {
    semear(lead(LEAD_TESTE_ID, { leadDeTeste: true, nome: "Barbearia Dom Aurélio" }));

    const { corpo } = await disparar();

    expect(corpo.injetada).toBe(true);
    expect(corpo.teste.leadId).toBe(LEAD_TESTE_ID);
    expect(db.getDoc(TESTE_DOC)).toMatchObject({ estado: "pendente", leadId: LEAD_TESTE_ID });
  });

  it("aceita um lead ESCOLHIDO — é para isso que os interruptores existem", async () => {
    semear(lead("ChIJescolhido"));

    const { corpo } = await disparar({ leadId: "ChIJescolhido" });

    expect(corpo.injetada).toBe(true);
    expect(corpo.teste.leadId).toBe("ChIJescolhido");
  });

  it("o número da tarefa é o `numeroTeste`, nunca o telefone do lead", async () => {
    db.seed("config/fila", { numeroTeste: "5544900001111" });
    semear(lead("ChIJescolhido", { telefoneIntl: "+55 44 98888-7777" }));

    const { corpo } = await disparar({ leadId: "ChIJescolhido" });

    expect(corpo.teste.numero).toBe("5544900001111");
  });

  it("a mensagem real é montada e congelada na tarefa", async () => {
    semear(lead("ChIJescolhido", { nome: "Barbearia do Zé" }));

    const { corpo } = await disparar({ leadId: "ChIJescolhido" });

    expect(corpo.teste.texto).toContain("Barbearia do Zé");
    expect(corpo.teste.printUrl).toBe("https://storage/hero.png");
  });

  it("leadId inexistente → 404 (pedido malformado, não diagnóstico)", async () => {
    const { status } = await disparar({ leadId: "ChIJnaoexiste" });
    expect(status).toBe(404);
    expect(db.getDoc(TESTE_DOC)).toBeUndefined();
  });

  it("etapa desconhecida em `pular` → 400", async () => {
    const { status } = await disparar({ pular: ["inventada"] });
    expect(status).toBe(400);
  });
});

describe("POST /api/fila/teste — cada interruptor pula a etapa certa", () => {
  it("RITMO: a fila pausada barra, e o resultado NOMEIA a etapa e o motivo", async () => {
    db.seed("config/fila", { ativo: false });
    semear(lead("ChIJa"));

    const { corpo } = await disparar({ leadId: "ChIJa" });

    expect(corpo).toMatchObject({ injetada: false, etapa: "ritmo", motivo: "pausado" });
    expect(db.getDoc(TESTE_DOC)).toBeUndefined();
  });

  it("RITMO pulado: a mesma fila pausada injeta", async () => {
    db.seed("config/fila", { ativo: false });
    semear(lead("ChIJa"));

    const { corpo } = await disparar({ leadId: "ChIJa", pular: ["ritmo"] });

    expect(corpo.injetada).toBe(true);
    expect(corpo.teste.pulou).toEqual(["ritmo"]);
  });

  it("RITMO nomeia o portão específico, não um 'ritmo' genérico", async () => {
    db.seed("config/fila", { metaDiaria: 2 });
    db.seed("filaContadores/2026-03-10", { enviados: 5, envios: [], ultimoEventoEm: null });
    semear(lead("ChIJa"));

    const { corpo } = await disparar({ leadId: "ChIJa" });

    expect(corpo.motivo).toBe("meta_atingida");
  });

  it("ESTRUTURAIS: barra pelo primeiro critério da ordem real", async () => {
    semear(lead("ChIJa", { status: "contactado", descartado: true }));

    const { corpo } = await disparar({ leadId: "ChIJa" });

    // `status` vem antes de `descartado` em `motivoEstrutural` — a mesma
    // ordem do funil da visão, para as duas telas não discordarem.
    expect(corpo).toMatchObject({ etapa: "estruturais", motivo: "status" });
  });

  it("ESTRUTURAIS pulados: um lead já contactado vira alvo de teste", async () => {
    semear(lead("ChIJa", { status: "contactado" }));

    const { corpo } = await disparar({ leadId: "ChIJa", pular: ["estruturais"] });

    expect(corpo.injetada).toBe(true);
  });

  it("NICHO: barra quando o nicho não está na lista permitida", async () => {
    db.seed("config/fila", { nichosPermitidos: ["dentista"] });
    semear(lead("ChIJa"));

    const { corpo } = await disparar({ leadId: "ChIJa" });

    expect(corpo).toMatchObject({ etapa: "nicho", motivo: "fora_dos_nichos" });
  });

  it("NICHO pulado: injeta mesmo fora da lista", async () => {
    db.seed("config/fila", { nichosPermitidos: ["dentista"] });
    semear(lead("ChIJa"));

    const { corpo } = await disparar({ leadId: "ChIJa", pular: ["nicho"] });

    expect(corpo.injetada).toBe(true);
  });

  it("JANELA: às 3h o lead está FECHADO, e a resposta diz isso", async () => {
    vi.setSystemTime(TERCA_3H);
    semear(lead("ChIJa"));

    const { corpo } = await disparar({ leadId: "ChIJa" });

    expect(corpo).toMatchObject({ etapa: "janela", motivo: "fechado" });
  });

  it("JANELA: ao meio-dia é `razoavel`, e a config só aceita `boa`", async () => {
    vi.setSystemTime(TERCA_12H);
    semear(lead("ChIJa"));

    const { corpo } = await disparar({ leadId: "ChIJa" });

    expect(corpo).toMatchObject({ etapa: "janela", motivo: "razoavel" });
  });

  it("JANELA pulada: injeta às 3h da manhã", async () => {
    vi.setSystemTime(TERCA_3H);
    semear(lead("ChIJa"));

    const { corpo } = await disparar({ leadId: "ChIJa", pular: ["janela"] });

    expect(corpo.injetada).toBe(true);
  });

  it("a ordem de avaliação é a real: ritmo antes de estruturais", async () => {
    db.seed("config/fila", { ativo: false });
    semear(lead("ChIJa", { status: "contactado" }));

    const { corpo } = await disparar({ leadId: "ChIJa" });

    expect(corpo.etapa).toBe("ritmo");
  });

  it("com as quatro puladas, um lead que reprova em tudo ainda injeta", async () => {
    db.seed("config/fila", { ativo: false, nichosPermitidos: ["dentista"] });
    vi.setSystemTime(TERCA_3H);
    semear(lead("ChIJa", { status: "contactado" }));

    const { corpo } = await disparar({
      leadId: "ChIJa",
      pular: ["ritmo", "estruturais", "nicho", "janela"],
    });

    expect(corpo.injetada).toBe(true);
  });
});

describe("POST /api/fila/teste — só injeta se houver o que enviar", () => {
  it("sem printUrl não injeta, e INFORMA — tarefa sem print quebra o ciclo sem ensinar nada", async () => {
    semear(
      lead("ChIJa", {
        capturas: {
          estado: "pronto",
          execucaoId: "e1",
          pedidoEm: "2026-03-01T00:00:00.000Z",
          // Só desktop: `printUrlDoLead` escolhe a de CELULAR.
          imagens: [
            { ancora: "hero", tela: "desktop", ordem: 1, url: "https://storage/d.png", largura: 1, altura: 1 },
          ],
        },
      }),
    );

    const { corpo } = await disparar({
      leadId: "ChIJa",
      pular: ["ritmo", "estruturais", "nicho", "janela"],
    });

    expect(corpo).toMatchObject({ injetada: false, etapa: "conteudo", motivo: "sem_print" });
    expect(db.getDoc(TESTE_DOC)).toBeUndefined();
  });

  it("sem demo não injeta, mesmo com os estruturais pulados", async () => {
    semear(lead("ChIJa", { demo: undefined }));

    const { corpo } = await disparar({
      leadId: "ChIJa",
      pular: ["ritmo", "estruturais", "nicho", "janela"],
    });

    expect(corpo).toMatchObject({ injetada: false, etapa: "conteudo", motivo: "sem_demo" });
  });

  it("captura ainda rodando não injeta", async () => {
    semear(
      lead("ChIJa", {
        capturas: { estado: "rodando", execucaoId: "e1", pedidoEm: "2026-03-01T00:00:00.000Z" },
      }),
    );

    const { corpo } = await disparar({
      leadId: "ChIJa",
      pular: ["ritmo", "estruturais", "nicho", "janela"],
    });

    expect(corpo).toMatchObject({ injetada: false, etapa: "conteudo", motivo: "captura_nao_pronta" });
  });

  it("com os estruturais LIGADOS, o mesmo lead sem print para antes, na etapa estrutural", async () => {
    semear(lead("ChIJa", { demo: undefined }));

    const { corpo } = await disparar({ leadId: "ChIJa" });

    expect(corpo).toMatchObject({ etapa: "estruturais", motivo: "semDemo" });
  });
});

describe("POST /api/fila/teste — numeroTeste vazio", () => {
  it("não injeta e diz por quê", async () => {
    db.seed("config/fila", { numeroTeste: "" });
    semear(lead("ChIJa"));

    const { corpo } = await disparar({ leadId: "ChIJa" });

    expect(corpo).toMatchObject({ injetada: false, etapa: "numero", motivo: "numero_teste_vazio" });
    expect(db.getDoc(TESTE_DOC)).toBeUndefined();
  });

  it("nem com todas as etapas puladas — não existe interruptor para o destino", async () => {
    db.seed("config/fila", { numeroTeste: "" });
    semear(lead("ChIJa"));

    const { corpo } = await disparar({
      leadId: "ChIJa",
      pular: ["ritmo", "estruturais", "nicho", "janela"],
    });

    expect(corpo).toMatchObject({ injetada: false, etapa: "numero" });
  });
});
