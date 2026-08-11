import { describe, expect, it } from "vitest";

import { DEFAULT_JANELAS_CONTATO, type JanelasContatoConfig } from "@/lib/leads/janelaContato";
import type { Lead } from "@/lib/leads/types";
import type { RegiaoIndice } from "@/lib/regioes";

import {
  faixaBoaAgora,
  indiceDoPais,
  leadsDoPais,
  montarMundo,
  naoContatado,
  ordenarPaises,
  proximaFaixaBoa,
  rankIdioma,
  type PaisAgora,
} from "../mundo";
import type { PaisProspeccao } from "../paises";

/** Quarta-feira, 12:00 UTC — dia útil, longe da virada em qualquer fuso testado. */
const QUARTA_12H_UTC = new Date("2026-08-12T12:00:00Z");

const BRASIL: PaisProspeccao = {
  codigo: "BR",
  nome: "Brasil",
  utcOffsetMinutos: -180,
  idiomas: ["pt-BR"],
  indice: 1,
};
const PORTUGAL: PaisProspeccao = {
  codigo: "PT",
  nome: "Portugal",
  utcOffsetMinutos: 0,
  idiomas: ["pt-PT"],
  indice: 1.6,
};
const ESPANHA: PaisProspeccao = {
  codigo: "ES",
  nome: "Espanha",
  utcOffsetMinutos: 60,
  idiomas: ["es-ES"],
  indice: 1.9,
};
const SUICA: PaisProspeccao = {
  codigo: "CH",
  nome: "Suíça",
  utcOffsetMinutos: 60,
  idiomas: ["de-CH", "fr-CH", "it-CH"],
  indice: 3.5,
};

function lead(placeId: string, extra: Partial<Lead> = {}): Lead {
  return {
    placeId,
    nome: placeId,
    endereco: "Rua A, 10, 1000-001 Lisboa, Portugal",
    status: "novo",
    busca: { nicho: "barbearia", regiao: "Lisboa", em: "2026-08-01T10:00:00Z" },
    enriquecido: false,
    criadoEm: "2026-08-01T10:00:00Z",
    atualizadoEm: "2026-08-01T10:00:00Z",
    ...extra,
  };
}

function regiao(cidade: string, pais: string, indice: number, indiceAjustado?: number): RegiaoIndice {
  return {
    slug: cidade.toLowerCase(),
    regiaoTexto: cidade,
    cidade,
    pais,
    indice,
    ...(indiceAjustado !== undefined && { indiceAjustado }),
    moedaLocal: "EUR",
    faixaMercadoLocal: "800–1.500 €",
    justificativa: "—",
    confianca: "media",
    geradoEm: "2026-07-01T10:00:00Z",
  };
}

describe("faixaBoaAgora", () => {
  const barbearia = DEFAULT_JANELAS_CONTATO.barbearia;

  it("acha a faixa bom que cobre o minuto local do país", () => {
    // 12:00 UTC = 13h em Portugal? Não: Portugal fica em UTC+0 na tabela,
    // então 12h local — fora da faixa 9h–11h30 da barbearia.
    expect(faixaBoaAgora(barbearia, 0, QUARTA_12H_UTC).faixa).toBeUndefined();
    // Brasil (UTC-3) está às 9h — dentro da faixa boa.
    expect(faixaBoaAgora(barbearia, -180, QUARTA_12H_UTC)).toEqual({
      diaSemana: 3,
      minutoLocal: 9 * 60,
      faixa: { inicioMin: 9 * 60, fimMin: 11 * 60 + 30 },
    });
  });

  it("minuto neutro (razoável) não é faixa boa — o país não aparece", () => {
    // 13h no Brasil: aberto e sem opinião nenhuma na tabela = razoável.
    const meioDia = new Date("2026-08-12T16:00:00Z");
    expect(faixaBoaAgora(barbearia, -180, meioDia).faixa).toBeUndefined();
  });

  it("faixa ruim também não conta como boa", () => {
    // 17h no Brasil: faixa 16h30–20h marcada como ruim.
    const fimDeTarde = new Date("2026-08-12T20:00:00Z");
    const resultado = faixaBoaAgora(barbearia, -180, fimDeTarde);
    expect(resultado.minutoLocal).toBe(17 * 60);
    expect(resultado.faixa).toBeUndefined();
  });

  it("sexta rebaixa o bom para razoável — nenhum país de barbearia na sexta", () => {
    const sexta9h = new Date("2026-08-14T12:00:00Z");
    expect(faixaBoaAgora(barbearia, -180, sexta9h).faixa).toBeUndefined();
  });
});

describe("proximaFaixaBoa", () => {
  const barbearia = DEFAULT_JANELAS_CONTATO.barbearia;

  it("aponta a faixa de hoje quando ela ainda não começou", () => {
    // 6h no Brasil, quarta — a faixa das 9h ainda vem.
    const madrugada = new Date("2026-08-12T09:00:00Z");
    expect(proximaFaixaBoa(barbearia, -180, madrugada)).toEqual({
      offsetDias: 0,
      rotuloDia: "hoje",
      inicioMin: 9 * 60,
      fimMin: 11 * 60 + 30,
    });
  });

  it("pula sexta/sábado/domingo até a segunda seguinte", () => {
    // Sexta 12h no Brasil: sexta é razoável, fim de semana desmarcado.
    const sexta = new Date("2026-08-14T15:00:00Z");
    const proxima = proximaFaixaBoa(barbearia, -180, sexta);
    expect(proxima?.rotuloDia).toBe("segunda");
    expect(proxima?.inicioMin).toBe(9 * 60);
  });
});

describe("rankIdioma / ordenarPaises", () => {
  it("português, inglês, espanhol, depois os demais", () => {
    expect(rankIdioma(["pt-PT"])).toBe(0);
    expect(rankIdioma(["en-US"])).toBe(1);
    expect(rankIdioma(["es-AR"])).toBe(2);
    expect(rankIdioma(["it-IT"])).toBe(3);
  });

  it("país multi-idioma vale pelo MELHOR idioma dele", () => {
    expect(rankIdioma(["de-CH", "fr-CH", "it-CH"])).toBe(3);
    expect(rankIdioma(["de-CH", "es-ES"])).toBe(2);
  });

  it("ordena por idioma e, dentro do idioma, por índice decrescente", () => {
    const linha = (pais: PaisProspeccao, indice: number): PaisAgora => ({
      pais,
      diaSemana: 3,
      minutoLocal: 600,
      horaLocal: "10h",
      faixa: { inicioMin: 540, fimMin: 690 },
      indice: { indice, fonte: "config", cidades: 0 },
      leads: [],
    });

    const ordem = ordenarPaises([
      linha(SUICA, 3.5),
      linha(ESPANHA, 1.9),
      linha(BRASIL, 1),
      linha(PORTUGAL, 1.6),
    ]).map((p) => p.pais.codigo);

    // pt (PT antes de BR, índice maior), depois es, depois o resto.
    expect(ordem).toEqual(["PT", "BR", "ES", "CH"]);
  });
});

describe("indiceDoPais", () => {
  it("sem região cacheada, vale o índice base da config", () => {
    expect(indiceDoPais(PORTUGAL, [])).toEqual({ indice: 1.6, fonte: "config", cidades: 0 });
  });

  it("com regiões daquele país, a média das cidades REAIS vence a config", () => {
    const regioes = [
      regiao("Lisboa", "Portugal", 2),
      regiao("Porto", "portugal", 1.6),
      regiao("Zurique", "Suíça", 4),
    ];
    expect(indiceDoPais(PORTUGAL, regioes)).toEqual({ indice: 1.8, fonte: "regioes", cidades: 2 });
  });

  it("o ajuste manual do admin vence o índice gerado, como na calculadora", () => {
    const regioes = [regiao("Lisboa", "Portugal", 2, 1.2)];
    expect(indiceDoPais(PORTUGAL, regioes).indice).toBe(1.2);
  });
});

describe("naoContatado / leadsDoPais", () => {
  it("só lead novo, sem selo de contato e não descartado", () => {
    expect(naoContatado(lead("a"))).toBe(true);
    expect(naoContatado(lead("b", { status: "contactado" }))).toBe(false);
    expect(naoContatado(lead("c", { seloContato: { userId: "admin", em: "2026-08-02" } }))).toBe(
      false,
    );
    expect(naoContatado(lead("d", { descartado: true }))).toBe(false);
  });

  it("casa país pelo endereço e família pelo nicho da busca", () => {
    const leads = [
      lead("pt-barbearia"),
      lead("pt-lancheria", {
        busca: { nicho: "lancheria", regiao: "Porto", em: "2026-08-01T10:00:00Z" },
      }),
      lead("es-barbearia", { endereco: "Calle Mayor, 3, 28013 Madrid, Espanha" }),
      lead("pt-contactado", { status: "contactado" }),
      lead("sem-endereco", { endereco: undefined }),
    ];

    expect(leadsDoPais(leads, "Portugal", "barbearia").map((l) => l.placeId)).toEqual([
      "pt-barbearia",
    ]);
  });

  it("ordena por score — o lead sem site vem antes", () => {
    const leads = [
      lead("com-site", { siteProprio: true }),
      lead("sem-site", { siteProprio: false }),
    ];
    expect(leadsDoPais(leads, "Portugal", "barbearia").map((l) => l.placeId)).toEqual([
      "sem-site",
      "com-site",
    ]);
  });
});

describe("montarMundo", () => {
  const janelas: JanelasContatoConfig = DEFAULT_JANELAS_CONTATO;
  const paises = [BRASIL, PORTUGAL, ESPANHA, SUICA];

  it("lista só quem está em faixa boa agora, na ordem da tela", () => {
    // 12:00 UTC: Brasil 9h (bom), Portugal 12h, Espanha/Suíça 13h.
    const mundo = montarMundo({
      paises,
      janelas,
      familia: "barbearia",
      leads: [],
      regioes: [],
      now: QUARTA_12H_UTC,
    });

    expect(mundo.paises.map((p) => p.pais.codigo)).toEqual(["BR"]);
    expect(mundo.paises[0].horaLocal).toBe("9h");
    expect(mundo.paises[0].faixa).toEqual({ inicioMin: 540, fimMin: 690 });
    expect(mundo.emBreve).toBeUndefined();
  });

  it("a madrugada brasileira pega a Europa de manhã", () => {
    // 08:00 UTC = 5h no Brasil, 8h em Portugal, 9h na Espanha e na Suíça.
    const mundo = montarMundo({
      paises,
      janelas,
      familia: "barbearia",
      leads: [],
      regioes: [],
      now: new Date("2026-08-12T08:00:00Z"),
    });

    // Espanha e Suíça em faixa boa; ambas fora de pt/en, então índice manda.
    expect(mundo.paises.map((p) => p.pais.codigo)).toEqual(["ES", "CH"]);
  });

  it("índice da média de /regioes reordena dentro do mesmo idioma", () => {
    const mundo = montarMundo({
      paises,
      janelas,
      familia: "barbearia",
      leads: [],
      regioes: [regiao("Zurique", "Suíça", 1.1)],
      now: new Date("2026-08-12T08:00:00Z"),
    });

    // Suíça caiu de 3.5 (config) para 1.1 (cidade real) e perdeu a ponta.
    expect(mundo.paises.map((p) => p.pais.codigo)).toEqual(["CH", "ES"].reverse());
    expect(mundo.paises.find((p) => p.pais.codigo === "CH")?.indice).toEqual({
      indice: 1.1,
      fonte: "regioes",
      cidades: 1,
    });
  });

  it("anexa os leads não contatados daquele país e família", () => {
    const mundo = montarMundo({
      paises,
      janelas,
      familia: "barbearia",
      leads: [lead("pt-1"), lead("pt-2", { status: "contactado" })],
      regioes: [],
      now: new Date("2026-08-12T09:30:00Z"), // 10h30 em Portugal
    });

    const portugal = mundo.paises.find((p) => p.pais.codigo === "PT");
    expect(portugal?.leads.map((l) => l.placeId)).toEqual(["pt-1"]);
  });

  it("ninguém em faixa boa: devolve lista vazia e o próximo país a abrir", () => {
    const madrugada = new Date("2026-08-12T05:00:00Z"); // 2h no Brasil, 5h em Portugal, 6h na Espanha
    const mundo = montarMundo({
      paises,
      janelas,
      familia: "barbearia",
      leads: [],
      regioes: [],
      now: madrugada,
    });

    expect(mundo.paises).toEqual([]);
    // Espanha e Suíça (UTC+1) estão às 6h — 3h até a faixa das 9h locais,
    // antes de Portugal (5h) e do Brasil (2h).
    expect(mundo.emBreve?.proxima.rotuloDia).toBe("hoje");
    expect(mundo.emBreve?.emMinutos).toBe(180);
    expect(["ES", "CH"]).toContain(mundo.emBreve?.pais.codigo);
  });

  it("família desconhecida não inventa faixa", () => {
    expect(
      montarMundo({
        paises,
        janelas,
        familia: "floricultura",
        leads: [],
        regioes: [],
        now: QUARTA_12H_UTC,
      }),
    ).toEqual({ paises: [] });
  });
});
