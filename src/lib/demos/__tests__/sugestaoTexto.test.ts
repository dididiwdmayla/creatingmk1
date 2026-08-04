import { describe, expect, it } from "vitest";

import type { SugestaoDemo } from "@/lib/ai/sugestao";
import { montarDemoData } from "../montar";
import { DEFAULT_SKIN } from "../registry";
import { aplicarSugestaoTexto, sugestaoTemTexto } from "../sugestaoTexto";

const BASE = montarDemoData(DEFAULT_SKIN.demoDataExemplo);

const SUGESTAO_TEMA_APENAS: SugestaoDemo = {
  themeId: "algum-preset",
  destaque: "#112233",
  fonteDisplay: "alguma-fonte",
  animacao: "sutil",
};

describe("sugestaoTemTexto", () => {
  it('nível "toque-leve" (só tema) não tem texto', () => {
    expect(sugestaoTemTexto(SUGESTAO_TEMA_APENAS)).toBe(false);
  });

  it("slogan sozinho já conta como texto", () => {
    expect(sugestaoTemTexto({ ...SUGESTAO_TEMA_APENAS, slogan: "Novo slogan" })).toBe(true);
  });
});

describe("aplicarSugestaoTexto", () => {
  it("sem campos de texto: devolve os dados como vieram (mesma referência)", () => {
    expect(aplicarSugestaoTexto(SUGESTAO_TEMA_APENAS, BASE)).toBe(BASE);
  });

  it("aplica slogan, descrição do hero e títulos de seção", () => {
    const sugestao: SugestaoDemo = {
      ...SUGESTAO_TEMA_APENAS,
      slogan: "Tesoura e navalha, sempre.",
      descricao: "Barbearia de bairro com ofício de verdade.",
      titulosSecoes: { filosofia: "NOSSOS PILARES" },
    };
    const resultado = aplicarSugestaoTexto(sugestao, BASE);
    expect(resultado.slogan).toBe("Tesoura e navalha, sempre.");
    expect(resultado.secoes.hero.texto).toBe("Barbearia de bairro com ofício de verdade.");
    expect(resultado.secoes.filosofia.titulo).toBe("NOSSOS PILARES");
    // Título do hero (nome do negócio) não é campo que a IA reescreve.
    expect(resultado.secoes.hero.titulo).toBe(BASE.secoes.hero.titulo);
  });

  it("textosSecoes reescreve rótulo/título/texto/CTAs sem apagar itens não tocados", () => {
    const sugestao: SugestaoDemo = {
      ...SUGESTAO_TEMA_APENAS,
      textosSecoes: {
        filosofia: { rotulo: "FILOSOFIA", titulo: "OFÍCIO", texto: "Três pilares do trabalho." },
      },
    };
    const resultado = aplicarSugestaoTexto(sugestao, BASE);
    expect(resultado.secoes.filosofia).toMatchObject({
      rotulo: "FILOSOFIA",
      titulo: "OFÍCIO",
      texto: "Três pilares do trabalho.",
    });
    // Seção não citada na sugestão permanece intacta.
    expect(resultado.secoes.servicos).toEqual(BASE.secoes.servicos);
  });

  it("servicos: só nome/descrição mudam, preço e demais campos são preservados", () => {
    const original = BASE.servicos[0];
    const sugestao: SugestaoDemo = {
      ...SUGESTAO_TEMA_APENAS,
      servicos: [{ nome: "Corte renovado", descricao: "Nova descrição." }],
    };
    const resultado = aplicarSugestaoTexto(sugestao, BASE);
    expect(resultado.servicos[0]).toEqual({
      ...original,
      nome: "Corte renovado",
      descricao: "Nova descrição.",
    });
    // Demais serviços (fora do índice 0) continuam intactos.
    expect(resultado.servicos.slice(1)).toEqual(BASE.servicos.slice(1));
  });

  it("depoimentos: só autor/texto mudam, nota é preservada", () => {
    const sugestao: SugestaoDemo = {
      ...SUGESTAO_TEMA_APENAS,
      depoimentos: BASE.depoimentos.map(() => ({ autor: "Cliente Novo", texto: "Ótimo." })),
    };
    const resultado = aplicarSugestaoTexto(sugestao, BASE);
    resultado.depoimentos.forEach((dep, i) => {
      expect(dep.autor).toBe("Cliente Novo");
      expect(dep.texto).toBe("Ótimo.");
      expect(dep.nota).toBe(BASE.depoimentos[i].nota);
    });
  });

  it("não muda tema — themeId/destaque/fonteDisplay/animacao ficam de fora do DemoData", () => {
    const resultado = aplicarSugestaoTexto(
      { ...SUGESTAO_TEMA_APENAS, slogan: "x" },
      BASE,
    );
    expect(resultado).not.toHaveProperty("themeId");
    expect(resultado).not.toHaveProperty("destaque");
  });
});
