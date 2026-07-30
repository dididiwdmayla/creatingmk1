import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { DEFAULTS_HISTORICOS } from "../legado";
import { montarDemoData } from "../montar";
import { CAMPOS_IDENTIDADE_DEMO } from "../patch";
import { getTheme, SKINS } from "../registry";
import { aplicarTema } from "../tema";

/**
 * Contrato de todas as skins: dados reais do lead (nome, endereço, telefone,
 * whatsapp) precisam aparecer no HTML renderizado de uma demo recém-criada
 * (sem nenhuma edição do usuário) — nunca os defaults do template. A skin é
 * quem decide COMO exibir cada slot, mas TEM que exibir algum lugar; se ela
 * não usa o campo (ou deixa um default do exemplo mascará-lo, como
 * `cidade ?? endereco`), a demo nasce com os dados errados e ninguém percebe
 * até o cliente ver a própria página. Roda contra TODAS as skins do
 * registro — uma skin nova entra automaticamente na cobertura.
 */

function leadFake(): Lead {
  return {
    placeId: "contrato-fake",
    nome: "Studio Contrato Fake",
    endereco: "Rua do Contrato, 123 — Bairro Teste",
    status: "novo",
    telefone: "(41) 3555-2020",
    telefoneIntl: "+5541988887777",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  };
}

/** Lead com TODOS os campos de identidade (horários, cidade, instagram) presentes. */
function leadCompleto(): Lead {
  return {
    placeId: "contrato-completo",
    nome: "Studio Contrato Completo",
    endereco: "Rua das Completas, 500, Bairro Pleno, Fortaleza, CE",
    status: "novo",
    telefone: "(85) 3555-4040",
    telefoneIntl: "+5585988886666",
    siteUrl: "https://instagram.com/estudio.contrato.completo",
    enriquecido: false,
    horarios: {
      faixas: [
        { diaAbre: 1, horaAbre: 9, minAbre: 0, diaFecha: 1, horaFecha: 18, minFecha: 0 },
        { diaAbre: 2, horaAbre: 9, minAbre: 0, diaFecha: 2, horaFecha: 18, minFecha: 0 },
        { diaAbre: 3, horaAbre: 9, minAbre: 0, diaFecha: 3, horaFecha: 18, minFecha: 0 },
      ],
      utcOffsetMinutes: -180,
      obtidoEm: "2026-07-01T00:00:00.000Z",
    },
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  };
}

/**
 * Lead recém-criado, ainda sem enriquecer: nada além do mínimo obrigatório
 * (nem endereço, telefone, site ou horários). É o estado mais comum de um
 * lead novo — e o cenário onde os defaults antigos de exemplo.ts mais
 * arriscavam vazar (ver BLOCKLIST_DEFAULTS_ANTIGOS abaixo).
 */
function leadVazio(): Lead {
  return {
    placeId: "contrato-vazio",
    nome: "Studio Contrato Vazio",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  };
}

/**
 * Blocklist estática dos defaults antigos de identidade (telefone, whatsapp,
 * instagram, cidade, horários, hero.titulo) — um por campo por skin, tirado
 * do snapshot histórico em ./legado.ts, mais os dois padrões genéricos que
 * várias skins compartilhavam (cidade "Sua Cidade…", instagram "@sua…").
 * Nenhum desses literais pode aparecer no HTML de uma demo com lead vazio.
 */
const BLOCKLIST_DEFAULTS_ANTIGOS: readonly string[] = [
  "Sua Cidade",
  "@sua",
  ...Object.values(DEFAULTS_HISTORICOS).flatMap((defaults) =>
    Object.values(defaults).filter((v): v is string => typeof v === "string"),
  ),
];

function renderSkin(
  skin: (typeof SKINS)[number],
  lead: Lead | undefined,
  patch?: Parameters<typeof montarDemoData>[2],
) {
  const data = montarDemoData(skin.demoDataExemplo, lead, patch, skin.id);
  const theme = aplicarTema(getTheme(skin, undefined), undefined, skin.heroEscalaLimites);
  const Skin = skin.componente;
  const html = renderToStaticMarkup(<Skin data={data} theme={theme} />);
  return { data, html };
}

describe("contrato: dados do lead aparecem no render de TODA skin registrada", () => {
  for (const skin of SKINS) {
    it(`${skin.id}: nome/endereço/telefone/whatsapp da demo recém-criada`, () => {
      const lead = leadFake();
      const { data, html } = renderSkin(skin, lead);

      // A montagem já garante isso na camada de dados — o teste é sobre a
      // SKIN não perder o que a montagem entregou.
      expect(data.nome).toBe(lead.nome);
      expect(data.endereco).toBe(lead.endereco);
      expect(data.telefone).toBe(lead.telefone);
      expect(data.whatsapp).toBe(lead.telefoneIntl);

      expect(html).toContain(lead.nome);
      expect(html).toContain(lead.endereco!);
      expect(html).toContain(lead.telefone!);
      // whatsapp normalmente vira link wa.me — só os dígitos são garantidos.
      expect(html).toContain(lead.telefoneIntl!.replace(/\D/g, ""));
    });
  }
});

describe("contrato: exemplo.ts NUNCA define campo de identidade como string não-vazia", () => {
  for (const skin of SKINS) {
    it(`${skin.id}: telefone/whatsapp/instagram/cidade/horarios/hero.titulo ausentes no exemplo`, () => {
      const exemplo = skin.demoDataExemplo;
      for (const campo of CAMPOS_IDENTIDADE_DEMO) {
        const valor = exemplo[campo as keyof typeof exemplo];
        expect(valor, `exemplo.${campo} deveria estar ausente`).toBeFalsy();
      }
      expect(
        exemplo.secoes.hero?.titulo,
        "exemplo.secoes.hero.titulo deveria estar ausente (fallback pro nome do negócio)",
      ).toBeFalsy();
    });
  }
});

describe("contrato: lead completo faz identidade (horários/cidade/instagram) e nome aparecerem no HTML", () => {
  for (const skin of SKINS) {
    it(`${skin.id}: horarios/cidade/instagram/nome da demo com lead totalmente enriquecido`, () => {
      const lead = leadCompleto();
      const { data, html } = renderSkin(skin, lead);

      expect(data.horarios).toBeTruthy();
      expect(data.cidade).toBeTruthy();
      expect(data.instagram).toBeTruthy();

      expect(html).toContain(lead.nome);
      expect(html).toContain(data.horarios!);
      expect(html).toContain(data.cidade!);
      expect(html).toContain(data.instagram!);
    });
  }
});

describe("contrato: lead vazio nunca vaza um default antigo de identidade", () => {
  for (const skin of SKINS) {
    it(`${skin.id}: nenhum literal da blocklist aparece no HTML com lead sem identidade`, () => {
      const lead = leadVazio();
      const { data, html } = renderSkin(skin, lead);

      // Sem lead nem edição, os campos de identidade ficam mesmo ausentes.
      for (const campo of CAMPOS_IDENTIDADE_DEMO) {
        expect(data[campo as keyof typeof data]).toBeFalsy();
      }

      for (const literal of BLOCKLIST_DEFAULTS_ANTIGOS) {
        expect(html, `"${literal}" (default antigo) vazou no HTML`).not.toContain(literal);
      }
    });
  }
});
