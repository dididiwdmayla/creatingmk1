import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BALAO_LINHAS, BALAO_PENDENTES } from "@/lib/fila/balao";
import { estruturalVazio } from "@/lib/fila/candidatos";
import type { AppDb } from "@/lib/firestore-like";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../config/fila/balao/route";
import { DELETE } from "../config/fila/balao/[leadId]/route";

/**
 * O BALÃO da fila — o indicador que fica em TODA tela do app.
 *
 * O que estes testes protegem, acima de tudo, é o CUSTO: o estado fechado
 * (o que a navegação normal paga) não pode encostar no pool nem em `/leads`,
 * e nem o aberto pode disparar a varredura cara que o pool existe para
 * evitar. Depois disso, a ordem — que é a de `ordenarCandidatos` e de mais
 * ninguém — e a guarda da única ação: remover um lead com claim ativa é
 * recusado, porque remover NÃO cancela envio em andamento.
 */

/**
 * Conta VARREDURA de coleção e leitura de DOC, esta última por caminho — é
 * como o custo do balão vira número aqui, e é a asserção principal do
 * arquivo. `usuarios/*` é descontado: a leitura da sessão é de toda rota de
 * admin, não do balão.
 */
function contando(base: FakeFirestore): {
  db: AppDb;
  varreduras: () => Record<string, number>;
  docs: () => string[];
} {
  const varreduras: Record<string, number> = {};
  const docs: string[] = [];
  const db: AppDb = {
    collection(name: string) {
      const real = base.collection(name);
      return {
        ...real,
        doc: (id: string) => {
          const ref = real.doc(id);
          return {
            ...ref,
            get: async () => {
              docs.push(`${name}/${id}`);
              return ref.get();
            },
          };
        },
        get: async () => {
          varreduras[name] = (varreduras[name] ?? 0) + 1;
          return real.get();
        },
      };
    },
    runTransaction: (fn) => base.runTransaction(fn),
  };
  return {
    db,
    varreduras: () => varreduras,
    docs: () => docs.filter((caminho) => !caminho.startsWith("usuarios/")),
  };
}

/** 13h UTC = 10h locais do lead (offset -180): faixa "bom" da barbearia. */
const AGORA = new Date("2026-03-10T13:00:00Z");

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const LEAD_BASE = {
  status: "novo",
  enriquecido: false,
  telefoneIntl: "+55 44 99154-3803",
  busca: { nicho: "Barbearia Masculina", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
  demo: { skinId: "barbearia-editorial" },
  horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-03-01T00:00:00.000Z" },
  capturas: {
    estado: "pronto",
    execucaoId: "e1",
    pedidoEm: "2026-03-01T00:00:00.000Z",
    imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "u", largura: 1, altura: 1 }],
  },
  criadoEm: "2026-03-01T00:00:00.000Z",
  atualizadoEm: "2026-03-01T00:00:00.000Z",
};

function semearLead(id: string, nome: string, extra: Record<string, unknown> = {}) {
  db.seed(`leads/${id}`, { ...LEAD_BASE, placeId: id, nome, ...extra });
}

function semearPool(
  candidatos: Array<{ id: string; manual?: boolean; criadoEm?: string; nicho?: string }>,
  extra: Record<string, unknown> = {},
) {
  db.seed("filaCandidatos/pool", {
    geradoEm: AGORA.toISOString(),
    candidatos: candidatos.map(({ id, manual, criadoEm, nicho }, i) => ({
      id,
      nicho: nicho ?? "barbearia masculina",
      offset: -180,
      faixas: [],
      criadoEm: criadoEm ?? `2026-03-0${i + 1}T00:00:00.000Z`,
      ...(manual && { manual: true }),
    })),
    lidos: candidatos.length,
    truncado: false,
    estrutural: estruturalVazio(),
    manuaisPendentes: [],
    manuaisPendentesTotal: 0,
    ...extra,
  });
}

function balao(cookie?: string, comLista = false) {
  return GET(
    new Request(`http://localhost/api/config/fila/balao${comLista ? "?lista=1" : ""}`, {
      headers: cookie ? { cookie } : {},
    }),
  );
}

function remover(leadId: string, cookie?: string) {
  return DELETE(
    new Request(`http://localhost/api/config/fila/balao/${leadId}`, {
      method: "DELETE",
      headers: cookie ? { cookie } : {},
    }),
    { params: Promise.resolve({ leadId }) },
  );
}

const comoAdmin = () => cookieDeSessao(db, { id: "admin", papel: "admin" });

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

describe("GET /api/config/fila/balao — permissão", () => {
  it("sem sessão → 401, e nada da fila vaza no corpo", async () => {
    const res = await balao();

    expect(res.status).toBe(401);
    const corpo = await res.json();
    expect(corpo.error.code).toBe("unauthorized");
    expect(corpo).not.toHaveProperty("fila");
    expect(corpo).not.toHaveProperty("contador");
  });

  it("MEMBRO comum → 403, e nada da fila vaza no corpo", async () => {
    // O balão é ADMIN ONLY pelo mesmo motivo do painel: a fila é global e é
    // drenada por UM aparelho físico — mexer nela é comando sobre o celular
    // de outra pessoa.
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await balao(cookie);

    expect(res.status).toBe(403);
    const corpo = await res.json();
    expect(corpo.error.code).toBe("forbidden");
    expect(corpo).not.toHaveProperty("fila");
    expect(corpo).not.toHaveProperty("contador");
  });

  it("membro também não remove lead nenhum → 403, e o lead fica intacto", async () => {
    semearLead("a", "Barbearia do Zé");
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    expect((await remover("a", cookie)).status).toBe(403);
    expect(db.getDoc("leads/a")?.descartado).toBeUndefined();
  });

  it("admin → 200", async () => {
    expect((await balao(await comoAdmin())).status).toBe(200);
  });
});

describe("GET /api/config/fila/balao — o estado FECHADO custa 2 leituras", () => {
  it("lê config/fila e o contador do dia, e mais nada", async () => {
    db.seed("config/fila", { ativo: true, metaDiaria: 15 });
    db.seed("filaContadores/2026-03-10", { enviados: 7, envios: [], ultimoEventoEm: null });
    semearPool([{ id: "a" }]);
    semearLead("a", "Barbearia do Zé");
    const cookie = await comoAdmin();

    const { db: espiao, varreduras, docs } = contando(db);
    db = espiao as unknown as FakeFirestore;
    const corpo = await (await balao(cookie)).json();

    expect(corpo).toMatchObject({ lista: false, ativo: true });
    expect(corpo.contador).toMatchObject({ enviados: 7, meta: 15, restante: 8 });
    // DUAS leituras, nomeadas — é este par que a navegação normal paga, em
    // toda tela do app. Nenhuma varredura de coleção nenhuma.
    expect(docs()).toEqual(["config/fila", "filaContadores/2026-03-10"]);
    expect(varreduras()).toEqual({});
  });

  it("não toca no pool nem nos nomes: listas vazias e poolGeradoEm null", async () => {
    semearPool([{ id: "a" }]);
    semearLead("a", "Barbearia do Zé");

    const corpo = await (await balao(await comoAdmin())).json();

    expect(corpo.fila).toEqual([]);
    expect(corpo.pendentes).toEqual([]);
    expect(corpo.elegiveis).toBe(0);
    expect(corpo.poolGeradoEm).toBeNull();
  });

  it("diz se a fila está PAUSADA — é metade do que o estado fechado mostra", async () => {
    db.seed("config/fila", { ativo: false });

    const corpo = await (await balao(await comoAdmin())).json();

    expect(corpo.ativo).toBe(false);
    expect(corpo.ritmo).toBe("pausado");
  });

  it("as chaves são as MESMAS nos dois estados — a tela nunca checa a forma", async () => {
    semearPool([{ id: "a" }]);
    semearLead("a", "Barbearia do Zé");
    const cookie = await comoAdmin();

    const fechado = await (await balao(cookie)).json();
    const aberto = await (await balao(cookie, true)).json();

    expect(Object.keys(fechado).sort()).toEqual(Object.keys(aberto).sort());
  });
});

describe("GET /api/config/fila/balao?lista=1 — o estado ABERTO", () => {
  it("a sequência sai na ORDEM DA SELEÇÃO, com nome, nicho cru e hora local", async () => {
    semearPool([
      { id: "velho", criadoEm: "2026-03-01T00:00:00.000Z" },
      { id: "novo", criadoEm: "2026-03-05T00:00:00.000Z" },
    ]);
    semearLead("velho", "Primeiro da fila");
    semearLead("novo", "Chegou depois");

    const corpo = await (await balao(await comoAdmin(), true)).json();

    expect(corpo.lista).toBe(true);
    expect(corpo.fila).toEqual([
      {
        leadId: "velho",
        nome: "Primeiro da fila",
        nicho: "Barbearia Masculina",
        nivel: "bom",
        horaLocal: "10h",
        manual: false,
        proximaFaixa: null,
      },
      {
        leadId: "novo",
        nome: "Chegou depois",
        nicho: "Barbearia Masculina",
        nivel: "bom",
        horaLocal: "10h",
        manual: false,
        proximaFaixa: null,
      },
    ]);
    expect(corpo.elegiveis).toBe(2);
  });

  it("o MANUAL vem na frente e vem marcado — a mesma ordem de /proximo", async () => {
    semearPool([
      { id: "velho", criadoEm: "2020-01-01T00:00:00.000Z" },
      { id: "manual", criadoEm: "2026-03-09T00:00:00.000Z", manual: true },
    ]);
    semearLead("velho", "Esperando há anos");
    semearLead("manual", "Escolhido à mão");

    const { fila } = await (await balao(await comoAdmin(), true)).json();

    expect(fila.map((l: { leadId: string }) => l.leadId)).toEqual(["manual", "velho"]);
    expect(fila[0].manual).toBe(true);
    expect(fila[1].manual).toBe(false);
  });

  it("os PENDENTES vêm com o motivo, e não entram na fila de entrega", async () => {
    semearPool([{ id: "ok" }], {
      manuaisPendentes: [{ id: "pendente", motivo: "semDemo" }],
      manuaisPendentesTotal: 1,
    });
    semearLead("ok", "Pronto para sair");
    semearLead("pendente", "Falta a demo", { filaManual: true, demo: undefined });

    const corpo = await (await balao(await comoAdmin(), true)).json();

    expect(corpo.fila.map((l: { leadId: string }) => l.leadId)).toEqual(["ok"]);
    expect(corpo.pendentes).toEqual([
      { leadId: "pendente", nome: "Falta a demo", nicho: "Barbearia Masculina", motivo: "semDemo" },
    ]);
    expect(corpo.pendentesTotal).toBe(1);
  });

  it("pendente RECONFERIDO no doc fresco: quem ganhou demo some da lista", async () => {
    // O pool é um retrato de até 10 min atrás; a demo pode ter nascido
    // depois. Mostrar como pendente quem já não é seria mentir.
    semearPool([], {
      manuaisPendentes: [{ id: "resolvido", motivo: "semDemo" }],
      manuaisPendentesTotal: 1,
    });
    semearLead("resolvido", "Já tem demo", { filaManual: true });

    expect((await (await balao(await comoAdmin(), true)).json()).pendentes).toEqual([]);
  });

  it("pendente que DEIXOU de ser manual some da lista", async () => {
    semearPool([], {
      manuaisPendentes: [{ id: "desmarcado", motivo: "semDemo" }],
      manuaisPendentesTotal: 1,
    });
    semearLead("desmarcado", "Não é mais manual", { demo: undefined });

    expect((await (await balao(await comoAdmin(), true)).json()).pendentes).toEqual([]);
  });

  it("NUNCA varre /leads: lê por id, e só das linhas que a tela mostra", async () => {
    semearPool([{ id: "a" }, { id: "b" }], {
      manuaisPendentes: [{ id: "p", motivo: "semDemo" }],
      manuaisPendentesTotal: 1,
    });
    semearLead("a", "A");
    semearLead("b", "B");
    semearLead("p", "P", { filaManual: true, demo: undefined });
    semearLead("nunca-lido", "Não aparece em lista nenhuma");
    const cookie = await comoAdmin();

    const { db: espiao, varreduras, docs } = contando(db);
    db = espiao as unknown as FakeFirestore;
    await balao(cookie, true);

    expect(varreduras().leads ?? 0).toBe(0);
    // 4 docs de estado + UMA leitura por linha mostrada. O lead que não
    // aparece em lista nenhuma não é lido.
    expect(docs()).toEqual([
      "config/fila",
      "filaContadores/2026-03-10",
      "filaCandidatos/pool",
      "config/app",
      "leads/a",
      "leads/b",
      "leads/p",
    ]);
  });

  it("a lista é uma JANELA: corta em BALAO_LINHAS, mas `elegiveis` conta todos", async () => {
    const ids = Array.from({ length: BALAO_LINHAS + 3 }, (_, i) => `l${String(i).padStart(2, "0")}`);
    semearPool(ids.map((id, i) => ({ id, criadoEm: `2026-03-10T00:0${i % 10}:00.000Z` })));
    for (const id of ids) semearLead(id, `Lead ${id}`);

    const corpo = await (await balao(await comoAdmin(), true)).json();

    expect(corpo.fila).toHaveLength(BALAO_LINHAS);
    expect(corpo.elegiveis).toBe(BALAO_LINHAS + 3);
  });

  it("os pendentes também são cortados, com o total inteiro ao lado", async () => {
    const ids = Array.from({ length: BALAO_PENDENTES + 2 }, (_, i) => `p${i}`);
    semearPool([], {
      manuaisPendentes: ids.map((id) => ({ id, motivo: "semDemo" })),
      manuaisPendentesTotal: ids.length,
    });
    for (const id of ids) semearLead(id, `Pendente ${id}`, { filaManual: true, demo: undefined });

    const corpo = await (await balao(await comoAdmin(), true)).json();

    expect(corpo.pendentes).toHaveLength(BALAO_PENDENTES);
    expect(corpo.pendentesTotal).toBe(ids.length);
  });

  it("pool NUNCA construído: poolGeradoEm null, sem varrer /leads", async () => {
    semearLead("a", "Existe na base, mas o celular nunca pediu tarefa");
    const cookie = await comoAdmin();

    const { db: espiao, varreduras } = contando(db);
    db = espiao as unknown as FakeFirestore;
    const corpo = await (await balao(cookie, true)).json();

    expect(corpo.poolGeradoEm).toBeNull();
    expect(corpo.fila).toEqual([]);
    expect(varreduras().leads ?? 0).toBe(0);
  });

  it("fila PAUSADA continua mostrando quem sairia — pausada-e-vazia é outra coisa", async () => {
    db.seed("config/fila", { ativo: false });
    semearPool([{ id: "a" }]);
    semearLead("a", "Barbearia do Zé");

    const corpo = await (await balao(await comoAdmin(), true)).json();

    expect(corpo.ritmo).toBe("pausado");
    expect(corpo.fila).toHaveLength(1);
  });

  it("o pool é cache: quem não passa mais na peneira não vira linha", async () => {
    semearPool([{ id: "a" }, { id: "descartado" }]);
    semearLead("a", "Continua valendo");
    semearLead("descartado", "Saiu da fila agora", { descartado: true });

    const { fila } = await (await balao(await comoAdmin(), true)).json();

    expect(fila.map((l: { leadId: string }) => l.leadId)).toEqual(["a"]);
  });
});

describe("DELETE /api/config/fila/balao/[leadId] — remover da fila", () => {
  it("descarta o lead e devolve o balão já relido, sem ele", async () => {
    semearPool([{ id: "a" }, { id: "b" }]);
    semearLead("a", "Sai da fila");
    semearLead("b", "Fica");

    const res = await remover("a", await comoAdmin());

    expect(res.status).toBe(200);
    expect(db.getDoc("leads/a")?.descartado).toBe(true);
    const corpo = await res.json();
    expect(corpo.fila.map((l: { leadId: string }) => l.leadId)).toEqual(["b"]);
  });

  it("é o `descartado` de sempre: nenhum campo novo, e `filaManual` fica intacto", async () => {
    semearPool([{ id: "a", manual: true }]);
    semearLead("a", "Escolhido à mão", { filaManual: true });

    await remover("a", await comoAdmin());

    // Restaurar pela ficha tem que devolver o lead como ele estava.
    expect(db.getDoc("leads/a")).toMatchObject({ descartado: true, filaManual: true });
  });

  it("CLAIM ATIVA → 409 com o motivo e a hora, e o lead NÃO é descartado", async () => {
    // Remover não cancela envio em andamento: o aparelho pode estar com o
    // WhatsApp aberto neste segundo.
    semearPool([{ id: "a" }]);
    semearLead("a", "Em envio agora");
    const expiraEm = new Date(AGORA.getTime() + 60_000).toISOString();
    db.seed("filaEnvios/a", {
      leadId: "a",
      estado: "reservado",
      claimId: "c1",
      reservadoEm: new Date(AGORA.getTime() - 60_000).toISOString(),
      expiraEm,
      dispositivo: "android",
      tentativas: 0,
      ultimoErro: null,
      enviadoEm: null,
    });

    const res = await remover("a", await comoAdmin());

    expect(res.status).toBe(409);
    const { error } = await res.json();
    expect(error.code).toBe("claim_ativa");
    expect(error.expiraEm).toBe(expiraEm);
    expect(error.message).toContain("não cancela o envio");
    expect(db.getDoc("leads/a")?.descartado).toBeUndefined();
  });

  it("claim EXPIRADA não barra: ela já não é um envio em andamento", async () => {
    semearPool([{ id: "a" }]);
    semearLead("a", "Claim morreu faz tempo");
    db.seed("filaEnvios/a", {
      leadId: "a",
      estado: "reservado",
      claimId: "c1",
      reservadoEm: new Date(AGORA.getTime() - 60 * 60_000).toISOString(),
      expiraEm: new Date(AGORA.getTime() - 55 * 60_000).toISOString(),
      dispositivo: "android",
      tentativas: 0,
      ultimoErro: null,
      enviadoEm: null,
    });

    expect((await remover("a", await comoAdmin())).status).toBe(200);
    expect(db.getDoc("leads/a")?.descartado).toBe(true);
  });

  it("claim já CONFIRMADA não barra — ela não está mais reservada", async () => {
    semearPool([{ id: "a" }]);
    semearLead("a", "Já enviado");
    db.seed("filaEnvios/a", {
      leadId: "a",
      estado: "enviado",
      claimId: "c1",
      reservadoEm: AGORA.toISOString(),
      expiraEm: new Date(AGORA.getTime() + 60_000).toISOString(),
      dispositivo: "android",
      tentativas: 0,
      ultimoErro: null,
      enviadoEm: AGORA.toISOString(),
    });

    expect((await remover("a", await comoAdmin())).status).toBe(200);
  });

  it("um PENDENTE também pode ser removido — a ação vale em toda linha", async () => {
    semearPool([], {
      manuaisPendentes: [{ id: "p", motivo: "semDemo" }],
      manuaisPendentesTotal: 1,
    });
    semearLead("p", "Falta a demo", { filaManual: true, demo: undefined });

    const corpo = await (await remover("p", await comoAdmin())).json();

    expect(db.getDoc("leads/p")?.descartado).toBe(true);
    // Descarte é DECISÃO, não ausência de peça: ele sai da lista.
    expect(corpo.pendentes).toEqual([]);
  });

  it("leadId inexistente → 404, sem plantar doc nenhum", async () => {
    const res = await remover("nao-existe", await comoAdmin());

    expect(res.status).toBe(404);
    expect(db.getDoc("leads/nao-existe")).toBeUndefined();
  });
});
