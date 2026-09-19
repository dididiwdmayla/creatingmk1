import { ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";

/**
 * `/config/fila` — documento único com o estado que o celular (MacroDroid)
 * consulta antes de puxar o próximo lead da fila de envio. Doc PRÓPRIO,
 * fora de `/config/app` (ver `@/lib/config`): a fila é lida com muito mais
 * frequência (o celular bate a cada ciclo) e por um chamador totalmente
 * diferente (dispositivo, não sessão de usuário) — misturar no doc de app
 * acoplaria dois ritmos de escrita/leitura sem necessidade.
 */
export const FILA_CONFIG_COLLECTION = "config";
export const FILA_CONFIG_DOC = "fila";

export interface FilaConfig {
  /** Botão de pausa: false = o celular não recebe mais leads. */
  ativo: boolean;
  /** Teto de envios no dia operacional (ver `inicioDiaOperacionalHora`). */
  metaDiaria: number;
  /** Teto de envios na última hora corrida (janela deslizante). */
  tetoPorHora: number;
  /** Só libera lead cuja janela de contato atual é "boa" (ver janelaContato.ts). */
  exigirJanelaBoa: boolean;
  /** Nichos liberados para a fila. Vazio = todos. */
  nichosPermitidos: string[];
  /** Intervalo mínimo entre dois envios confirmados, em segundos. */
  intervaloMinimoSegundos: number;
  /**
   * RETENÇÃO POR CLAIM NÃO CONFIRMADA, em horas. Lead cuja claim expirou sem
   * o aparelho dizer o que houve fica inelegível por esta janela — ver o
   * bloco da retenção em `lib/fila/estado.ts` para a assimetria que a
   * justifica (bloquear quem não recebeu custa um envio, recuperável;
   * liberar quem já recebeu manda duas vezes, e isso não tem volta).
   *
   * Padrão 12. **0 desliga a retenção** e devolve a regra antiga ("claim
   * expirada volta livre") — fica configurável, e não constante no código,
   * porque o número certo depende do ritmo do aparelho e de quanto o
   * operador confia na macro daquela semana.
   */
  retencaoEnvioHoras: number;
  /**
   * Janela de silêncio (segundos) sem mensagem NOVA do mesmo lead antes de
   * gerar UM rascunho de resposta com tudo que chegou no grupo — ver
   * "Fila de respostas" em ARCHITECTURE.md. Cada mensagem do WhatsApp vira
   * uma notificação própria no aparelho; sem agrupar, um lead que manda três
   * linhas seguidas geraria três rascunhos. Precisa ser MENOR que o
   * intervalo de polling de `GET /api/fila/proximo` (hoje 180s no
   * MacroDroid) — é essa rota (e o início de `POST
   * /api/fila/mensagem-recebida`) que libera os grupos maduros.
   */
  respostaAgrupamentoSegundos: number;
  /**
   * LIGA a resposta automática: o rascunho deixa de esperar aprovação no
   * painel e vira TAREFA DE ENVIO na fila (ver `respostaAutomatica.ts`).
   * Padrão FALSE — responder sozinho, em nome do operador, é a única coisa
   * nesta fila que fala com o lead sem ninguém ter lido o que ele escreveu.
   *
   * Desligar NÃO descarta rascunho nenhum: os pendentes voltam para a lista
   * de aprovação manual (`respostasPainel.ts`), e a claim já entregue ao
   * aparelho segue seu curso — mudança de config nunca invalida claim
   * emitida, a mesma regra que já vale para a fila de envio.
   */
  respostaAutomatica: boolean;
  /**
   * Limita o automático à PRIMEIRA resposta do lead; da segunda em diante o
   * rascunho cai na aprovação manual do painel. Padrão TRUE: a primeira
   * resposta é quase sempre a mesma pergunta ("quanto custa?", "como
   * funciona?"), e é onde responder rápido vale mais; a segunda já é
   * negociação, e negociar sozinho é outro risco.
   *
   * Interruptor de verdade, editável no painel como os demais — nunca
   * constante no código. Desligado, a IA responde também as mensagens
   * seguintes.
   */
  respostaAutomaticaApenasPrimeira: boolean;
  /**
   * Faixa (segundos) do atraso SORTEADO antes de a resposta ficar
   * disponível para o aparelho — um sorteio por resposta, entre o mínimo e
   * o máximo. Padrão 180 e 720 (3 a 12 minutos).
   *
   * Resposta instantânea é a assinatura mais óbvia de robô: ninguém lê,
   * pensa e digita em dois segundos. O atraso é SORTEADO, e não fixo, pelo
   * mesmo motivo — um intervalo sempre igual é tão reconhecível quanto o
   * zero.
   *
   * Faixa invertida (`max < min`) não derruba a fila às duas da manhã: o
   * sorteio usa o maior dos dois (ver `sortearAtrasoSegundos`).
   */
  respostaDelayMinSegundos: number;
  respostaDelayMaxSegundos: number;
  /**
   * JANELA PRÓPRIA da resposta automática, em horas (0-23) do fuso do
   * OPERADOR (America/Sao_Paulo) — nunca o do lead, e nunca a
   * `janelaContato` que já existe.
   *
   * As duas perguntas são diferentes: `janelaContato` responde "quando é bom
   * abordar ESTE negócio" (faixas da família × horário de funcionamento ×
   * fuso do lead); aqui a pergunta é parecer humano. Um lead que escreve às
   * 4h e recebe resposta às 4h03 denuncia a automação mais que qualquer
   * texto. Fora da janela, a tarefa espera a abertura seguinte — nunca é
   * descartada.
   *
   * `inicio === fim` = aberto o dia inteiro; `inicio > fim` atravessa a
   * meia-noite (ver `dentroDaJanelaResposta`).
   */
  respostaJanelaInicio: number;
  respostaJanelaFim: number;
  /**
   * Teto de respostas automáticas por DIA OPERACIONAL (o mesmo
   * `inicioDiaOperacionalHora` da prospecção). Teto PRÓPRIO, contra
   * `filaContadores.respostasEnviadas`: resposta automática não consome
   * `metaDiaria`, não respeita `intervaloMinimoSegundos` e não conta no
   * `tetoPorHora` — aqueles existem para disfarçar disparo em rajada para
   * quem nunca falou com você, e responder quem te escreveu é outra coisa.
   * Sem um teto próprio, porém, uma noite movimentada viraria uma rajada de
   * outro tipo.
   */
  respostasAutomaticasMaxDia: number;
  /**
   * Hora (0-23, America/Sao_Paulo) em que o "dia operacional" começa —
   * usada para fechar a chave de `filaContadores`. 0 = meia-noite (mesmo
   * comportamento do calendário normal).
   */
  inicioDiaOperacionalHora: number;
  /**
   * NÚMERO DE DESTINO DO DISPARO DE TESTE — dígitos puros com DDI.
   *
   * Toda tarefa de teste sai para ELE, e nunca para o telefone real do lead
   * escolhido. Isso vale inclusive quando o alvo é o lead fixo de teste: a
   * sobrescrita não é conveniência, é a REDE DE SEGURANÇA para quando o
   * operador escolhe um lead de verdade para ver onde ele para no pipeline
   * — sem ela, o diagnóstico mandaria prospecção para o negócio.
   *
   * Vazio = disparo de teste desligado; o botão recusa e diz por quê, em
   * vez de cair num destino padrão.
   */
  numeroTeste: string;
  /**
   * NÚMERO DE EXCEÇÃO — a ÚNICA origem que `POST /api/fila/mensagem-recebida`
   * aceita além de um lead casado por telefone. Dígitos puros com DDI, UM
   * número só (nunca lista, nunca modo "aceitar qualquer remetente" — a
   * proteção que descarta remetente sem lead é deliberada e não muda).
   *
   * Direção OPOSTA de `numeroTeste`: aquele é DESTINO de disparo (o app
   * manda para ele); este é ORIGEM de resposta (o app trata mensagem VINDA
   * dele como se fosse um lead). Os dois iguais fariam o teste de envio
   * gerar resposta automática para si mesmo — por isso `saveFilaConfig`
   * RECUSA os dois iguais, nas duas direções.
   *
   * Vazio = comportamento de hoje, sem exceção nenhuma — mensagem de
   * remetente sem lead correspondente continua descartada em silêncio. Ver
   * "Número de exceção" em ARCHITECTURE.md.
   */
  numeroExcecao: string;
  /**
   * O leadId que dá CONTEXTO ao rascunho gerado a partir do número de
   * exceção — escolhido pelo operador no painel, junto de `numeroExcecao`.
   * Mensagem vinda do número de exceção gera rascunho como se fosse ESTE
   * lead, sem tocar em nada dele (nem status, nem o histórico de
   * `leads/{id}/respostas`): é assim que o operador ensaia a resposta de um
   * lead real sem mandar nada para ele. Vazio junto com `numeroExcecao`
   * preenchido faz a mensagem de exceção não gerar rascunho nenhum — sem
   * lead de contexto não há para quem ensaiar.
   */
  leadContextoExcecao: string;
  /**
   * Quem mudou `ativo` da última vez: `"dispositivo"` (POST /api/fila/pausar,
   * a macro do celular) ou o `userId` do admin (PUT /api/config/fila). `null`
   * = nunca mudou desde que o doc existe. NÃO é patcheável direto — só as
   * duas rotas que de fato mudam `ativo` escrevem aqui, cada uma com sua
   * própria identidade (ver `lib/fila/pausar.ts` e `saveFilaConfig`).
   */
  ativoAlteradoPor: string | null;
  /** ISO de quando `ativoAlteradoPor` foi gravado. `null` junto com ele. */
  ativoAlteradoEm: string | null;
}

export const DEFAULT_FILA_CONFIG: FilaConfig = {
  ativo: true,
  metaDiaria: 15,
  tetoPorHora: 4,
  exigirJanelaBoa: true,
  nichosPermitidos: [],
  intervaloMinimoSegundos: 180,
  retencaoEnvioHoras: 12,
  respostaAgrupamentoSegundos: 45,
  respostaAutomatica: false,
  respostaAutomaticaApenasPrimeira: true,
  respostaDelayMinSegundos: 180,
  respostaDelayMaxSegundos: 720,
  respostaJanelaInicio: 8,
  respostaJanelaFim: 22,
  respostasAutomaticasMaxDia: 30,
  inicioDiaOperacionalHora: 0,
  numeroTeste: "5544984570105",
  numeroExcecao: "",
  leadContextoExcecao: "",
  ativoAlteradoPor: null,
  ativoAlteradoEm: null,
};

const TOP_LEVEL_KEYS = new Set<keyof FilaConfig>([
  "ativo",
  "metaDiaria",
  "tetoPorHora",
  "exigirJanelaBoa",
  "nichosPermitidos",
  "intervaloMinimoSegundos",
  "retencaoEnvioHoras",
  "respostaAgrupamentoSegundos",
  "respostaAutomatica",
  "respostaAutomaticaApenasPrimeira",
  "respostaDelayMinSegundos",
  "respostaDelayMaxSegundos",
  "respostaJanelaInicio",
  "respostaJanelaFim",
  "respostasAutomaticasMaxDia",
  "inicioDiaOperacionalHora",
  "numeroTeste",
  "numeroExcecao",
  "leadContextoExcecao",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validarInteiroNaoNegativo(value: unknown, campo: string, problemas: string[]): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    problemas.push(`${campo} deve ser inteiro ≥ 0`);
  }
}

/** Valida um patch parcial de `/config/fila` (corpo do PUT /api/config/fila). */
export function validateFilaConfigPatch(patch: unknown): asserts patch is Partial<FilaConfig> {
  const problemas: string[] = [];
  if (!isRecord(patch)) {
    throw new ValidationError(["corpo deve ser um objeto JSON"]);
  }

  for (const key of Object.keys(patch)) {
    if (!TOP_LEVEL_KEYS.has(key as keyof FilaConfig)) {
      problemas.push(`chave desconhecida: ${key}`);
    }
  }

  if (patch.ativo !== undefined && typeof patch.ativo !== "boolean") {
    problemas.push("ativo deve ser booleano");
  }
  if (patch.exigirJanelaBoa !== undefined && typeof patch.exigirJanelaBoa !== "boolean") {
    problemas.push("exigirJanelaBoa deve ser booleano");
  }
  if (patch.respostaAutomatica !== undefined && typeof patch.respostaAutomatica !== "boolean") {
    problemas.push("respostaAutomatica deve ser booleano");
  }
  if (
    patch.respostaAutomaticaApenasPrimeira !== undefined &&
    typeof patch.respostaAutomaticaApenasPrimeira !== "boolean"
  ) {
    problemas.push("respostaAutomaticaApenasPrimeira deve ser booleano");
  }

  if (patch.metaDiaria !== undefined) {
    validarInteiroNaoNegativo(patch.metaDiaria, "metaDiaria", problemas);
  }
  if (patch.tetoPorHora !== undefined) {
    validarInteiroNaoNegativo(patch.tetoPorHora, "tetoPorHora", problemas);
  }
  if (patch.intervaloMinimoSegundos !== undefined) {
    validarInteiroNaoNegativo(patch.intervaloMinimoSegundos, "intervaloMinimoSegundos", problemas);
  }
  // Inteiro ≥ 0 como os outros tetos: 0 é válido e quer dizer "retenção
  // desligada", não "retenha por zero hora" (ver `retencaoMsDeHoras`).
  if (patch.retencaoEnvioHoras !== undefined) {
    validarInteiroNaoNegativo(patch.retencaoEnvioHoras, "retencaoEnvioHoras", problemas);
  }

  if (patch.respostaAgrupamentoSegundos !== undefined) {
    validarInteiroNaoNegativo(
      patch.respostaAgrupamentoSegundos,
      "respostaAgrupamentoSegundos",
      problemas,
    );
  }

  if (patch.respostaDelayMinSegundos !== undefined) {
    validarInteiroNaoNegativo(patch.respostaDelayMinSegundos, "respostaDelayMinSegundos", problemas);
  }
  if (patch.respostaDelayMaxSegundos !== undefined) {
    validarInteiroNaoNegativo(patch.respostaDelayMaxSegundos, "respostaDelayMaxSegundos", problemas);
  }
  // Faixa INVERTIDA não é erro de validação de propósito: um PUT pode trazer
  // só um dos dois lados (cada campo do painel salva no próprio blur), e
  // recusar aqui obrigaria o operador a editar os dois na ordem certa para
  // aumentar a faixa. Quem resolve é `sortearAtrasoSegundos`, usando o maior
  // dos dois — a fila nunca cai às duas da manhã por causa de uma edição
  // pela metade.
  if (patch.respostasAutomaticasMaxDia !== undefined) {
    validarInteiroNaoNegativo(
      patch.respostasAutomaticasMaxDia,
      "respostasAutomaticasMaxDia",
      problemas,
    );
  }

  for (const campo of ["respostaJanelaInicio", "respostaJanelaFim"] as const) {
    const v = patch[campo];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 23) {
      problemas.push(`${campo} deve ser inteiro entre 0 e 23`);
    }
  }

  if (patch.inicioDiaOperacionalHora !== undefined) {
    const v = patch.inicioDiaOperacionalHora;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 23) {
      problemas.push("inicioDiaOperacionalHora deve ser inteiro entre 0 e 23");
    }
  }

  if (patch.numeroTeste !== undefined) {
    // Dígitos puros com DDI, como `montarMensagemParaLead` já entrega para
    // o aparelho — nada de espaço, parêntese ou traço, que o WhatsApp do
    // celular não resolve. Vazio é válido: é o disparo de teste desligado.
    if (typeof patch.numeroTeste !== "string" || !/^(\d{10,15})?$/.test(patch.numeroTeste.trim())) {
      problemas.push("numeroTeste deve ser dígitos com DDI (10 a 15) ou vazio");
    }
  }

  if (patch.numeroExcecao !== undefined) {
    // Mesmo formato de `numeroTeste` — dígitos puros com DDI, ou vazio (sem
    // exceção). A recusa de igualdade com `numeroTeste` não é FORMATO, e por
    // isso mora em `saveFilaConfig`: aqui só se vê o patch parcial, e o
    // outro lado pode estar salvo de uma chamada anterior.
    if (typeof patch.numeroExcecao !== "string" || !/^(\d{10,15})?$/.test(patch.numeroExcecao.trim())) {
      problemas.push("numeroExcecao deve ser dígitos com DDI (10 a 15) ou vazio");
    }
  }

  if (patch.leadContextoExcecao !== undefined && typeof patch.leadContextoExcecao !== "string") {
    problemas.push("leadContextoExcecao deve ser string");
  }

  if (patch.nichosPermitidos !== undefined) {
    if (
      !Array.isArray(patch.nichosPermitidos) ||
      !patch.nichosPermitidos.every((n) => typeof n === "string")
    ) {
      problemas.push("nichosPermitidos deve ser uma lista de strings");
    }
  }

  if (problemas.length > 0) {
    throw new ValidationError(problemas);
  }
}

/**
 * Dígitos de um número de telefone da fila (`numeroTeste`/`numeroExcecao`),
 * ou `undefined` quando não veio string nenhuma. Só `trim` — o FORMATO
 * (dígitos com DDI, ou vazio) já foi checado por `validateFilaConfigPatch`
 * antes de chegar aqui.
 */
function normalizarNumeroFila(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor.trim() : undefined;
}

/** Merge raso de um patch validado sobre uma config completa. */
export function mergeFilaConfig(base: FilaConfig, patch: Partial<FilaConfig>): FilaConfig {
  return {
    ativo: patch.ativo ?? base.ativo,
    metaDiaria: patch.metaDiaria ?? base.metaDiaria,
    tetoPorHora: patch.tetoPorHora ?? base.tetoPorHora,
    exigirJanelaBoa: patch.exigirJanelaBoa ?? base.exigirJanelaBoa,
    // Substituição da lista INTEIRA (como paisesProspeccao em lib/config):
    // sem isso não haveria como REMOVER um nicho liberado.
    nichosPermitidos: patch.nichosPermitidos ?? base.nichosPermitidos,
    intervaloMinimoSegundos: patch.intervaloMinimoSegundos ?? base.intervaloMinimoSegundos,
    retencaoEnvioHoras: patch.retencaoEnvioHoras ?? base.retencaoEnvioHoras,
    respostaAgrupamentoSegundos:
      patch.respostaAgrupamentoSegundos ?? base.respostaAgrupamentoSegundos,
    // Os dois interruptores da resposta automática passam pelo mesmo `??` do
    // resto: `false` explícito sobrescreve o default, `undefined` mantém o
    // que já estava (`??` não confunde os dois, diferente de `||`).
    respostaAutomatica: patch.respostaAutomatica ?? base.respostaAutomatica,
    respostaAutomaticaApenasPrimeira:
      patch.respostaAutomaticaApenasPrimeira ?? base.respostaAutomaticaApenasPrimeira,
    respostaDelayMinSegundos: patch.respostaDelayMinSegundos ?? base.respostaDelayMinSegundos,
    respostaDelayMaxSegundos: patch.respostaDelayMaxSegundos ?? base.respostaDelayMaxSegundos,
    respostaJanelaInicio: patch.respostaJanelaInicio ?? base.respostaJanelaInicio,
    respostaJanelaFim: patch.respostaJanelaFim ?? base.respostaJanelaFim,
    respostasAutomaticasMaxDia:
      patch.respostasAutomaticasMaxDia ?? base.respostasAutomaticasMaxDia,
    inicioDiaOperacionalHora: patch.inicioDiaOperacionalHora ?? base.inicioDiaOperacionalHora,
    // `.trim()` só sobre string: `loadFilaConfig` faz este merge sobre o doc
    // CRU do Firestore, e um valor de tipo errado ali não pode derrubar
    // `/proximo` às duas da manhã.
    numeroTeste: normalizarNumeroFila(patch.numeroTeste) ?? base.numeroTeste,
    numeroExcecao: normalizarNumeroFila(patch.numeroExcecao) ?? base.numeroExcecao,
    leadContextoExcecao:
      typeof patch.leadContextoExcecao === "string"
        ? patch.leadContextoExcecao.trim()
        : base.leadContextoExcecao,
    // Passthrough normal, como o resto — `mergeFilaConfig` também é o motor
    // de `loadFilaConfig` (que chama isto com o doc CRU do Firestore como
    // "patch", para reidratar o que está persistido). `validateFilaConfigPatch`
    // é quem impede um PUT de admin de setar estes dois direto (fora de
    // `TOP_LEVEL_KEYS`) — só `saveFilaConfig` os recarimba, e só quando
    // `ativo` de fato muda.
    ativoAlteradoPor: patch.ativoAlteradoPor ?? base.ativoAlteradoPor,
    ativoAlteradoEm: patch.ativoAlteradoEm ?? base.ativoAlteradoEm,
  };
}

/**
 * Config efetiva: defaults + o que estiver persistido. Doc ausente NUNCA
 * pode virar erro nem liberar envio irrestrito — cai nos defaults (fila
 * ativa, mas com os tetos conservadores acima).
 */
export async function loadFilaConfig(db: AppDb): Promise<FilaConfig> {
  const snap = await db.collection(FILA_CONFIG_COLLECTION).doc(FILA_CONFIG_DOC).get();
  const stored = snap.exists ? snap.data() : undefined;
  if (!stored) return structuredClone(DEFAULT_FILA_CONFIG);
  return mergeFilaConfig(structuredClone(DEFAULT_FILA_CONFIG), stored as Partial<FilaConfig>);
}

/**
 * Valida o patch, aplica sobre a config efetiva e persiste o doc COMPLETO
 * (sem merge do Firestore — o merge é feito aqui, determinístico).
 *
 * `alteradoPor` é o `userId` do admin que chamou — vem de `PUT
 * /api/config/fila` (`requireAdmin`), nunca de sessão do próprio usuário
 * comum. Só é usado (e só re-carimba `ativoAlteradoPor`/`ativoAlteradoEm`)
 * quando o patch de fato MUDA `ativo`: um PUT que edita `metaDiaria` sem
 * tocar `ativo` não pode fazer parecer que o admin acabou de pausar/religar
 * a fila. Omitido = comportamento de sempre (campos de auditoria intocados),
 * o que mantém as chamadas existentes (inclusive as de teste) válidas.
 */
export async function saveFilaConfig(
  db: AppDb,
  patch: unknown,
  alteradoPor?: string,
): Promise<FilaConfig> {
  validateFilaConfigPatch(patch);
  const base = await loadFilaConfig(db);
  let merged = mergeFilaConfig(base, patch);
  // RECUSA numeroExcecao === numeroTeste, nas DUAS direções — não é checagem
  // de FORMATO (por isso não mora em `validateFilaConfigPatch`, que só vê o
  // patch parcial): um PUT que só toca `numeroExcecao` precisa comparar
  // contra o `numeroTeste` já persistido, e vice-versa. São direções
  // opostas (um é destino do disparo de teste, o outro é origem que dispara
  // a resposta) — iguais, o teste de envio geraria resposta automática para
  // si mesmo. Vazio nunca colide consigo mesmo: `numeroExcecao` vazio É "sem
  // exceção", não um número igual a um `numeroTeste` também vazio.
  if (merged.numeroExcecao && merged.numeroExcecao === merged.numeroTeste) {
    throw new ValidationError([
      "numeroExcecao não pode ser igual a numeroTeste — são direções opostas (destino do disparo de teste vs. origem que dispara a resposta)",
    ]);
  }
  if (alteradoPor && patch.ativo !== undefined && patch.ativo !== base.ativo) {
    merged = { ...merged, ativoAlteradoPor: alteradoPor, ativoAlteradoEm: new Date().toISOString() };
  }
  await db
    .collection(FILA_CONFIG_COLLECTION)
    .doc(FILA_CONFIG_DOC)
    .set({ ...merged, atualizadoEm: new Date().toISOString() });
  return merged;
}
