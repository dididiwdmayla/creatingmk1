import type { SugestaoDemo } from "@/lib/ai/sugestao";
import type { DemoData } from "./types";

/**
 * Aplicação da PARTE DE TEXTO de uma `SugestaoDemo` sobre um `DemoData`
 * efetivo — extraído de `EditorClient.handleAplicarSugestao` para ser
 * reutilizado também pela geração de texto em lote (`GerarDemosLoteDialog`),
 * que roda no servidor-cliente sem o estado React do editor. Deliberadamente
 * SEM os campos de tema (`themeId`/`destaque`/`fonteDisplay`/`animacao`): o
 * editor aplica esses à parte, no próprio estado de tema; o lote não os usa
 * — a skin/tema do lote é a escolhida no diálogo, não a que a IA sugeriria
 * por lead (ver ARCHITECTURE.md, "Geração de demos em lote").
 */

/** A sugestão tem algum campo de TEXTO (fora tema)? Nível "toque-leve" nunca tem. */
export function sugestaoTemTexto(sugestao: SugestaoDemo): boolean {
  return (
    sugestao.slogan !== undefined ||
    sugestao.descricao !== undefined ||
    sugestao.heroRotulo !== undefined ||
    sugestao.heroCta !== undefined ||
    sugestao.heroCtaSecundaria !== undefined ||
    sugestao.heroItens !== undefined ||
    sugestao.titulosSecoes !== undefined ||
    sugestao.textosSecoes !== undefined ||
    sugestao.servicos !== undefined ||
    sugestao.depoimentos !== undefined
  );
}

/**
 * Mescla os textos da sugestão sobre `dados` (DemoData efetivo — exemplo ←
 * lead ← edições já aplicadas). `servicos`/`depoimentos`: só nome/descrição
 * (ou autor/texto) mudam — preço, categoria, destaques e nota/contexto do
 * item atual são preservados (não vêm da IA, são dado do lead/editor).
 * Sem efeito (devolve `dados` como veio) quando `sugestaoTemTexto` é falso.
 */
export function aplicarSugestaoTexto(sugestao: SugestaoDemo, dados: DemoData): DemoData {
  if (!sugestaoTemTexto(sugestao)) return dados;

  const secoes = { ...dados.secoes };
  for (const [idSecao, titulo] of Object.entries(sugestao.titulosSecoes ?? {})) {
    secoes[idSecao] = { ...secoes[idSecao], titulo };
  }
  for (const [idSecao, textos] of Object.entries(sugestao.textosSecoes ?? {})) {
    secoes[idSecao] = {
      ...secoes[idSecao],
      ...(textos.rotulo !== undefined && { rotulo: textos.rotulo }),
      ...(textos.titulo !== undefined && { titulo: textos.titulo }),
      ...(textos.texto !== undefined && { texto: textos.texto }),
      ...(textos.cta !== undefined && { cta: textos.cta }),
      ...(textos.ctaSecundaria !== undefined && { ctaSecundaria: textos.ctaSecundaria }),
      ...(textos.itens !== undefined && { itens: textos.itens }),
    };
  }
  if (
    sugestao.descricao !== undefined ||
    sugestao.heroRotulo !== undefined ||
    sugestao.heroCta !== undefined ||
    sugestao.heroCtaSecundaria !== undefined ||
    sugestao.heroItens !== undefined
  ) {
    secoes.hero = {
      ...secoes.hero,
      ...(sugestao.descricao !== undefined && { texto: sugestao.descricao }),
      ...(sugestao.heroRotulo !== undefined && { rotulo: sugestao.heroRotulo }),
      ...(sugestao.heroCta !== undefined && { cta: sugestao.heroCta }),
      ...(sugestao.heroCtaSecundaria !== undefined && {
        ctaSecundaria: sugestao.heroCtaSecundaria,
      }),
      ...(sugestao.heroItens !== undefined && { itens: sugestao.heroItens }),
    };
  }

  const servicos = sugestao.servicos
    ? dados.servicos.map((servico, i) => {
        const novo = sugestao.servicos?.[i];
        if (!novo) return servico;
        return {
          ...servico,
          nome: novo.nome,
          ...(novo.descricao !== undefined && { descricao: novo.descricao }),
        };
      })
    : dados.servicos;
  const depoimentos = sugestao.depoimentos
    ? dados.depoimentos.map((depoimento, i) => {
        const novo = sugestao.depoimentos?.[i];
        if (!novo) return depoimento;
        return { ...depoimento, autor: novo.autor, texto: novo.texto };
      })
    : dados.depoimentos;

  return {
    ...dados,
    ...(sugestao.slogan !== undefined && { slogan: sugestao.slogan }),
    secoes,
    servicos,
    depoimentos,
  };
}
