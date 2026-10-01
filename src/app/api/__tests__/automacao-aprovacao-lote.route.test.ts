import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { leadsParaDemo } from "@/lib/automacao/elegivel";
import { FILA_CANDIDATOS_COLLECTION, FILA_CANDIDATOS_DOC, candidatoEstavel, motivoEstrutural } from "@/lib/fila/candidatos";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST as APROVACAO } from "../config/automacao/aprovacao/route";
import { POST as CONFIRMAR } from "../fila/confirmar/route";
import { GET as PROXIMO } from "../fila/proximo/route";

/**
 * Sem corte do legado (`""`): este arquivo testa OUTRAS regras, e os leads
 * dele são de março — antes do corte padrão. O corte tem testes próprios
 * (`fila-legado.route.test.ts`).
 */
const SEM_CORTE = "";

/**
 * A fila de aprovação do painel "Automação": aprovar/reprovar um ou vários
 * pela rota de config, e o efeito disso onde importa — a fila de envio e o
 * planejador da automação. E o contrato do celular (`/proximo`,
 * `/confirmar`) travado de ponta a ponta, com o pool que agora também
 * apura o estoque.
 */

let db: FakeFirestore;
vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const CHAVE = "chave-do-celular";
/** Terça, 10h no fuso do lead (offset 0) — a hora "tudo certo" dos testes da fila. */
const TERCA_10H = new Date("2026-03-10T10:00:00Z");

/** O contrato achatado de `/proximo` — as MESMAS chaves de `fila-proximo.route.test.ts`. */
const CHAVES_PROXIMO = [
  "temTarefa",
  "tipo",
  "teste",
  "id",
  "leadId",
  "nome",
  "numero",
  "texto",
  "printUrl",
  "expiraEm",
  "motivo",
].sort();
/** E o de `/confirmar` — as seis de `fila-confirmar.route.test.ts`. */
const CHAVES_CONFIRMAR = ["ok", "teste", "estado", "repetida", "tentativas", "parado"].sort();

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
    demo: {
      skinId: "barbearia-editorial",
      themeId: "creme",
      dados: {},
      criadoEm: "2026-03-09T06:40:00.000Z",
      atualizadoEm: "2026-03-09T06:40:00.000Z",
      origem: "automacao",
      aprovacao: "pendente",
    },
    horarios: { faixas: [], utcOffsetMinutes: 0, obtidoEm: "2026-03-01T00:00:00.000Z" },
    capturas: {
      estado: "pronto",
      execucaoId: "e1",
      pedidoEm: "2026-03-09T07:00:00.000Z",
      imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "https://s/hero.png", largura: 1, altura: 1 }],
    },
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
    ...overrides,
  } as Lead;
}

function semear(...leads: Lead[]) {
  for (const l of leads) db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
}

const ler = (id: string) => db.getDoc(`leads/${id}`) as unknown as Lead;

function decidir(cookie: string | undefined, corpo: unknown, extra: Record<string, string> = {}) {
  return APROVACAO(
    new Request("http://localhost/api/config/automacao/aprovacao", {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie && { cookie }), ...extra },
      body: JSON.stringify(corpo),
    }),
  );
}

function proximo() {
  return PROXIMO(
    new Request("http://localhost/api/fila/proximo", { headers: { authorization: `Bearer ${CHAVE}` } }),
  );
}

function confirmar(corpo: unknown) {
  return CONFIRMAR(
    new Request("http://localhost/api/fila/confirmar", {
      method: "POST",
      headers: { authorization: `Bearer ${CHAVE}`, "content-type": "application/json" },
      body: JSON.stringify(corpo),
    }),
  );
}

function esquecerPool() {
  db.deleteDoc(`${FILA_CANDIDATOS_COLLECTION}/${FILA_CANDIDATOS_DOC}`);
}

let admin: string;

beforeEach(async () => {
  db = new FakeFirestore();
  // Os leads deste arquivo são de março; o corte do legado tem testes
  // próprios (fila-legado.route.test.ts) — aqui ele fica antes deles.
  db.seed("config/automacao", { corteLegado: "2000-01-01" });
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.stubEnv("RADAR_DEVICE_KEY", CHAVE);
  vi.stubEnv("RADAR_DEVICE_USER_ID", "admin");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TERCA_10H);
  admin = await cookieDeSessao(db, { id: "admin", papel: "admin" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("aprovar", () => {
  it("torna a demo elegível na fila (captura pronta) — e /proximo a entrega, contrato intacto", async () => {
    semear(lead("ChIJa"));
    // Pendente: o portão segura.
    expect(motivoEstrutural(ler("ChIJa"), SEM_CORTE)).toBe("aguardandoAprovacao");
    const antes = await (await proximo()).json();
    expect(antes.temTarefa).toBe(false);
    expect(Object.keys(antes).sort()).toEqual(CHAVES_PROXIMO);

    const res = await decidir(admin, { leadIds: ["ChIJa"], aprovacao: "aprovada" });
    expect(res.status).toBe(200);
    expect((await res.json()).resultados).toEqual([{ leadId: "ChIJa", ok: true }]);
    expect(ler("ChIJa").demo).toMatchObject({ aprovacao: "aprovada", aprovacaoPor: "admin" });
    expect(candidatoEstavel(ler("ChIJa"), undefined, { corteLegado: SEM_CORTE, now: TERCA_10H })).toBe(true);

    esquecerPool(); // o pool é cache de 10 min; o próximo rebuild já o vê
    const tarefa = await (await proximo()).json();
    expect(Object.keys(tarefa).sort()).toEqual(CHAVES_PROXIMO);
    expect(tarefa).toMatchObject({ temTarefa: true, leadId: "ChIJa", printUrl: "https://s/hero.png" });

    const confirmado = await (await confirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "enviado" })).json();
    expect(Object.keys(confirmado).sort()).toEqual(CHAVES_CONFIRMAR);
    expect(confirmado.ok).toBe(true);
  });

  it("com a captura ainda gerando é permitido — e o lead só entra na fila quando o print ficar pronto", async () => {
    semear(lead("ChIJg", { capturas: { estado: "rodando", execucaoId: "e2", pedidoEm: "2026-03-10T09:55:00.000Z" } }));
    const res = await decidir(admin, { leadIds: ["ChIJg"], aprovacao: "aprovada" });
    expect((await res.json()).resultados[0].ok).toBe(true);
    expect(motivoEstrutural(ler("ChIJg"), SEM_CORTE)).toBe("capturaNaoPronta");
    expect((await (await proximo()).json()).temTarefa).toBe(false);

    // O workflow de capturas termina: nada mais precisa acontecer.
    semear({ ...ler("ChIJg"), capturas: lead("x").capturas });
    esquecerPool();
    expect((await (await proximo()).json()).leadId).toBe("ChIJg");
  });
});

describe("reprovar", () => {
  it("tira o lead da automação — mesmo sem a demo, o planejador não o escolhe de novo", async () => {
    semear(lead("ChIJr", { criadoEm: "2026-09-01T00:00:00.000Z" }));
    const res = await decidir(admin, { leadIds: ["ChIJr"], aprovacao: "reprovada" });
    expect((await res.json()).resultados[0].ok).toBe(true);

    const reprovado = ler("ChIJr");
    expect(reprovado.demo?.aprovacao).toBe("reprovada");
    expect(reprovado.automacaoReprovada).toMatchObject({ por: "admin" });
    // Fora da fila…
    expect(candidatoEstavel(reprovado, undefined, { corteLegado: SEM_CORTE, now: TERCA_10H })).toBe(false);
    // …e fora da automação, mesmo que alguém apague a demo depois.
    const semDemo = { ...reprovado, demo: undefined };
    const controle = lead("ChIJc", { demo: undefined, criadoEm: "2026-09-01T00:00:00.000Z" });
    expect(leadsParaDemo([semDemo, controle], new Set(), "2026-08-10", 10).map((l) => l.placeId)).toEqual([
      "ChIJc",
    ]);
  });
});

describe("em lote", () => {
  it("vários de uma vez; demo manual ou lead inexistente no meio falham sozinhos", async () => {
    semear(
      lead("ChIJ1"),
      lead("ChIJ2"),
      lead("ChIJm", { demo: { ...lead("x").demo!, origem: undefined, aprovacao: undefined } }),
      lead("ChIJ3"),
    );
    const res = await decidir(admin, {
      leadIds: ["ChIJ1", "ChIJm", "ChIJ2", "sumiu", "ChIJ3", "ChIJ1"],
      aprovacao: "aprovada",
    });
    expect(res.status).toBe(200);
    const { resultados } = await res.json();
    // Duplicado conta uma vez.
    expect(resultados.map((r: { leadId: string }) => r.leadId)).toEqual(["ChIJ1", "ChIJm", "ChIJ2", "sumiu", "ChIJ3"]);
    expect(resultados.filter((r: { ok: boolean }) => r.ok).map((r: { leadId: string }) => r.leadId)).toEqual([
      "ChIJ1",
      "ChIJ2",
      "ChIJ3",
    ]);
    expect(resultados.find((r: { leadId: string }) => r.leadId === "ChIJm").erro).toMatch(/automação/);
    for (const id of ["ChIJ1", "ChIJ2", "ChIJ3"]) expect(ler(id).demo?.aprovacao).toBe("aprovada");
    expect(ler("ChIJm").demo?.aprovacao).toBeUndefined();
  });

  it("reprovação em lote marca todos os leads", async () => {
    semear(lead("ChIJ1"), lead("ChIJ2"));
    await decidir(admin, { leadIds: ["ChIJ1", "ChIJ2"], aprovacao: "reprovada" });
    expect(ler("ChIJ1").automacaoReprovada).toBeDefined();
    expect(ler("ChIJ2").automacaoReprovada).toBeDefined();
  });

  it("corpo inválido é 400: lista vazia, acima do teto, decisão desconhecida", async () => {
    semear(lead("ChIJ1"));
    for (const corpo of [
      { leadIds: [], aprovacao: "aprovada" },
      { leadIds: Array.from({ length: 51 }, (_, i) => `id${i}`), aprovacao: "aprovada" },
      { leadIds: ["ChIJ1"], aprovacao: "pendente" },
      { leadIds: "ChIJ1", aprovacao: "aprovada" },
    ]) {
      expect((await decidir(admin, corpo)).status).toBe(400);
    }
    expect(ler("ChIJ1").demo?.aprovacao).toBe("pendente");
  });
});

describe("permissão", () => {
  it("membro → 403, sem sessão → 401, o segredo do laço não abre — e nada é gravado", async () => {
    vi.stubEnv("AUTOMACAO_SECRET", "segredo-do-laco");
    semear(lead("ChIJ1"));
    const membro = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    const corpo = { leadIds: ["ChIJ1"], aprovacao: "aprovada" };
    expect((await decidir(membro, corpo)).status).toBe(403);
    expect((await decidir(undefined, corpo)).status).toBe(401);
    expect((await decidir(undefined, corpo, { authorization: "Bearer segredo-do-laco" })).status).toBe(401);
    expect(ler("ChIJ1").demo?.aprovacao).toBe("pendente");
  });
});
