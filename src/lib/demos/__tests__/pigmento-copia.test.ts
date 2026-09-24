import { describe, expect, it } from "vitest";

import { TATUAGEM2_EXEMPLO } from "@/components/demos/tatuagem2/exemplo";
import { TATUAGEM2_VARIANTES } from "@/components/demos/tatuagem2/variantes";

const porId = Object.fromEntries(TATUAGEM2_VARIANTES.map((variante) => [variante.id, variante.exemplo]));

describe("Pigmento Vivo — cópia de exemplo por variante", () => {
  it("separa as quatro propostas pelo conteúdo", () => {
    expect(new Set(TATUAGEM2_VARIANTES.map((v) => v.exemplo.slogan)).size).toBe(4);
    expect(porId.aquarela.secoes.estilos.itens?.map((i) => i.titulo)).toContain("Aquarela");
    expect(porId.boreal.secoes.estilos.itens?.map((i) => i.titulo)).toContain("Clareamento estratégico");
    expect(porId["meia-noite"].secoes.estilos.itens?.map((i) => i.titulo)).toContain("Geek");
    expect(porId.terra.secoes.estilos.itens?.map((i) => i.titulo)).toContain("Caligrafia de quem se foi");
  });

  it.each(TATUAGEM2_VARIANTES)("$id mantém contrato, identidade e slots do exemplo comum", (variante) => {
    const exemplo = variante.exemplo;
    expect(Object.keys(exemplo.secoes).sort()).toEqual(Object.keys(TATUAGEM2_EXEMPLO.secoes).sort());
    expect(exemplo.nome).toBe(TATUAGEM2_EXEMPLO.nome);
    expect(exemplo.endereco).toBe(TATUAGEM2_EXEMPLO.endereco);
    expect(exemplo.telefone).toBe(TATUAGEM2_EXEMPLO.telefone);
    expect(exemplo.whatsapp).toBe(TATUAGEM2_EXEMPLO.whatsapp);
    expect(exemplo.instagram).toBe(TATUAGEM2_EXEMPLO.instagram);
    expect(exemplo.horarios).toBe(TATUAGEM2_EXEMPLO.horarios);
    expect(exemplo.imagens).toEqual(TATUAGEM2_EXEMPLO.imagens);
    expect(exemplo.imagensAlt).toEqual(TATUAGEM2_EXEMPLO.imagensAlt);
    expect(exemplo.secoes.estilos.itens).toHaveLength(5);
    expect(exemplo.secoes.processo.itens).toHaveLength(4);
    expect(exemplo.servicos).toHaveLength(5);
    expect(JSON.stringify({ slogan: exemplo.slogan, servicos: exemplo.servicos, secoes: exemplo.secoes }))
      .not.toContain(TATUAGEM2_EXEMPLO.nome);
  });

  it("orça as coberturas da Boreal por tamanho", () => {
    expect(porId.boreal.servicos.slice(0, 3).map((servico) => servico.nome)).toEqual([
      "COBERTURA P",
      "COBERTURA M",
      "COBERTURA G",
    ]);
  });

  it.each(TATUAGEM2_VARIANTES)("$id aponta para sua própria miniatura", (variante) => {
    expect(variante.thumbnail).toBe(`/demos/tatuagem2/${variante.id}.jpg`);
  });
});
