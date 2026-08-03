import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ThemePaleta } from "@/lib/demos/types";

import { Aura } from "../aura/Aura";
import { Faiscas } from "../faiscas/Faiscas";
import { Filotaxia } from "../filotaxia/Filotaxia";
import { Gradiente } from "../gradiente/Gradiente";
import { Grao } from "../grao/Grao";
import { Ondas } from "../ondas/Ondas";
import { Particulas } from "../particulas/Particulas";
import {
  EFEITOS,
  EFEITOS_MIGRADOS,
  getEfeito,
  idEfeitoAtual,
  intensidadePadrao,
  resolverEfeitoFundo,
} from "../registry";
import type { EfeitoComponente } from "../types";
import { VarreduraDeLuz } from "../varredura-de-luz/VarreduraDeLuz";
import { Veios } from "../veios/Veios";

/**
 * Mapa id → componente RAW, só pra este teste renderizar direto (sem
 * passar pelo next/dynamic({ ssr: false }) de dynamicComponents.ts, que
 * SEMPRE devolve null no server — testaria o wrapper, não o efeito).
 * Nenhum código de produção importa este mapa.
 */
const COMPONENTES_PARA_TESTE: Record<string, EfeitoComponente> = {
  aura: Aura,
  grao: Grao,
  gradiente: Gradiente,
  particulas: Particulas,
  veios: Veios,
  filotaxia: Filotaxia,
  ondas: Ondas,
  faiscas: Faiscas,
  "varredura-de-luz": VarreduraDeLuz,
};

const CORES_TESTE: ThemePaleta = {
  fundo: "#111111",
  fundoAlt: "#1c1c1c",
  fundoElevado: "#242424",
  destaque: "#ff6600",
  destaqueInk: "#111111",
  texto: "#f5f5f5",
  textoSuave: "#bbbbbb",
  borda: "rgba(255,255,255,0.1)",
  acentoSecundario: "#22aaff",
  acentoTerciario: "#88cc00",
};

describe("registro de efeitos", () => {
  it("tem ao menos um efeito e ids únicos", () => {
    expect(EFEITOS.length).toBeGreaterThan(0);
    const ids = EFEITOS.map((efeito) => efeito.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getEfeito acha por id e devolve undefined para desconhecido", () => {
    expect(getEfeito(EFEITOS[0].id)).toBe(EFEITOS[0]);
    expect(getEfeito("nao-existe")).toBeUndefined();
    expect(getEfeito(undefined)).toBeUndefined();
  });

  it("todo efeito registrado tem componente de teste correspondente", () => {
    for (const efeito of EFEITOS) {
      expect(COMPONENTES_PARA_TESTE[efeito.id], `sem componente de teste para "${efeito.id}"`).toBeDefined();
    }
  });

  it.each(EFEITOS.map((efeito) => [efeito.id, efeito] as const))(
    "efeito %s cumpre o contrato",
    (_id, efeito) => {
      // Campos obrigatórios: id, nome legível, nichos recomendados.
      expect(efeito.id).toBeTruthy();
      expect(efeito.nome).toBeTruthy();
      expect(efeito.nichosRecomendados.length).toBeGreaterThan(0);
      for (const nicho of efeito.nichosRecomendados) {
        expect(typeof nicho).toBe("string");
        expect(nicho.length).toBeGreaterThan(0);
      }

      const Componente = COMPONENTES_PARA_TESTE[efeito.id];
      expect(typeof Componente).toBe("function");

      // Intensidade 0 = desligado: não renderiza NADA no DOM.
      const desligado = renderToStaticMarkup(
        createElement(Componente, { intensidade: 0, cores: CORES_TESTE }),
      );
      expect(desligado).toBe("");

      // Intensidade > 0 renderiza o overlay do efeito.
      const ligado = renderToStaticMarkup(
        createElement(Componente, { intensidade: 1, cores: CORES_TESTE }),
      );
      expect(ligado.length).toBeGreaterThan(0);

      // O elemento-raiz multiplica `--d-efeito-fade` na própria opacidade
      // — é assim que a camada apaga o efeito nas seções com animação
      // desligada, por interpolação (ver lib/demos/animacao/cobertura.ts).
      // Efeito novo que esqueça disso simplesmente ignoraria o controle.
      const raiz = ligado.slice(0, ligado.indexOf(">") + 1);
      expect(raiz, `a raiz de "${efeito.id}" não consome --d-efeito-fade`).toContain(
        "--d-efeito-fade",
      );
      expect(raiz).toContain("opacity");

      /**
       * **Nenhum `filter`, em intensidade nenhuma.** A regra antiga era
       * "nunca ANIMAR filter" — e não bastava: todo efeito daqui move algo
       * por `transform` (@keyframes ou rAF), e um elemento filtrado não
       * composita a transformação, então o navegador re-rasteriza e
       * re-filtra a superfície inteira a cada quadro. Foi o que derrubou
       * `gradiente` a 10 fps e `aura` a 12,7 fps no preview do editor (ver
       * ../gradiente/estilo.ts e ../aura/estilo.ts). Quando o efeito
       * precisa de suavidade, ela vem da RAMPA do gradiente, que é
       * repintura barata.
       */
      for (const i of [1, 2, 3] as const) {
        const markup = renderToStaticMarkup(
          createElement(Componente, { intensidade: i, cores: CORES_TESTE }),
        );
        expect(markup, `"${efeito.id}" (intensidade ${i}) usa filter`).not.toMatch(
          /(^|[;"\s])filter\s*:/,
        );
      }
    },
  );
});

describe("efeito removido do registro (EFEITOS_MIGRADOS)", () => {
  it("todo id migrado aponta pra um efeito que EXISTE, e não pra outro migrado", () => {
    for (const [antigo, novo] of Object.entries(EFEITOS_MIGRADOS)) {
      expect(EFEITOS.some((e) => e.id === antigo), `"${antigo}" ainda está no registro`).toBe(false);
      expect(EFEITOS.some((e) => e.id === novo), `"${novo}" não existe no registro`).toBe(true);
      expect(EFEITOS_MIGRADOS[novo]).toBeUndefined();
    }
  });

  it("o geométrico-pulsante virou ondas", () => {
    expect(idEfeitoAtual("geometrico-pulsante")).toBe("ondas");
    expect(idEfeitoAtual("veios")).toBe("veios");
  });

  it("uma demo SALVA com o efeito antigo passa a renderizar o substituto", () => {
    // O caminho inteiro, como na rota pública: o id vem do Firestore em
    // `LeadDemo.tema.fundoEfeito`, atravessa o registro e sai como efeito.
    const resolvido = resolverEfeitoFundo("geometrico-pulsante", 3, "multimarcas");
    expect(resolvido?.efeito.id).toBe("ondas");
    expect(resolvido?.intensidade).toBe(3);

    // Sem intensidade persistida, o default sai do NICHO como qualquer outro.
    expect(resolverEfeitoFundo("geometrico-pulsante", undefined, "multimarcas")?.intensidade).toBe(2);
    expect(resolverEfeitoFundo("geometrico-pulsante", undefined, "petshop")?.intensidade).toBe(1);
  });

  it("getEfeito aceita o id antigo (é o que mantém válido o PUT de uma demo antiga)", () => {
    expect(getEfeito("geometrico-pulsante")?.id).toBe("ondas");
  });
});

describe("intensidadePadrao", () => {
  const efeito = getEfeito("gradiente")!;

  it("2 quando o nicho está entre os recomendados do efeito", () => {
    expect(efeito.nichosRecomendados).toContain("imobiliaria");
    expect(intensidadePadrao(efeito, "imobiliaria")).toBe(2);
  });

  it("1 quando o nicho não é recomendado pelo efeito", () => {
    expect(efeito.nichosRecomendados).not.toContain("petshop");
    expect(intensidadePadrao(efeito, "petshop")).toBe(1);
  });
});

describe("resolverEfeitoFundo", () => {
  it('"nenhum" não resolve nada', () => {
    expect(resolverEfeitoFundo("nenhum", undefined, "barbearia")).toBeUndefined();
  });

  it("id desconhecido não resolve nada", () => {
    expect(resolverEfeitoFundo("nao-existe", 2, "barbearia")).toBeUndefined();
  });

  it("intensidade persistida vence sobre o default do nicho", () => {
    expect(resolverEfeitoFundo("particulas", 3, "barbearia")?.intensidade).toBe(3);
    expect(resolverEfeitoFundo("particulas", 0, "petshop")?.intensidade).toBe(0);
  });

  it("sem intensidade persistida cai no default do nicho — demo salva com efeito antigo (sem intensidade) continua com o mesmo efeito", () => {
    const resolvido = resolverEfeitoFundo("particulas", undefined, "petshop");
    expect(resolvido?.efeito.id).toBe("particulas");
    expect(resolvido?.intensidade).toBe(2); // petshop é recomendado p/ particulas

    const naoRecomendado = resolverEfeitoFundo("particulas", undefined, "imobiliaria");
    expect(naoRecomendado?.efeito.id).toBe("particulas");
    expect(naoRecomendado?.intensidade).toBe(1);
  });
});
