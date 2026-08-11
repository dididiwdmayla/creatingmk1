import type { ConteudoTraduzivel } from "@/lib/ai/traducaoDemo";
import type { DemoData } from "./types";

/**
 * Aplicação da tradução do conteúdo do editor sobre o `DemoData` efetivo —
 * mesmo espírito de `sugestaoTexto.ts` (extraído de
 * `EditorClient.handleAplicarSugestao`), mas mais simples: a tradução só
 * TROCA o valor de cada campo que ela mesma traduziu, por índice/chave,
 * preservando tudo o resto (imagens, tema, identidade, preço numérico,
 * itens/serviços/depoimentos que a tradução não tocou). Nada persiste sem
 * o "Salvar" normal do editor — aplicar só muda o rascunho em memória.
 */

/** A tradução tem algum campo pra aplicar? */
export function traducaoTemConteudo(traducao: ConteudoTraduzivel): boolean {
  return (
    traducao.slogan !== undefined ||
    Object.keys(traducao.secoes).length > 0 ||
    traducao.servicos.some((servico) => Object.keys(servico).length > 0) ||
    traducao.depoimentos.some((depoimento) => Object.keys(depoimento).length > 0)
  );
}

/**
 * Mescla os textos traduzidos sobre `dados` (DemoData efetivo do editor —
 * a MESMA instância que gerou o pedido de tradução). `servicos`/
 * `depoimentos`/`itens`: só os campos presentes na tradução mudam, por
 * ÍNDICE — preço, categoria, destaques, nota/contexto, autor e qualquer
 * campo que a tradução não pediu ficam exatamente como estavam.
 */
export function aplicarTraducaoDemo(traducao: ConteudoTraduzivel, dados: DemoData): DemoData {
  if (!traducaoTemConteudo(traducao)) return dados;

  const secoes = { ...dados.secoes };
  for (const [id, textos] of Object.entries(traducao.secoes)) {
    const atual = secoes[id];
    secoes[id] = {
      ...atual,
      ...(textos.rotulo !== undefined && { rotulo: textos.rotulo }),
      ...(textos.titulo !== undefined && { titulo: textos.titulo }),
      ...(textos.texto !== undefined && { texto: textos.texto }),
      ...(textos.cta !== undefined && { cta: textos.cta }),
      ...(textos.ctaSecundaria !== undefined && { ctaSecundaria: textos.ctaSecundaria }),
      ...(textos.itens !== undefined && {
        itens: (atual?.itens ?? []).map((item, i) => {
          const novo = textos.itens?.[i];
          if (!novo) return item;
          return {
            ...item,
            ...(novo.titulo !== undefined && { titulo: novo.titulo }),
            ...(novo.subtitulo !== undefined && { subtitulo: novo.subtitulo }),
            ...(novo.detalhe !== undefined && { detalhe: novo.detalhe }),
            ...(novo.texto !== undefined && { texto: novo.texto }),
          };
        }),
      }),
    };
  }

  const servicos = dados.servicos.map((servico, i) => {
    const novo = traducao.servicos[i];
    if (!novo) return servico;
    return {
      ...servico,
      ...(novo.nome !== undefined && { nome: novo.nome }),
      ...(novo.descricao !== undefined && { descricao: novo.descricao }),
      ...(novo.precoPrefixo !== undefined && { precoPrefixo: novo.precoPrefixo }),
    };
  });

  const depoimentos = dados.depoimentos.map((depoimento, i) => {
    const novo = traducao.depoimentos[i];
    if (novo?.texto === undefined) return depoimento;
    return { ...depoimento, texto: novo.texto };
  });

  return {
    ...dados,
    ...(traducao.slogan !== undefined && { slogan: traducao.slogan }),
    secoes,
    servicos,
    depoimentos,
  };
}
