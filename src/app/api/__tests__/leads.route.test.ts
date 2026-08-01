import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET as LIST } from "../leads/route";
import { GET as GET_ONE, PATCH } from "../leads/[id]/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

afterEach(() => {
  vi.unstubAllEnvs();
});

function seedLead(id: string, data: Record<string, unknown>): void {
  db.seed(`leads/${id}`, {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...data,
  });
}

beforeEach(() => {
  db = new FakeFirestore();
  seedLead("A", { criadoEm: "2026-07-01T10:00:00.000Z" });
  seedLead("B", {
    status: "contactado",
    enriquecido: true,
    criadoEm: "2026-07-02T10:00:00.000Z",
    detalhes: {
      site: "https://b.com",
      telefone: "(44) 1111-1111",
      enriquecidoEm: "2026-07-02T11:00:00.000Z",
    },
    contato: { primeiroContatoEm: "2026-07-02T12:00:00.000Z" },
  });
  seedLead("C", {
    enriquecido: true,
    criadoEm: "2026-07-03T10:00:00.000Z",
    detalhes: {
      telefone: "(44) 2222-2222",
      enriquecidoEm: "2026-07-03T11:00:00.000Z",
    },
  });
});

function list(query = ""): Promise<Response> {
  return LIST(new Request(`http://localhost/api/leads${query}`));
}

async function leadIds(res: Response): Promise<string[]> {
  const { leads } = await res.json();
  return (leads as Array<{ placeId: string }>).map((l) => l.placeId);
}

describe("GET /api/leads", () => {
  it("lista todos, mais recentes primeiro", async () => {
    const res = await list();

    expect(res.status).toBe(200);
    expect(await leadIds(res)).toEqual(["C", "B", "A"]);
  });

  it("filtra por status", async () => {
    expect(await leadIds(await list("?status=novo"))).toEqual(["C", "A"]);
    expect(await leadIds(await list("?status=contactado"))).toEqual(["B"]);
  });

  it("temSite=sem só considera leads enriquecidos (lead quente)", async () => {
    expect(await leadIds(await list("?temSite=sem"))).toEqual(["C"]);
  });

  it("temSite=com", async () => {
    expect(await leadIds(await list("?temSite=com"))).toEqual(["B"]);
  });

  it("combina filtros", async () => {
    expect(
      await leadIds(await list("?status=novo&temTelefone=com")),
    ).toEqual(["C"]);
  });

  it("status inválido → 400", async () => {
    const res = await list("?status=perdido");

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
  });

  it("temSite inválido → 400", async () => {
    expect((await list("?temSite=sim")).status).toBe(400);
  });

  it("filtra por buscaId (match no array)", async () => {
    seedLead("D", {
      criadoEm: "2026-07-04T10:00:00.000Z",
      buscaId: ["busca-1", "busca-2"],
    });
    seedLead("E", {
      criadoEm: "2026-07-05T10:00:00.000Z",
      buscaId: ["busca-2"],
    });

    expect(await leadIds(await list("?buscaId=busca-1"))).toEqual(["D"]);
    expect(await leadIds(await list("?buscaId=busca-2"))).toEqual(["E", "D"]);
    expect(await leadIds(await list("?buscaId=inexistente"))).toEqual([]);
  });

  it("buscaId combina com os outros filtros", async () => {
    seedLead("F", {
      status: "contactado",
      criadoEm: "2026-07-06T10:00:00.000Z",
      buscaId: ["busca-3"],
    });
    seedLead("G", {
      criadoEm: "2026-07-07T10:00:00.000Z",
      buscaId: ["busca-3"],
    });

    expect(
      await leadIds(await list("?buscaId=busca-3&status=contactado")),
    ).toEqual(["F"]);
  });

  it("filtro favorito=1 → só favoritos", async () => {
    seedLead("H", { criadoEm: "2026-07-08T10:00:00.000Z", favorito: true });

    expect(await leadIds(await list("?favorito=1"))).toEqual(["H"]);
  });

  it("temSite da busca qualificada vale no filtro mesmo sem enriquecer", async () => {
    seedLead("Q1", { criadoEm: "2026-07-09T10:00:00.000Z", temSite: false });
    seedLead("Q2", {
      criadoEm: "2026-07-10T10:00:00.000Z",
      temSite: true,
      siteUrl: "https://q2.com.br",
    });

    expect(await leadIds(await list("?temSite=sem"))).toEqual(["Q1", "C"]);
    expect(await leadIds(await list("?temSite=com"))).toEqual(["Q2", "B"]);
  });

  it("temTelefone da busca qualificada vale no filtro mesmo sem enriquecer", async () => {
    seedLead("T1", {
      criadoEm: "2026-07-09T10:00:00.000Z",
      temTelefone: true,
      telefone: "(44) 3333-3333",
      telefoneIntl: "+55 44 3333-3333",
    });
    seedLead("T2", { criadoEm: "2026-07-10T10:00:00.000Z", temTelefone: false });

    expect(await leadIds(await list("?temTelefone=com"))).toEqual(["T1", "C", "B"]);
    expect(await leadIds(await list("?temTelefone=sem"))).toEqual(["T2"]);
  });

  it("migração: doc antigo sem siteProprio deriva na leitura (siteUrl de rede social → false)", async () => {
    seedLead("IG", {
      criadoEm: "2026-07-11T10:00:00.000Z",
      temSite: true,
      siteUrl: "https://www.instagram.com/negocio",
    });

    expect(await leadIds(await list("?temSite=sem"))).toContain("IG");
    expect(await leadIds(await list("?temSite=com"))).not.toContain("IG");

    const { leads } = await (await list()).json();
    const ig = (leads as Array<{ placeId: string; siteProprio?: boolean }>).find(
      (l) => l.placeId === "IG",
    );
    expect(ig?.siteProprio).toBe(false);
  });

  it("siteProprio persistido manda no filtro (rede social entra em 'sem')", async () => {
    seedLead("SP", {
      criadoEm: "2026-07-13T10:00:00.000Z",
      temSite: true,
      siteUrl: "https://wa.me/5544999990000",
      siteProprio: false,
    });
    seedLead("OK", {
      criadoEm: "2026-07-14T10:00:00.000Z",
      temSite: true,
      siteUrl: "https://ok.com.br",
      siteProprio: true,
    });

    expect(await leadIds(await list("?temSite=sem"))).toContain("SP");
    expect(await leadIds(await list("?temSite=sem"))).not.toContain("OK");
    expect(await leadIds(await list("?temSite=com"))).toContain("OK");
  });

  it("site de rede social no enriquecimento também conta como SEM site próprio", async () => {
    seedLead("SN", {
      criadoEm: "2026-07-12T10:00:00.000Z",
      enriquecido: true,
      detalhes: {
        site: "https://linktr.ee/negocio",
        enriquecidoEm: "2026-07-12T11:00:00.000Z",
      },
    });

    expect(await leadIds(await list("?temSite=sem"))).toContain("SN");
  });

  it("descartados vão pro fim da lista, mas continuam aparecendo", async () => {
    seedLead("D1", { criadoEm: "2026-07-20T10:00:00.000Z", descartado: true });

    // D1 é o mais recente, mas descartado → fim da lista.
    expect(await leadIds(await list())).toEqual(["C", "B", "A", "D1"]);
  });
});

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(
  id: string,
  body: unknown,
  cookie?: string,
): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/leads/${id}`, {
      method: "PATCH",
      ...(cookie && { headers: { cookie } }),
      body: JSON.stringify(body),
    }),
    params(id),
  ];
}

describe("GET /api/leads/[id]", () => {
  it("retorna a ficha do lead", async () => {
    const res = await GET_ONE(new Request("http://localhost/api/leads/B"), params("B"));

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.placeId).toBe("B");
    expect(lead.detalhes.site).toBe("https://b.com");
  });

  it("lead inexistente → 404 not_found", async () => {
    const res = await GET_ONE(new Request("http://localhost/api/leads/X"), params("X"));

    expect(res.status).toBe(404);
    const { error } = await res.json();
    expect(error.code).toBe("not_found");
  });

  it("self-heal: demo sem token de envio ganha um antes de responder", async () => {
    db.seed("leads/D", {
      placeId: "D",
      nome: "Demo sem token",
      status: "novo",
      enriquecido: false,
      demo: {
        skinId: "s",
        themeId: "t",
        dados: {},
        criadoEm: "2026-07-01T00:00:00.000Z",
        atualizadoEm: "2026-07-01T00:00:00.000Z",
      },
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const res = await GET_ONE(new Request("http://localhost/api/leads/D"), params("D"));

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    // Um token vigente por canal (link + whatsapp).
    expect(lead.demo.envios).toHaveLength(2);
    expect(lead.demo.envios.map((e: { canal: string }) => e.canal).sort()).toEqual([
      "link",
      "whatsapp",
    ]);
    expect(lead.demo.envios.every((e: { token: string }) => e.token)).toBe(true);
    expect((db.getDoc("leads/D")?.demo as { envios?: unknown[] } | undefined)?.envios).toHaveLength(
      2,
    );
  });
});

describe("PATCH /api/leads/[id]", () => {
  it("novo → contactado carimba contato.primeiroContatoEm", async () => {
    const res = await PATCH(...patchRequest("A", { status: "contactado" }));

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.status).toBe("contactado");
    expect(lead.contato.primeiroContatoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(db.getDoc("leads/A")).toMatchObject({ status: "contactado" });
  });

  it("com sessão, contactado registra também QUEM contactou (primeiroContatoPor)", async () => {
    vi.stubEnv("APP_PASSWORD", "segredo123");
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });

    const res = await PATCH(...patchRequest("A", { status: "contactado" }, cookie));

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.contato.primeiroContatoPor).toBe("ana");
  });

  it("cadeia completa carimba respondeuEm e fechadoEm", async () => {
    await PATCH(...patchRequest("A", { status: "contactado" }));
    await PATCH(...patchRequest("A", { status: "respondeu" }));
    const res = await PATCH(...patchRequest("A", { status: "fechado" }));

    const { lead } = await res.json();
    expect(lead.contato.primeiroContatoEm).toBeDefined();
    expect(lead.contato.respondeuEm).toBeDefined();
    expect(lead.contato.fechadoEm).toBeDefined();
  });

  it("contactado → fechado direto é válido (não respondeu)", async () => {
    const res = await PATCH(...patchRequest("B", { status: "fechado" }));

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.contato.respondeuEm).toBeUndefined();
    expect(lead.contato.fechadoEm).toBeDefined();
  });

  it("pular etapa (novo → respondeu) → 409 invalid_transition", async () => {
    const res = await PATCH(...patchRequest("A", { status: "respondeu" }));

    expect(res.status).toBe(409);
    const { error } = await res.json();
    expect(error).toMatchObject({
      code: "invalid_transition",
      de: "novo",
      para: "respondeu",
    });
    expect(db.getDoc("leads/A")).toMatchObject({ status: "novo" });
  });

  it("voltar status (contactado → novo)? não existe: status fora do enum de destino → 409", async () => {
    const res = await PATCH(...patchRequest("B", { status: "novo" }));

    expect(res.status).toBe(409);
  });

  it("status desconhecido → 400", async () => {
    const res = await PATCH(...patchRequest("A", { status: "perdido" }));

    expect(res.status).toBe(400);
  });

  it("lead inexistente → 404", async () => {
    const res = await PATCH(...patchRequest("X", { status: "contactado" }));

    expect(res.status).toBe(404);
  });

  it("não sobrescreve primeiroContatoEm em novo contato após fechar/reabrir ciclo", async () => {
    await PATCH(...patchRequest("A", { status: "contactado" }));
    const first = (db.getDoc("leads/A")?.contato as Record<string, string>)
      .primeiroContatoEm;

    await PATCH(...patchRequest("A", { status: "respondeu" }));

    const after = (db.getDoc("leads/A")?.contato as Record<string, string>)
      .primeiroContatoEm;
    expect(after).toBe(first);
  });

  it("edita notas e favorito sem mexer no status", async () => {
    const res = await PATCH(
      ...patchRequest("A", { notas: "ligar depois das 18h", favorito: true }),
    );

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.notas).toBe("ligar depois das 18h");
    expect(lead.favorito).toBe(true);
    expect(lead.status).toBe("novo");

    expect(db.getDoc("leads/A")).toMatchObject({
      notas: "ligar depois das 18h",
      favorito: true,
      status: "novo",
    });
  });

  it("status + notas no mesmo PATCH: transição e nota aplicadas", async () => {
    const res = await PATCH(
      ...patchRequest("A", { status: "contactado", notas: "mandei wpp" }),
    );

    const { lead } = await res.json();
    expect(lead.status).toBe("contactado");
    expect(lead.notas).toBe("mandei wpp");
    expect(lead.contato.primeiroContatoEm).toBeDefined();
  });

  it("corpo vazio → 400 (informe status, notas ou favorito)", async () => {
    const res = await PATCH(...patchRequest("A", {}));

    expect(res.status).toBe(400);
  });

  it("notas longa demais (>500) → 400", async () => {
    const res = await PATCH(...patchRequest("A", { notas: "x".repeat(501) }));

    expect(res.status).toBe(400);
  });

  it("favorito não-booleano → 400", async () => {
    const res = await PATCH(...patchRequest("A", { favorito: "sim" }));

    expect(res.status).toBe(400);
  });

  it("descarta e restaura o lead sem apagar nada (descarte suave)", async () => {
    const res = await PATCH(...patchRequest("A", { descartado: true }));

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.descartado).toBe(true);
    expect(lead.status).toBe("novo");
    expect(db.getDoc("leads/A")).toMatchObject({ descartado: true, nome: "Lead A" });

    const volta = await PATCH(...patchRequest("A", { descartado: false }));
    expect(((await volta.json()) as { lead: { descartado: boolean } }).lead.descartado).toBe(
      false,
    );
  });

  it("descartado não-booleano → 400", async () => {
    const res = await PATCH(...patchRequest("A", { descartado: "sim" }));

    expect(res.status).toBe(400);
  });

  it("transição inválida no PATCH combinado não aplica as notas", async () => {
    const res = await PATCH(
      ...patchRequest("A", { status: "respondeu", notas: "não deve salvar" }),
    );

    expect(res.status).toBe(409);
    expect(db.getDoc("leads/A")).not.toMatchObject({ notas: "não deve salvar" });
  });
});

describe("PATCH /api/leads/[id] — fechadoPor (item 'Vendedor no fechamento')", () => {
  it("fechar sem sessão não carimba fechadoPor (default é 'quem fechou', mas sem sessão não há quem)", async () => {
    const res = await PATCH(...patchRequest("B", { status: "fechado" }));

    const { lead } = await res.json();
    expect(lead.contato.fechadoPor).toBeUndefined();
  });

  it("fechar com sessão carimba fechadoPor = quem fechou (default)", async () => {
    vi.stubEnv("APP_PASSWORD", "segredo123");
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });

    const res = await PATCH(...patchRequest("B", { status: "fechado" }, cookie));

    const { lead } = await res.json();
    expect(lead.contato.fechadoPor).toBe("ana");
  });

  it("admin ajusta o vendedor de um lead já fechado (vendidoPor)", async () => {
    vi.stubEnv("APP_PASSWORD", "segredo123");
    const cookieAna = await cookieDeSessao(db, { id: "ana", papel: "membro" });
    await PATCH(...patchRequest("B", { status: "fechado" }, cookieAna));
    db.seed("usuarios/beto", {
      id: "beto",
      nome: "Beto",
      papel: "membro",
      ativo: true,
      sessao: 0,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const cookieAdmin = await cookieDeSessao(db, { id: "admin", papel: "admin", secret: "segredo123" });
    const res = await PATCH(...patchRequest("B", { vendidoPor: "beto" }, cookieAdmin));

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.contato.fechadoPor).toBe("beto");
  });

  it("membro não pode ajustar vendidoPor → 403", async () => {
    vi.stubEnv("APP_PASSWORD", "segredo123");
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });
    await PATCH(...patchRequest("B", { status: "fechado" }, cookie));

    const res = await PATCH(...patchRequest("B", { vendidoPor: "ana" }, cookie));

    expect(res.status).toBe(403);
  });

  it("vendidoPor em lead não fechado → 400", async () => {
    vi.stubEnv("APP_PASSWORD", "segredo123");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PATCH(...patchRequest("A", { vendidoPor: "ana" }, cookie));

    expect(res.status).toBe(400);
  });

  it("vendidoPor apontando pra usuário inexistente → 400", async () => {
    vi.stubEnv("APP_PASSWORD", "segredo123");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    await PATCH(...patchRequest("B", { status: "fechado" }, cookie));

    const res = await PATCH(...patchRequest("B", { vendidoPor: "fantasma" }, cookie));

    expect(res.status).toBe(400);
  });
});
