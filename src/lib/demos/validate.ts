import { ValidationError } from "@/lib/errors";
import { IDIOMAS_SUPORTADOS } from "@/lib/idioma";
import { getEfeito } from "./efeitos/registry";
import type { EfeitoIntensidade } from "./efeitos/types";
import { getFonte } from "./fontes";
import { getLedEstilo } from "./led/registry";
import { getSkin } from "./registry";
import { HEX_RE, TEMA_RAIOS } from "./tema";
import {
  ALINHAMENTOS,
  ANIMACOES,
  ANIMACOES_ENTRADA,
  CLIQUE_ESTILOS,
  HOVER_ESTILOS,
  LED_PRESETS,
  type AnimacaoEntrada,
  type DemoDataPatch,
  type SkinDefinition,
  type TemaPatch,
} from "./types";

/** "nenhum" (desligado) ou id de um efeito existente no registro. */
function fundoEfeitoValido(id: string): boolean {
  return id === "nenhum" || getEfeito(id) !== undefined;
}

/**
 * Validação do corpo do PUT /api/leads/[id]/demo. Devolve a configuração
 * tipada ou lança ValidationError com a lista de problemas. Chaves
 * desconhecidas são rejeitadas (pega typo antes de virar dado sujo).
 */

const TEXTO_MAX = 2000;
const LISTA_MAX = 30;
const DENSIDADES = ["compacta", "confortavel", "arejada"] as const;

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

function validaDados(
  value: unknown,
  problemas: string[],
  skin: SkinDefinition | undefined,
): DemoDataPatch {
  if (!isRecord(value)) {
    problemas.push("dados deve ser um objeto");
    return {};
  }

  for (const chave of Object.keys(value)) {
    const conhecida =
      (CAMPOS_TEXTO as readonly string[]).includes(chave) ||
      ["servicos", "depoimentos", "secoes", "imagens", "videos", "ordemSecoes"].includes(chave);
    if (!conhecida) problemas.push(`dados.${chave}: chave desconhecida`);
  }

  if (value.ordemSecoes !== undefined && validaLista(value.ordemSecoes, "dados.ordemSecoes", problemas)) {
    (value.ordemSecoes as unknown[]).forEach((id, i) => {
      if (typeof id !== "string") {
        problemas.push(`dados.ordemSecoes[${i}] deve ser string`);
      } else if (skin && !skin.secoes.some((secao) => !secao.fixa && secao.id === id)) {
        problemas.push(`dados.ordemSecoes[${i}]: "${id}" não é seção reordenável da skin`);
      }
    });
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
      if (servico.precoPrefixo !== undefined) {
        validaTexto(servico.precoPrefixo, `dados.servicos[${i}].precoPrefixo`, problemas);
      }
      if (servico.precoValor !== undefined) {
        if (typeof servico.precoValor !== "number" || !Number.isFinite(servico.precoValor)) {
          problemas.push(`dados.servicos[${i}].precoValor deve ser number`);
        }
      }
      if (servico.descricao !== undefined) {
        validaTexto(servico.descricao, `dados.servicos[${i}].descricao`, problemas);
      }
      if (servico.categoria !== undefined) {
        validaTexto(servico.categoria, `dados.servicos[${i}].categoria`, problemas);
      }
      if (servico.destaques !== undefined) {
        if (validaLista(servico.destaques, `dados.servicos[${i}].destaques`, problemas)) {
          (servico.destaques as unknown[]).forEach((destaque, j) => {
            validaTexto(destaque, `dados.servicos[${i}].destaques[${j}]`, problemas);
          });
        }
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
      if (dep.contexto !== undefined) {
        validaTexto(dep.contexto, `dados.depoimentos[${i}].contexto`, problemas);
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
        const def = skin?.secoes.find((s) => s.id === nome);
        if (secao.oculta !== undefined) {
          if (typeof secao.oculta !== "boolean") {
            problemas.push(`dados.secoes.${nome}.oculta deve ser booleano`);
          } else if (secao.oculta && def?.fixa) {
            problemas.push(`dados.secoes.${nome}.oculta: seção fixa não pode ser ocultada`);
          }
        }
        if (secao.alinhamento !== undefined) {
          if (
            typeof secao.alinhamento !== "string" ||
            !(ALINHAMENTOS as readonly string[]).includes(secao.alinhamento)
          ) {
            problemas.push(
              `dados.secoes.${nome}.alinhamento deve ser um de: ${ALINHAMENTOS.join(", ")}`,
            );
          } else if (
            skin &&
            !(def?.alignOptions ?? []).includes(secao.alinhamento as (typeof ALINHAMENTOS)[number])
          ) {
            problemas.push(
              `dados.secoes.${nome}.alinhamento: a skin não oferece alinhamento nesta seção`,
            );
          }
        }
        if (secao.animacaoEntrada !== undefined) {
          if (
            typeof secao.animacaoEntrada !== "string" ||
            !(ANIMACOES_ENTRADA as readonly string[]).includes(secao.animacaoEntrada)
          ) {
            problemas.push(
              `dados.secoes.${nome}.animacaoEntrada deve ser um de: ${ANIMACOES_ENTRADA.join(", ")}`,
            );
          } else if (
            skin &&
            !(def?.entradaOptions ?? []).includes(secao.animacaoEntrada as AnimacaoEntrada)
          ) {
            problemas.push(
              `dados.secoes.${nome}.animacaoEntrada: a skin não oferece essa animação nesta seção`,
            );
          }
        }
        for (const chave of Object.keys(secao)) {
          if (
            !(CAMPOS_SECAO as readonly string[]).includes(chave) &&
            !["itens", "oculta", "alinhamento", "animacaoEntrada"].includes(chave)
          ) {
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

  if (value.videos !== undefined) {
    if (!isRecord(value.videos)) {
      problemas.push("dados.videos deve ser um objeto");
    } else {
      for (const [slot, src] of Object.entries(value.videos)) {
        validaTexto(src, `dados.videos.${slot}`, problemas);
        if (skin && !(skin.videoSlots ?? []).includes(slot)) {
          problemas.push(`dados.videos.${slot}: a skin não oferece vídeo-no-título nesse slot`);
        }
      }
    }
  }

  return value as DemoDataPatch;
}

/** Ajustes de tema (LeadDemo.tema): fontes da lista curada, cor hex, raio/densidade do menu. */
function validaTema(value: unknown, problemas: string[]): TemaPatch | undefined {
  if (!isRecord(value)) {
    problemas.push("tema deve ser um objeto");
    return undefined;
  }

  for (const chave of Object.keys(value)) {
    if (
      ![
        "fonteDisplay",
        "fonteCorpo",
        "destaque",
        "raio",
        "densidade",
        "animacao",
        "intro",
        "hover",
        "clique",
        "fundoEfeito",
        "fundoEfeitoIntensidade",
        "auraCores",
        "heroTitulo",
        "led",
      ].includes(chave)
    ) {
      problemas.push(`tema.${chave}: chave desconhecida`);
    }
  }

  for (const [campo, papel] of [
    ["fonteDisplay", "display"],
    ["fonteCorpo", "corpo"],
  ] as const) {
    const id = value[campo];
    if (id === undefined) continue;
    if (typeof id !== "string") {
      problemas.push(`tema.${campo} deve ser string`);
      continue;
    }
    const fonte = getFonte(id);
    if (!fonte) {
      problemas.push(`tema.${campo}: fonte desconhecida "${id}" (ver lista curada)`);
    } else if (!fonte.papeis.includes(papel)) {
      problemas.push(`tema.${campo}: a fonte "${id}" não serve para ${papel}`);
    }
  }

  if (value.heroTitulo !== undefined) {
    if (!isRecord(value.heroTitulo)) {
      problemas.push("tema.heroTitulo deve ser um objeto");
    } else {
      for (const chave of Object.keys(value.heroTitulo)) {
        if (!["fonte", "escala", "alinhamento"].includes(chave)) {
          problemas.push(`tema.heroTitulo.${chave}: chave desconhecida`);
        }
      }
      const fonteId = value.heroTitulo.fonte;
      if (fonteId !== undefined) {
        if (typeof fonteId !== "string") {
          problemas.push("tema.heroTitulo.fonte deve ser string");
        } else {
          const fonte = getFonte(fonteId);
          if (!fonte) {
            problemas.push(`tema.heroTitulo.fonte: fonte desconhecida "${fonteId}" (ver lista curada)`);
          } else if (!fonte.papeis.includes("display")) {
            problemas.push(`tema.heroTitulo.fonte: a fonte "${fonteId}" não serve para display`);
          }
        }
      }
      if (
        value.heroTitulo.escala !== undefined &&
        (typeof value.heroTitulo.escala !== "number" || !Number.isFinite(value.heroTitulo.escala))
      ) {
        problemas.push("tema.heroTitulo.escala deve ser um número");
      }
      if (
        value.heroTitulo.alinhamento !== undefined &&
        (typeof value.heroTitulo.alinhamento !== "string" ||
          !(ALINHAMENTOS as readonly string[]).includes(value.heroTitulo.alinhamento))
      ) {
        problemas.push(
          `tema.heroTitulo.alinhamento deve ser um de: ${ALINHAMENTOS.join(", ")}`,
        );
      }
    }
  }

  if (value.led !== undefined && !(LED_PRESETS as readonly string[]).includes(value.led as string)) {
    problemas.push(`tema.led deve ser um de: ${LED_PRESETS.join(", ")}`);
  }

  if (value.ledEstilo !== undefined) {
    if (typeof value.ledEstilo !== "string" || !getLedEstilo(value.ledEstilo)) {
      problemas.push("tema.ledEstilo: estilo desconhecido (ver registro de estilos de LED)");
    }
  }

  if (value.destaque !== undefined) {
    if (typeof value.destaque !== "string" || !HEX_RE.test(value.destaque)) {
      problemas.push("tema.destaque deve ser cor hex (#rrggbb)");
    }
  }

  if (value.raio !== undefined && !TEMA_RAIOS.includes(value.raio as string)) {
    problemas.push(`tema.raio deve ser um de: ${TEMA_RAIOS.join(", ")}`);
  }

  if (
    value.densidade !== undefined &&
    !(DENSIDADES as readonly string[]).includes(value.densidade as string)
  ) {
    problemas.push(`tema.densidade deve ser um de: ${DENSIDADES.join(", ")}`);
  }

  if (
    value.animacao !== undefined &&
    !(ANIMACOES as readonly string[]).includes(value.animacao as string)
  ) {
    problemas.push(`tema.animacao deve ser um de: ${ANIMACOES.join(", ")}`);
  }

  if (value.intro !== undefined && typeof value.intro !== "boolean") {
    problemas.push("tema.intro deve ser booleano");
  }

  for (const [campo, lista] of [
    ["hover", HOVER_ESTILOS],
    ["clique", CLIQUE_ESTILOS],
  ] as const) {
    if (
      value[campo] !== undefined &&
      !(lista as readonly string[]).includes(value[campo] as string)
    ) {
      problemas.push(`tema.${campo} deve ser um de: ${lista.join(", ")}`);
    }
  }

  if (value.fundoEfeito !== undefined) {
    if (typeof value.fundoEfeito !== "string" || !fundoEfeitoValido(value.fundoEfeito)) {
      problemas.push('tema.fundoEfeito deve ser "nenhum" ou um id do registro de efeitos');
    }
  }

  if (value.fundoEfeitoIntensidade !== undefined) {
    const intensidades: readonly EfeitoIntensidade[] = [0, 1, 2, 3];
    if (!intensidades.includes(value.fundoEfeitoIntensidade as EfeitoIntensidade)) {
      problemas.push("tema.fundoEfeitoIntensidade deve ser 0, 1, 2 ou 3");
    }
  }

  if (value.auraCores !== undefined) {
    if (value.auraCores === "fumaca-colorida") {
      // preset fixo, nada a validar.
    } else if (isRecord(value.auraCores)) {
      for (const chave of Object.keys(value.auraCores)) {
        if (!["primaria", "secundaria"].includes(chave)) {
          problemas.push(`tema.auraCores.${chave}: chave desconhecida`);
        }
      }
      for (const campo of ["primaria", "secundaria"] as const) {
        const cor = value.auraCores[campo];
        if (cor !== undefined && (typeof cor !== "string" || !HEX_RE.test(cor))) {
          problemas.push(`tema.auraCores.${campo} deve ser cor hex (#rrggbb)`);
        }
      }
    } else {
      problemas.push('tema.auraCores deve ser "fumaca-colorida" ou um objeto { primaria?, secundaria? }');
    }
  }

  return value as TemaPatch;
}

export interface LeadDemoInput {
  skinId: string;
  themeId: string;
  dados: DemoDataPatch;
  tema?: TemaPatch;
  /** Idioma-alvo da IA (sobrescrita manual do editor) — ver LeadDemo.idioma. */
  idioma?: string;
}

export function validateLeadDemoInput(body: Record<string, unknown>): LeadDemoInput {
  const problemas: string[] = [];

  for (const chave of Object.keys(body)) {
    if (!["skinId", "themeId", "dados", "tema", "idioma"].includes(chave)) {
      problemas.push(`chave desconhecida: ${chave}`);
    }
  }

  if (
    body.idioma !== undefined &&
    (typeof body.idioma !== "string" || !IDIOMAS_SUPORTADOS.includes(body.idioma))
  ) {
    problemas.push(`idioma deve ser um de: ${IDIOMAS_SUPORTADOS.join(", ")}`);
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

  const dados = body.dados === undefined ? {} : validaDados(body.dados, problemas, skin);
  const tema = body.tema === undefined ? undefined : validaTema(body.tema, problemas);

  if (problemas.length > 0) {
    throw new ValidationError(problemas);
  }

  return {
    skinId: body.skinId as string,
    themeId: body.themeId as string,
    dados,
    ...(tema && Object.keys(tema).length > 0 && { tema }),
    ...(typeof body.idioma === "string" && { idioma: body.idioma }),
  };
}
