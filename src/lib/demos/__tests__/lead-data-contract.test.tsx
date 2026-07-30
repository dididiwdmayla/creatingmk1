import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { montarDemoData } from "../montar";
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

describe("contrato: dados do lead aparecem no render de TODA skin registrada", () => {
  for (const skin of SKINS) {
    it(`${skin.id}: nome/endereço/telefone/whatsapp da demo recém-criada`, () => {
      const lead = leadFake();
      const data = montarDemoData(skin.demoDataExemplo, lead);
      const theme = aplicarTema(getTheme(skin, undefined), undefined, skin.heroEscalaLimites);
      const Skin = skin.componente;
      const html = renderToStaticMarkup(<Skin data={data} theme={theme} />);

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
