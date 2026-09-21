import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { GET } from "../config/leads-selecao/route";
import { GET as GET_UM } from "../config/leads-selecao/[leadId]/route";

/**
 * As duas rotas do SELETOR DE LEAD.
 *
 * Moram sob `/api/config/` e não sob `/api/fila/` pelo motivo de sempre:
 * aquele prefixo inteiro passa SEM sessão de usuário (é o celular com
 * Bearer `RADAR_DEVICE_KEY`, ver src/proxy.ts). E são ADMIN nos dois
 * verbos, como os painéis que as usam — a lista é o retrato da base de
 * leads inteira num corpo só.
 */

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const EM = "2026-03-10T10:00:00.000Z";

function semearLead(
  placeId: string,
  nome: string,
  extra: Record<string, unknown> = {},
): void {
  db.seed(`leads/${placeId}`, {
    placeId,
    nome,
    status: "novo",
    criadoEm: EM,
    atualizadoEm: EM,
    enriquecido: false,
    ...extra,
  });
}

const listaRequest = (cookie?: string) =>
  new Request("http://localhost/api/config/leads-selecao", {
    headers: { ...(cookie && { cookie }) },
  });

const umRequest = (leadId: string, cookie?: string) =>
  new Request(`http://localhost/api/config/leads-selecao/${leadId}`, {
    headers: { ...(cookie && { cookie }) },
  });

const params = (leadId: string) => ({ params: Promise.resolve({ leadId }) });

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/config/leads-selecao (a lista)", () => {
  it("sem sessão → 401", async () => {
    semearLead("ChIJa", "Ink House");

    const res = await GET(listaRequest());

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("membro → 403, sem vazar um nome sequer", async () => {
    semearLead("ChIJa", "Ink House");
    const cookie = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });

    const res = await GET(listaRequest(cookie));
    const corpo = await res.text();

    expect(res.status).toBe(403);
    expect(corpo).not.toContain("Ink House");
    expect(corpo).not.toContain("ChIJa");
  });

  it("admin recebe a lista ENXUTA — nome, nicho, cidade, demo, e nada mais", async () => {
    semearLead("ChIJa", "Ink House", {
      endereco: "R. da Praia, 100 - Centro, Porto Alegre - RS, 90010-150, Brasil",
      busca: { nicho: "tatuagem", regiao: "Porto Alegre RS", em: EM },
      telefone: "(51) 99999-0000",
      telefoneIntl: "5551999990000",
      demo: { skinId: "tatuagem", themeId: "noite", criadoEm: EM },
      capturas: { estado: "pronto", arquivos: { celular: "x.png" } },
    });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await GET(listaRequest(cookie));
    const { leads } = await res.json();

    expect(res.status).toBe(200);
    expect(leads).toEqual([
      {
        leadId: "ChIJa",
        nome: "Ink House",
        nicho: "tatuagem",
        cidade: "Porto Alegre - RS",
        temDemo: true,
      },
    ]);
    // O corpo NÃO carrega a demo nem o telefone: a tela escolhe um nome,
    // não abre uma ficha.
    expect(await new Response(JSON.stringify(leads)).text()).not.toContain("5551999990000");
  });

  it("o lead fixo de teste não entra na lista (exclusão na origem, em listLeads)", async () => {
    semearLead("ChIJa", "Ink House");
    semearLead("radar-lead-teste", "Barbearia Dom Aurélio", { leadDeTeste: true });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const { leads } = await (await GET(listaRequest(cookie))).json();

    expect(leads.map((l: { leadId: string }) => l.leadId)).toEqual(["ChIJa"]);
  });
});

describe("GET /api/config/leads-selecao/{leadId} (um lead, pelo id)", () => {
  it("sem sessão → 401", async () => {
    semearLead("ChIJa", "Ink House");

    const res = await GET_UM(umRequest("ChIJa"), params("ChIJa"));

    expect(res.status).toBe(401);
  });

  it("membro → 403, sem vazar o nome do lead", async () => {
    semearLead("ChIJa", "Ink House");
    const cookie = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });

    const res = await GET_UM(umRequest("ChIJa", cookie), params("ChIJa"));

    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("Ink House");
  });

  it("resolve o id gravado pelo NOME — é o que o painel mostra ao abrir", async () => {
    semearLead("ChIJa", "Ink House", {
      endereco: "R. da Praia, 100 - Centro, Porto Alegre - RS, 90010-150, Brasil",
      busca: { nicho: "tatuagem", regiao: "Porto Alegre RS", em: EM },
    });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await GET_UM(umRequest("ChIJa", cookie), params("ChIJa"));
    const { lead } = await res.json();

    expect(res.status).toBe(200);
    expect(lead).toMatchObject({ leadId: "ChIJa", nome: "Ink House", nicho: "tatuagem" });
  });

  /**
   * `getLead`, e não `listLeads`: o lead fixo de teste é excluído de toda
   * LISTAGEM, mas continua alcançável por id — é ele o padrão do disparo de
   * teste e um `leadContextoExcecao` legítimo, e o campo precisa poder
   * dizer o nome dele.
   */
  it("acha o lead fixo de teste, que a lista exclui", async () => {
    semearLead("radar-lead-teste", "Barbearia Dom Aurélio", { leadDeTeste: true });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const { lead } = await (
      await GET_UM(umRequest("radar-lead-teste", cookie), params("radar-lead-teste"))
    ).json();

    expect(lead).toMatchObject({ leadId: "radar-lead-teste", nome: "Barbearia Dom Aurélio" });
  });

  /**
   * A limpeza de leads antigos pode excluir justamente o lead escolhido
   * como contexto. Isso é estado PREVISTO da tela ("lead não encontrado",
   * escolha outro) — responder erro faria um painel inteiro quebrar por
   * causa de um campo com valor velho.
   */
  it("id que não existe mais → 200 com lead: null, nunca 404", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await GET_UM(umRequest("ChIJsumiu", cookie), params("ChIJsumiu"));

    expect(res.status).toBe(200);
    expect((await res.json()).lead).toBeNull();
  });
});
