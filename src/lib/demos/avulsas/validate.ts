import { ValidationError } from "@/lib/errors";

import { CAMPOS_IDENTIDADE_AVULSA } from "./identidade";
import type { IdentidadeAvulsa } from "./types";

/**
 * Validação da IDENTIDADE no POST de criação de demo avulsa. A parte de
 * configuração da demo (skin, preset, `dados`, `tema`) não é revalidada
 * aqui: a rota passa esse pedaço pelo `validateLeadDemoInput` de sempre —
 * é a mesma validação estrita que o PUT do editor usa, e ter duas versões
 * dela é como as duas divergem.
 *
 * A identidade em si é texto livre — o operador digita o que o negócio
 * usa, e o Radar não tem como (nem por que) conferir um telefone ou um
 * @ de Instagram. O que se valida é a FORMA: tipo, tamanho e a presença do
 * nome, que é o único campo sem o qual a demo não tem título nem rótulo.
 */

/** Teto por campo — mesma ordem de grandeza dos textos de `DemoData`. */
const MAX_TEXTO = 500;

const CHAVES_IDENTIDADE = ["nome", "pais", ...CAMPOS_IDENTIDADE_AVULSA] as const;

/** Chaves do corpo que NÃO são identidade — validadas por validateLeadDemoInput. */
const CHAVES_CONFIG = ["skinId", "themeId", "dados", "tema"] as const;

const CHAVES_CORPO = [...CHAVES_IDENTIDADE, ...CHAVES_CONFIG] as const;

function textoOpcional(
  valor: unknown,
  chave: string,
  problemas: string[],
): string | undefined {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor !== "string") {
    problemas.push(`${chave} deve ser string`);
    return undefined;
  }
  if (valor.length > MAX_TEXTO) {
    problemas.push(`${chave} deve ter no máximo ${MAX_TEXTO} caracteres`);
    return undefined;
  }
  return valor.trim() || undefined;
}

export function validarIdentidadeAvulsa(body: Record<string, unknown>): IdentidadeAvulsa {
  const problemas: string[] = [];

  for (const chave of Object.keys(body)) {
    if (!(CHAVES_CORPO as readonly string[]).includes(chave)) {
      problemas.push(`chave desconhecida: ${chave}`);
    }
  }

  const nome = textoOpcional(body.nome, "nome", problemas);
  if (!nome) problemas.push("nome é obrigatório");

  const identidade = { nome: nome ?? "" } as IdentidadeAvulsa;
  for (const chave of CHAVES_IDENTIDADE) {
    if (chave === "nome") continue;
    const valor = textoOpcional(body[chave], chave, problemas);
    if (valor) identidade[chave] = valor;
  }

  if (problemas.length > 0) throw new ValidationError(problemas);
  return identidade;
}

/** A parte de configuração da demo, extraída do mesmo corpo do POST. */
export function configDoCorpo(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    CHAVES_CONFIG.filter((chave) => body[chave] !== undefined).map((chave) => [chave, body[chave]]),
  );
}

/** Validação do PATCH de país (idioma/moeda da demo). String vazia = apagar. */
export function validarPaisAvulsa(body: Record<string, unknown>): string | undefined {
  const problemas: string[] = [];
  for (const chave of Object.keys(body)) {
    if (chave !== "pais") problemas.push(`chave desconhecida: ${chave}`);
  }
  const pais = textoOpcional(body.pais, "pais", problemas);
  if (problemas.length > 0) throw new ValidationError(problemas);
  return pais;
}
