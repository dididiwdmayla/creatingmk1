import { ValidationError } from "@/lib/errors";
import { getSkin } from "./registry";
import type { DemoDataPatch } from "./types";

/**
 * Validação do corpo do PUT /api/leads/[id]/demo. Devolve a configuração
 * tipada ou lança ValidationError com a lista de problemas. Chaves
 * desconhecidas são rejeitadas (pega typo antes de virar dado sujo).
 */

const TEXTO_MAX = 2000;
const LISTA_MAX = 30;

const CAMPOS_TEXTO = [
  "nome",
  "slogan",
  "endereco",
  "telefone",
  "whatsapp",
  "instagram",
  "cidade",
  "horarios",
] as const;

const CAMPOS_SECAO = ["rotulo", "titulo", "texto", "cta", "ctaSecundaria"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validaTexto(value: unknown, path: string, problemas: string[]): void {
  if (typeof value !== "string") {
    problemas.push(`${path} deve ser string`);
  } else if (value.length > TEXTO_MAX) {
    problemas.push(`${path} deve ter no máximo ${TEXTO_MAX} caracteres`);
  }
}

function validaLista(value: unknown, path: string, problemas: string[]): value is unknown[] {
  if (!Array.isArray(value)) {
    problemas.push(`${path} deve ser uma lista`);
    return false;
  }
  if (value.length > LISTA_MAX) {
    problemas.push(`${path} deve ter no máximo ${LISTA_MAX} itens`);
    return false;
  }
  return true;
}

function validaItens(value: unknown, path: string, problemas: string[]): void {
  if (!validaLista(value, path, problemas)) return;
  value.forEach((item, i) => {
    if (!isRecord(item)) {
      problemas.push(`${path}[${i}] deve ser um objeto`);
      return;
    }
    validaTexto(item.titulo, `${path}[${i}].titulo`, problemas);
    for (const campo of ["subtitulo", "detalhe", "texto"] as const) {
      if (item[campo] !== undefined) validaTexto(item[campo], `${path}[${i}].${campo}`, problemas);
    }
    for (const chave of Object.keys(item)) {
      if (!["titulo", "subtitulo", "detalhe", "texto"].includes(chave)) {
        problemas.push(`${path}[${i}].${chave}: chave desconhecida`);
      }
    }
  });
}

function validaDados(value: unknown, problemas: string[]): DemoDataPatch {
  if (!isRecord(value)) {
    problemas.push("dados deve ser um objeto");
    return {};
  }

  for (const chave of Object.keys(value)) {
    const conhecida =
      (CAMPOS_TEXTO as readonly string[]).includes(chave) ||
      ["servicos", "depoimentos", "secoes", "imagens"].includes(chave);
    if (!conhecida) problemas.push(`dados.${chave}: chave desconhecida`);
  }

  for (const campo of CAMPOS_TEXTO) {
    if (value[campo] !== undefined) validaTexto(value[campo], `dados.${campo}`, problemas);
  }

  if (value.servicos !== undefined && validaLista(value.servicos, "dados.servicos", problemas)) {
    (value.servicos as unknown[]).forEach((servico, i) => {
      if (!isRecord(servico)) {
        problemas.push(`dados.servicos[${i}] deve ser um objeto`);
        return;
      }
      validaTexto(servico.nome, `dados.servicos[${i}].nome`, problemas);
      validaTexto(servico.preco, `dados.servicos[${i}].preco`, problemas);
      if (servico.descricao !== undefined) {
        validaTexto(servico.descricao, `dados.servicos[${i}].descricao`, problemas);
      }
    });
  }

  if (
    value.depoimentos !== undefined &&
    validaLista(value.depoimentos, "dados.depoimentos", problemas)
  ) {
    (value.depoimentos as unknown[]).forEach((dep, i) => {
      if (!isRecord(dep)) {
        problemas.push(`dados.depoimentos[${i}] deve ser um objeto`);
        return;
      }
      validaTexto(dep.autor, `dados.depoimentos[${i}].autor`, problemas);
      validaTexto(dep.texto, `dados.depoimentos[${i}].texto`, problemas);
      if (dep.nota !== undefined && (typeof dep.nota !== "number" || dep.nota < 1 || dep.nota > 5)) {
        problemas.push(`dados.depoimentos[${i}].nota deve ser número entre 1 e 5`);
      }
    });
  }

  if (value.secoes !== undefined) {
    if (!isRecord(value.secoes)) {
      problemas.push("dados.secoes deve ser um objeto");
    } else {
      for (const [nome, secao] of Object.entries(value.secoes)) {
        if (!isRecord(secao)) {
          problemas.push(`dados.secoes.${nome} deve ser um objeto`);
          continue;
        }
        for (const campo of CAMPOS_SECAO) {
          if (secao[campo] !== undefined) {
            validaTexto(secao[campo], `dados.secoes.${nome}.${campo}`, problemas);
          }
        }
        if (secao.itens !== undefined) {
          validaItens(secao.itens, `dados.secoes.${nome}.itens`, problemas);
        }
        for (const chave of Object.keys(secao)) {
          if (!(CAMPOS_SECAO as readonly string[]).includes(chave) && chave !== "itens") {
            problemas.push(`dados.secoes.${nome}.${chave}: chave desconhecida`);
          }
        }
      }
    }
  }

  if (value.imagens !== undefined) {
    if (!isRecord(value.imagens)) {
      problemas.push("dados.imagens deve ser um objeto");
    } else {
      for (const [slot, src] of Object.entries(value.imagens)) {
        validaTexto(src, `dados.imagens.${slot}`, problemas);
      }
    }
  }

  return value as DemoDataPatch;
}

export interface LeadDemoInput {
  skinId: string;
  themeId: string;
  dados: DemoDataPatch;
}

export function validateLeadDemoInput(body: Record<string, unknown>): LeadDemoInput {
  const problemas: string[] = [];

  for (const chave of Object.keys(body)) {
    if (!["skinId", "themeId", "dados"].includes(chave)) {
      problemas.push(`chave desconhecida: ${chave}`);
    }
  }

  const skin = typeof body.skinId === "string" ? getSkin(body.skinId) : undefined;
  if (typeof body.skinId !== "string") {
    problemas.push("skinId deve ser string");
  } else if (!skin) {
    problemas.push(`skinId desconhecido: ${body.skinId}`);
  }

  if (typeof body.themeId !== "string") {
    problemas.push("themeId deve ser string");
  } else if (skin && !skin.themePresets.some((theme) => theme.id === body.themeId)) {
    problemas.push(
      `themeId "${body.themeId}" não é preset da skin (${skin.themePresets
        .map((theme) => theme.id)
        .join(", ")})`,
    );
  }

  const dados = body.dados === undefined ? {} : validaDados(body.dados, problemas);

  if (problemas.length > 0) {
    throw new ValidationError(problemas);
  }

  return { skinId: body.skinId as string, themeId: body.themeId as string, dados };
}
