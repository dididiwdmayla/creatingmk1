import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET, PATCH } from "../leads/[id]/route";

/**
 * "Adicionar à fila" — a seleção DELIBERADA do operador (`Lead.filaManual`).
 *
 * O que estes testes protegem é a distinção central do recurso: a marca fura
 * os filtros de POLÍTICA (isso é provado em `selecao.test.ts`) e NÃO fura os
 * FÍSICOS — e, quando falta uma peça, a ficha tem que DIZER qual, em vez de
 * o lead ficar marcado e invisível. A pendência vem do servidor de
 * propósito: recalculá-la no navegador criaria uma segunda cópia da regra
 * que decide quem entra na fila.
 */

let db: FakeFirestore;
let cookie: string;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const params = { params: Promise.resolve({ id: "ChIJa" }) };

/** O lead COMPLETO: passa em toda a peneira estrutural. */
function leadPronto(overrides: Record<string, unknown> = {}) {
  return {
    placeId: "ChIJa",
    nome: "Ink House",
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
        { ancora: "hero", tela: "celular", ordem: 1, url: "https://s/h.png", largura: 1, altura: 1 },
      ],
    },
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/leads/ChIJa", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    }),
    params,
  );
}

const ficha = () => GET(new Request("http://localhost"), params);

beforeEach(async () => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
  cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
  db.seed("leads/ChIJa", leadPronto());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PATCH /api/leads/[id] — filaManual", () => {
  it("marca o lead como escolhido à mão", async () => {
    const res = await patch({ filaManual: true });

    expect(res.status).toBe(200);
    expect((await res.json()).lead.filaManual).toBe(true);
  });

  it("DESMARCA pela mesma ficha — a escolha é reversível", async () => {
    await patch({ filaManual: true });

    expect((await (await patch({ filaManual: false })).json()).lead.filaManual).toBe(false);
  });

  it("não é booleano → 400", async () => {
    const res = await patch({ filaManual: "sim" });

    expect(res.status).toBe(400);
    expect((await res.json()).error.problemas).toContain("filaManual deve ser booleano");
  });

  it("sozinho no corpo já é um patch válido", async () => {
    expect((await patch({ filaManual: true })).status).toBe(200);
  });

  it("não atrapalha os outros extras do mesmo patch", async () => {
    const { lead } = await (await patch({ filaManual: true, descartado: true })).json();

    expect(lead).toMatchObject({ filaManual: true, descartado: true });
  });

  // Sem teste de sessão aqui, pelo mesmo motivo de `telefoneInvalido`: quem
  // barra anônimo nos extras é o PROXY, e este campo segue exatamente o
  // caminho de `descartado`/`favorito`. O que é restrito ao admin é a FILA
  // (o painel, o balão e as rotas dela), não o dado do lead.
});

describe("GET /api/leads/[id] — a pendência da seleção manual", () => {
  it("lead não marcado não traz pendência nenhuma", async () => {
    expect((await (await ficha()).json()).filaPendencia).toBeUndefined();
  });

  it("marcado e COMPLETO: sem pendência — ele é entregável", async () => {
    await patch({ filaManual: true });

    expect((await (await ficha()).json()).filaPendencia).toBeUndefined();
  });

  it("marcado e SEM DEMO: a ficha recebe o motivo", async () => {
    db.seed("leads/ChIJa", leadPronto({ filaManual: true, demo: undefined }));

    expect((await (await ficha()).json()).filaPendencia).toBe("semDemo");
  });

  it("marcado e com a captura não pronta: o motivo é o do print", async () => {
    db.seed(
      "leads/ChIJa",
      leadPronto({
        filaManual: true,
        capturas: { estado: "enfileirado", execucaoId: "e", pedidoEm: "2026-03-01T00:00:00.000Z", imagens: [] },
      }),
    );

    expect((await (await ficha()).json()).filaPendencia).toBe("capturaNaoPronta");
  });

  it("DECISÃO não vira pendência: descartado marcado à mão não devolve motivo", async () => {
    // Ele tem demo e print; o que o tira da fila é o descarte, que já tem
    // tarja própria na ficha. Duas tarjas para o mesmo fato confundiriam.
    db.seed("leads/ChIJa", leadPronto({ filaManual: true, descartado: true }));

    expect((await (await ficha()).json()).filaPendencia).toBeUndefined();
  });

  it("lead SEM a marca manual não recebe pendência mesmo faltando demo", async () => {
    db.seed("leads/ChIJa", leadPronto({ demo: undefined }));

    expect((await (await ficha()).json()).filaPendencia).toBeUndefined();
  });
});
