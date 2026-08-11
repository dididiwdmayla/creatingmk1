import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { GET } from "../mundo/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

/** Quarta 09:00 UTC = 6h no Brasil, 9h em Portugal, 10h na Espanha/Itália/Suíça. */
const MADRUGADA_BR = new Date("2026-08-12T09:00:00Z");

function mundoRequest(familia?: string): Request {
  const qs = familia ? `?familia=${encodeURIComponent(familia)}` : "";
  return new Request(`http://localhost/api/mundo${qs}`);
}

function seedLead(placeId: string, overrides: Record<string, unknown> = {}): void {
  db.seed(`leads/${placeId}`, {
    placeId,
    nome: `Lead ${placeId}`,
    endereco: "Rua A, 10, 1000-001 Lisboa, Portugal",
    status: "novo",
    busca: { nicho: "barbearia", regiao: "Lisboa", em: "2026-08-01T00:00:00.000Z" },
    enriquecido: false,
    criadoEm: "2026-08-01T00:00:00.000Z",
    atualizadoEm: "2026-08-01T00:00:00.000Z",
    ...overrides,
  });
}

beforeEach(() => {
  db = new FakeFirestore();
  vi.useFakeTimers();
  vi.setSystemTime(MADRUGADA_BR);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/mundo", () => {
  it("lista só os países em faixa boa agora, na ordem da tela", async () => {
    const res = await GET(mundoRequest("barbearia"));
    const body = await res.json();

    expect(res.status).toBe(200);
    // 9h em Portugal e 10h na Espanha/Itália/Suíça, tudo dentro da faixa
    // 9h–11h30 da barbearia. As Américas ainda estão de madrugada.
    // Ordem: português primeiro, depois espanhol, depois o resto por índice.
    expect(body.paises.map((p: { codigo: string }) => p.codigo)).toEqual([
      "PT",
      "ES",
      "CH",
      "IT",
    ]);
    expect(body.paises[0]).toMatchObject({
      nome: "Portugal",
      horaLocal: "9h",
      idiomas: ["pt-PT"],
      faixa: { inicioMin: 540, fimMin: 690 },
      indice: { fonte: "config", cidades: 0 },
    });
  });

  it("anexa os leads NÃO contatados daquele país e família", async () => {
    seedLead("pt-1");
    seedLead("pt-2", { status: "contactado" });
    seedLead("pt-3", { seloContato: { userId: "ana", em: "2026-08-02T00:00:00.000Z" } });
    seedLead("es-1", { endereco: "Calle Mayor, 3, 28013 Madrid, Espanha" });

    const body = await (await GET(mundoRequest("barbearia"))).json();
    const portugal = body.paises.find((p: { codigo: string }) => p.codigo === "PT");
    const espanha = body.paises.find((p: { codigo: string }) => p.codigo === "ES");

    expect(portugal.totalLeads).toBe(1);
    expect(portugal.leads).toEqual([
      {
        placeId: "pt-1",
        nome: "Lead pt-1",
        endereco: "Rua A, 10, 1000-001 Lisboa, Portugal",
      },
    ]);
    expect(espanha.totalLeads).toBe(1);
  });

  it("o índice de /regioes vence o base da config, sem gerar nada", async () => {
    db.seed("regioes/lisboa", {
      slug: "lisboa",
      cidade: "Lisboa",
      pais: "Portugal",
      regiaoTexto: "Lisboa",
      indice: 2.4,
      moedaLocal: "EUR",
      faixaMercadoLocal: "800–1.500 €",
      justificativa: "—",
      confianca: "alta",
      geradoEm: "2026-07-01T00:00:00.000Z",
    });

    const body = await (await GET(mundoRequest("barbearia"))).json();
    const portugal = body.paises.find((p: { codigo: string }) => p.codigo === "PT");

    expect(portugal.indice).toEqual({ indice: 2.4, fonte: "regioes", cidades: 1 });
    // A tela não escreve em /regioes nem cria doc nenhum.
    expect(db.getDoc("regioes/lisboa")).toMatchObject({ indice: 2.4 });
  });

  it("respeita a tabela de faixas editada em /config", async () => {
    db.seed("config/app", {
      janelasContato: {
        barbearia: {
          dias: {
            3: [{ inicio: { hora: 6, minuto: 0 }, fim: { hora: 7, minuto: 0 }, nivel: "bom" }],
          },
        },
      },
    });

    const body = await (await GET(mundoRequest("barbearia"))).json();

    // Faixa das 6h: quem está nela agora é o fuso -3 (Brasil, Uruguai,
    // Argentina). A Europa, que a tabela padrão trazia, sai da tela.
    expect(body.paises.map((p: { codigo: string }) => p.codigo)).toEqual(["BR", "UY", "AR"]);
  });

  it("ninguém em faixa boa: lista vazia + o próximo país a abrir", async () => {
    vi.setSystemTime(new Date("2026-08-12T05:00:00Z")); // 2h no Brasil, 6h na Espanha

    const body = await (await GET(mundoRequest("barbearia"))).json();

    expect(body.paises).toEqual([]);
    // A Espanha (6h locais) é quem chega antes na faixa das 9h.
    expect(body.emBreve).toMatchObject({
      codigo: "ES",
      rotuloDia: "hoje",
      inicioMin: 540,
      emMinutos: 180,
    });
  });

  it("família ausente ou desconhecida cai na primeira da lista, sem quebrar", async () => {
    const semQuery = await (await GET(mundoRequest())).json();
    const inexistente = await (await GET(mundoRequest("floricultura"))).json();

    expect(semQuery.familia).toBe("barbearia");
    expect(inexistente.familia).toBe("barbearia");
    // O genérico é sempre o último do seletor.
    expect(semQuery.familias.at(-1).id).toBe("generico");
    expect(semQuery.familias[0]).toEqual({ id: "barbearia", rotulo: "Barbearia" });
  });
});
