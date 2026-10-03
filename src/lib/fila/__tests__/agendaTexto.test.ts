import { describe, expect, it } from "vitest";

import {
  complementoDeFuso,
  diaDoOperador,
  horaDoLeadSeOutra,
  horaDoOperador,
  textoDoBarrado,
  textoDoFora,
  textoDoMotivo,
  textoDoVencido,
} from "../agendaTexto";
import type { LinhaAgenda } from "../estado";

/** Os textos da agenda — no fuso do OPERADOR (São Paulo, UTC-3), fixo. */

const RITMO = { metaDiaria: 15, tetoPorHora: 4, intervaloMinimoSegundos: 180 };
const GERADO = "2026-03-10T09:40:00.000Z"; // terça, 06h40 em São Paulo

function linha(overrides: Partial<LinhaAgenda> = {}): LinhaAgenda {
  return {
    leadId: "a",
    nome: "A",
    em: "2026-03-10T12:00:00.000Z",
    motivo: "janela",
    depoisDaMeta: false,
    offsetLead: -180,
    cidade: "Maringá",
    nivel: "bom",
    manual: false,
    ...overrides,
  };
}

describe("hora e dia do operador", () => {
  it("a hora sai no relógio de São Paulo, não no do navegador", () => {
    expect(horaDoOperador("2026-03-10T12:00:00.000Z")).toBe("09:00");
  });

  it("hoje, amanhã e, depois, o dia da semana com a data", () => {
    expect(diaDoOperador("2026-03-10T23:00:00.000Z", GERADO)).toBe("hoje");
    expect(diaDoOperador("2026-03-11T12:00:00.000Z", GERADO)).toBe("amanhã");
    expect(diaDoOperador("2026-03-12T12:00:00.000Z", GERADO)).toBe("qui 12/03");
  });

  it("o dia vira à meia-noite de São Paulo (03h UTC), não à de UTC", () => {
    expect(diaDoOperador("2026-03-11T02:59:00.000Z", GERADO)).toBe("hoje");
    expect(diaDoOperador("2026-03-11T03:00:00.000Z", GERADO)).toBe("amanhã");
  });
});

describe("a hora do lead", () => {
  it("mesmo fuso: não repete a hora", () => {
    expect(horaDoLeadSeOutra(linha())).toBeUndefined();
  });

  it("outro fuso: a hora dele com a cidade, ou 'lá'", () => {
    expect(horaDoLeadSeOutra(linha({ offsetLead: 0, cidade: "Lisboa" }))).toBe("12:00 em Lisboa");
    expect(horaDoLeadSeOutra(linha({ offsetLead: 60, cidade: "" }))).toBe("13:00 lá");
  });
});

describe("o motivo do horário", () => {
  it("cada portão com o número da regra", () => {
    expect(textoDoMotivo(linha({ motivo: "agora" }), RITMO)).toBe("já pode sair");
    expect(textoDoMotivo(linha({ motivo: "em_seguida" }), RITMO)).toBe("logo depois do anterior");
    expect(textoDoMotivo(linha(), RITMO)).toBe("abre às 09:00");
    expect(textoDoMotivo(linha({ motivo: "intervalo" }), RITMO)).toBe("intervalo de 3 min");
    expect(textoDoMotivo(linha({ motivo: "intervalo" }), { ...RITMO, intervaloMinimoSegundos: 90 })).toBe(
      "intervalo de 90 s",
    );
    expect(textoDoMotivo(linha({ motivo: "teto_hora" }), RITMO)).toBe("teto de 4 por hora");
    expect(textoDoMotivo(linha({ motivo: "meta" }), RITMO)).toBe("meta de 15 batida · dia novo");
  });

  it("a janela de lead em outro fuso diz a hora DELE, com o lugar — e só uma vez", () => {
    const lisboa = linha({ offsetLead: 0, cidade: "Lisboa" });
    expect(textoDoMotivo(lisboa, RITMO)).toBe("abre às 12:00 em Lisboa");
    // O complemento de fuso não repete a mesma hora ao lado da janela…
    expect(complementoDeFuso(lisboa)).toBeUndefined();
    // …mas aparece nos outros motivos.
    expect(complementoDeFuso({ ...lisboa, motivo: "intervalo" })).toBe("12:00 em Lisboa");
  });

  it("depois da meta, a meta vem antes do último portão", () => {
    expect(textoDoMotivo(linha({ depoisDaMeta: true }), RITMO)).toBe("meta de 15 batida · abre às 09:00");
  });
});

describe("barrados, vencidos e o que sobrou", () => {
  it("o barrado diz o marcador", () => {
    expect(textoDoBarrado({ leadId: "g", nome: "G", motivo: "marcador", marcador: "{link}" })).toBe(
      "a mensagem sairia com {link} sem resolver",
    );
    expect(textoDoBarrado({ leadId: "g", nome: "G", motivo: "sem_telefone", marcador: "" })).toBe(
      "a mensagem não tem telefone utilizável",
    );
  });

  it("o vencido diz a varredura, o vencimento e quando sairia", () => {
    expect(
      textoDoVencido(
        {
          leadId: "v",
          nome: "V",
          venceEm: "2026-03-11T06:00:00.000Z",
          varreduraEm: "2026-03-11T06:30:00.000Z",
          sairiaEm: "2026-03-11T12:00:00.000Z",
        },
        GERADO,
      ),
    ).toBe("demo apagada na varredura de amanhã 03:30 (venceu amanhã 03:00) · sairia amanhã 09:00");
  });

  it("o que sobrou depende de onde a agenda parou", () => {
    expect(textoDoFora({ fora: 0, parouPor: "alvo", alvo: 15 })).toBeUndefined();
    expect(textoDoFora({ fora: 3, parouPor: "alvo", alvo: 15 })).toBe("+ 3 elegíveis depois destes 15");
    expect(textoDoFora({ fora: 1, parouPor: "horizonte", alvo: 15 })).toBe("1 elegível sem vez até o fim de amanhã");
  });
});
