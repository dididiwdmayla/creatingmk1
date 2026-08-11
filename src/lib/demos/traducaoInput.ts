import type { DemoData, DemoDepoimento, DemoItem, DemoSecao, DemoServico } from "./types";

/**
 * Parser DEFENSIVO do `dados` bruto que o POST /demo/traduzir recebe do
 * editor: o corpo é o `DemoData` EFETIVO em memória (exemplo ← lead ←
 * edições ainda não salvas) — não um patch, e não passa pela validação
 * estrita de `lib/demos/validate.ts` (que existe pro PUT que PERSISTE a
 * demo). Aqui o resultado nunca é gravado em lugar nenhum: só alimenta
 * `extrairConteudoTraduzivel`, que já filtra pra CONTEÚDO. Por isso a
 * coerção é best-effort — campo com tipo errado vira ausente (nada a
 * traduzir ali) em vez de erro 400 — com os mesmos limites de tamanho de
 * `validate.ts` (TEXTO_MAX/LISTA_MAX) pra não deixar um corpo gigante
 * inflar o prompt/custo.
 */

const TEXTO_MAX = 2000;
const LISTA_MAX = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function texto(value: unknown): string | undefined {
  return typeof value === "string" ? value.slice(0, TEXTO_MAX) : undefined;
}

function item(value: unknown): DemoItem {
  if (!isRecord(value)) return { titulo: "" };
  const titulo = texto(value.titulo);
  const subtitulo = texto(value.subtitulo);
  const detalhe = texto(value.detalhe);
  const conteudoTexto = texto(value.texto);
  return {
    titulo: titulo ?? "",
    ...(subtitulo !== undefined && { subtitulo }),
    ...(detalhe !== undefined && { detalhe }),
    ...(conteudoTexto !== undefined && { texto: conteudoTexto }),
  };
}

function secao(value: unknown): DemoSecao {
  if (!isRecord(value)) return {};
  const rotulo = texto(value.rotulo);
  const titulo = texto(value.titulo);
  const conteudoTexto = texto(value.texto);
  const cta = texto(value.cta);
  const ctaSecundaria = texto(value.ctaSecundaria);
  return {
    ...(rotulo !== undefined && { rotulo }),
    ...(titulo !== undefined && { titulo }),
    ...(conteudoTexto !== undefined && { texto: conteudoTexto }),
    ...(cta !== undefined && { cta }),
    ...(ctaSecundaria !== undefined && { ctaSecundaria }),
    ...(Array.isArray(value.itens) && { itens: value.itens.slice(0, LISTA_MAX).map(item) }),
  };
}

function servico(value: unknown): DemoServico {
  if (!isRecord(value)) return { nome: "", preco: "" };
  const nome = texto(value.nome);
  const descricao = texto(value.descricao);
  const precoPrefixo = texto(value.precoPrefixo);
  return {
    nome: nome ?? "",
    preco: texto(value.preco) ?? "",
    ...(descricao !== undefined && { descricao }),
    ...(precoPrefixo !== undefined && { precoPrefixo }),
  };
}

function depoimento(value: unknown): DemoDepoimento {
  if (!isRecord(value)) return { autor: "", texto: "" };
  return { autor: texto(value.autor) ?? "", texto: texto(value.texto) ?? "" };
}

export function coagirConteudoParaTraducao(
  raw: unknown,
): Pick<DemoData, "slogan" | "secoes" | "servicos" | "depoimentos"> {
  if (!isRecord(raw)) return { secoes: {}, servicos: [], depoimentos: [] };

  const secoesRaw = isRecord(raw.secoes) ? raw.secoes : {};
  const slogan = texto(raw.slogan);

  return {
    ...(slogan !== undefined && { slogan }),
    secoes: Object.fromEntries(
      Object.entries(secoesRaw)
        .slice(0, LISTA_MAX)
        .map(([id, valor]) => [id, secao(valor)]),
    ),
    servicos: Array.isArray(raw.servicos) ? raw.servicos.slice(0, LISTA_MAX).map(servico) : [],
    depoimentos: Array.isArray(raw.depoimentos)
      ? raw.depoimentos.slice(0, LISTA_MAX).map(depoimento)
      : [],
  };
}
