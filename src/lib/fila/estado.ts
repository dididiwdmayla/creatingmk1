/**
 * A forma e a política da fila de envio, SEM nada de servidor — este módulo
 * é importado pela ficha do lead e pelo painel da /config, que são
 * componentes client. `envios.ts`, que é o dono das transações, importa
 * `node:crypto` para cunhar o claimId; arrastá-lo para o navegador por
 * causa de uma constante quebraria o bundle.
 */

import type { NivelContato } from "@/lib/leads/janelaContato";

export type FilaEnvioEstado = "reservado" | "enviado" | "invalido" | "falhou";

/** O que `confirmarClaim` aceita — "reservado" é só o estado de trânsito. */
export type FilaEnvioResultado = Exclude<FilaEnvioEstado, "reservado">;

export interface FilaEnvioDoc {
  leadId: string;
  estado: FilaEnvioEstado;
  claimId: string;
  reservadoEm: string;
  expiraEm: string;
  dispositivo: string;
  tentativas: number;
  ultimoErro: string | null;
  enviadoEm: string | null;
  /**
   * Texto que o celular mandou junto com um envio BEM-SUCEDIDO — hoje, o
   * print que não foi anexado depois de o texto já ter saído. Ausente = "".
   *
   * Campo PRÓPRIO, e não `ultimoErro`, de propósito: `ultimoErro` é
   * semanticamente FALHA (é o que a ficha mostra na tarja do lead parado, e
   * o que o diagnóstico lê para saber por que um lead não saiu). Escrever
   * nele o detalhe de um envio que DEU CERTO faria as duas coisas se
   * confundirem justamente quando alguém está investigando.
   *
   * Existe porque a macro reporta "enviado" quando o texto sai e o anexo
   * falha — reportar "falhou" devolveria o lead à fila e a pessoa receberia
   * a mesma mensagem duas vezes, que é o padrão que mais gera denúncia no
   * WhatsApp. O preço dessa escolha é um lead contactado sem a peça que
   * vende; este campo é o que torna esses leads ENCONTRÁVEIS (painel
   * "Fila de envio" em /config) em vez de exigir abrir um por um.
   */
  detalheEnvio?: string;
  /**
   * O operador já anexou o print à mão e fechou a pendência. Ausente =
   * false. Existe para a lista do painel ESVAZIAR: sem isso ela só cresce,
   * e em uma semana vira ruído que ninguém olha — uma lista que ninguém
   * olha não avisa nada. Fica na claim, junto do detalhe que ela resolve.
   */
  detalheEnvioResolvido?: boolean;
  /**
   * Skin cuja frase de fato saiu nesta reserva (`MensagemResolvida.rotacao`),
   * ou `null` quando a mensagem veio do grupo/global — que não têm rotação.
   * Fica gravado na CLAIM, e não é re-resolvido na confirmação, porque entre
   * entregar a tarefa e o celular confirmar o envio a config pode mudar: o
   * contador que gira tem que ser o da frase que o lead recebeu, não o da
   * frase que estaria valendo agora.
   */
  rotacaoSkinId?: string | null;
}

/**
 * Política de reenvio de lead que já falhou. A partir de `TENTATIVAS_MAX` o
 * lead PARA, para inspeção manual: não é excluído nem marcado como inválido,
 * só deixa de ser elegível.
 */
export const TENTATIVAS_MAX = 3;

/**
 * O lead está PARADO na fila — tentativas esgotadas. Some da fila sozinho,
 * então a ficha é o único lugar onde isso pode aparecer: um estado que some
 * sem explicação é um estado que mente.
 */
export function filaParado(envio: FilaEnvioDoc | undefined | null): boolean {
  return envio?.estado === "falhou" && envio.tentativas >= TENTATIVAS_MAX;
}

/**
 * Uma linha da lista de pendência de print do painel "Fila de envio"
 * (/config): o lead recebeu o TEXTO mas não a peça que vende. Mora aqui,
 * e não em `pendencias.ts`, pelo mesmo motivo de `FilaEnvioDoc`: quem
 * desenha a lista é componente client, e o módulo que a MONTA lê o
 * Firestore. `pendencias.ts` reexporta, para ninguém precisar saber da
 * divisão.
 */
export interface PendenciaEnvio {
  leadId: string;
  /** Nome do lead, ou "" se o lead não existe mais (a pendência sobrevive). */
  nome: string;
  /** Quando a mensagem saiu (ISO), ou "" — é a data que a lista mostra. */
  enviadoEm: string;
  /** O texto que o celular reportou junto do envio. */
  detalhe: string;
  resolvido: boolean;
}

/**
 * Uma linha das listas do painel "Fila de envio" (/config): um lead que vai
 * receber mensagem agora, ou um que está parado na janela. Mora aqui, e não
 * em `painel.ts`, pelo mesmo motivo de `PendenciaEnvio`: quem desenha é
 * componente client e o módulo que MONTA lê o Firestore.
 */
export interface LinhaFilaPainel {
  leadId: string;
  nome: string;
  /** Nicho CRU da busca que trouxe o lead (não o normalizado do pool). */
  nicho: string;
  /** Nível da janela agora; `null` = o lead está FECHADO neste minuto. */
  nivel: NivelContato | null;
  /** Hora local DO LEAD agora ("14h30"), calculada do deslocamento dele. */
  horaLocal: string;
  /**
   * Só nos bloqueados: a próxima faixa ACEITA — que com
   * `exigirJanelaBoa === false` vem antes do "próximo bom" (ver
   * `proximoMomentoAceito`). `null` = não entra em nenhum dos 7 dias
   * varridos, e a tela não promete hora nenhuma.
   */
  proximaFaixa: { rotuloDia: string; hora: string } | null;
}

/**
 * O contador do dia como a tela mostra: quanto saiu, quanto falta e QUANDO
 * o dia operacional vira — sem o instante da virada, "7 de 15" não diz se
 * resta a noite inteira ou dez minutos.
 */
export interface ContadorPainel {
  /** Chave do dia operacional corrente (YYYY-MM-DD, America/Sao_Paulo). */
  diaOperacional: string;
  enviados: number;
  meta: number;
  /** `meta - enviados`, nunca negativo (a meta pode ser reduzida no meio do dia). */
  restante: number;
  /** ISO do instante em que a chave do dia operacional muda. */
  viraEm: string;
  /** `inicioDiaOperacionalHora` da config, para a tela dizer a regra junto do número. */
  inicioHora: number;
  /** Envios na última hora corrida, e o teto que eles disputam. */
  ultimaHora: number;
  tetoPorHora: number;
}

/* ── A TAREFA DE TESTE (`lib/fila/teste.ts`) ───────────────────────────
 *
 * Mesma divisão do resto deste módulo: a FORMA fica aqui porque o painel
 * que a desenha é componente client, e `teste.ts` — dono das transações —
 * importa `node:crypto` para cunhar o claimId. `teste.ts` reexporta tudo
 * abaixo, para ninguém precisar saber da divisão.
 */

export type TesteEstado = "pendente" | "entregue" | "confirmado";

/** O que o aparelho reporta — os mesmos três resultados da fila real. */
export type TesteResultado = "enviado" | "invalido" | "falhou";

/**
 * O doc `filaTestes/atual`. Tudo que a tarefa precisa é congelado na
 * INJEÇÃO — nome, texto e print —, e não relido na entrega: assim `/proximo`
 * não paga leitura de lead nem as três coleções de `montarMensagemParaLead`
 * para servir um teste, e a tarefa não muda de conteúdo entre o clique e a
 * puxada.
 */
export interface FilaTesteDoc {
  /** `teste-XXXXXXXXXXXX` — cunhado na injeção, não na entrega. */
  claimId: string;
  estado: TesteEstado;
  /** O lead ALVO. Ele nunca é escrito por este caminho; está aqui para a tela e para o rastro. */
  leadId: string;
  nome: string;
  /** Destino real do disparo: `config/fila.numeroTeste`, nunca o telefone do lead. */
  numero: string;
  texto: string;
  printUrl: string;
  criadoEm: string;
  /** `criadoEm + TESTE_VALIDADE_MS`. Só significa alguma coisa enquanto `pendente`. */
  expiraEm: string;
  /** Admin que injetou. */
  criadoPor: string;
  /** Quais etapas o operador mandou pular — o rastro do diagnóstico. */
  pulou: EtapaTeste[];
  entregueEm: string | null;
  confirmadoEm: string | null;
  resultado: TesteResultado | null;
  /** Texto livre que o aparelho mandou junto do resultado. */
  detalhe: string;
}

/**
 * As quatro etapas da seleção, na ORDEM REAL de avaliação — a mesma de
 * `/proximo` e do funil da visão (ritmo → estrutural → nicho → janela).
 */
export const ETAPAS_TESTE = ["ritmo", "estruturais", "nicho", "janela"] as const;
export type EtapaTeste = (typeof ETAPAS_TESTE)[number];

/**
 * Uma mensagem que o LEAD mandou, como o aparelho a capturou. Mora aqui, e
 * não em `respostasPendentes.ts` (que a acumula) nem em `flushRespostas.ts`
 * (que a congela no rascunho), pelo mesmo motivo de `PendenciaEnvio`: o
 * painel de respostas pendentes da /config é componente client, e os dois
 * módulos que a usam leem o Firestore. Os dois reexportam daqui.
 */
export interface MensagemGrupo {
  texto: string;
  /** Carimbo DA NOTIFICAÇÃO (não do instante da chamada HTTP) — ver mensagemRecebida.ts. */
  recebidoEm: string;
}

/**
 * O TIPO da tarefa que `GET /api/fila/proximo` entrega — a chave `tipo` do
 * contrato achatado, e o desvio que a macro do MacroDroid faz no aparelho.
 *
 * Duas tarefas, UMA macro, um desvio por este campo: duas macros disputariam
 * a tela do mesmo aparelho, e a proteção do MacroDroid contra execução
 * sobreposta é POR MACRO — duas delas não se veem. A chave é sempre uma
 * destas duas strings, nunca vazia, com ou sem tarefa (ver o route handler).
 */
export const TIPOS_TAREFA = ["prospeccao", "resposta"] as const;
export type TipoTarefaFila = (typeof TIPOS_TAREFA)[number];

/* ── O RASCUNHO e a TAREFA de resposta ────────────────────────────────
 *
 * `filaRespostas/{id}` é o REGISTRO (o rascunho gerado, o que o lead
 * mandou, o que o operador fez com ele) e `filaRespostasTarefas/{id}` é a
 * TAREFA (o que o aparelho vai puxar, com claim e tentativas). Os dois
 * moram aqui pelo mesmo motivo do resto do arquivo: o painel que os desenha
 * é componente client, e os módulos que os escrevem leem o Firestore e
 * cunham claimId com `node:crypto`. `flushRespostas.ts` e
 * `respostaAutomatica.ts` reexportam daqui.
 */

/**
 * `filaRespostas/{id}` — o RASCUNHO gerado para um grupo maduro. Coleção
 * PRÓPRIA (não `filaEnvios`, que é doc por leadId e carrega o estado do
 * ENVIO real daquele lead): aqui pode haver várias entradas por lead ao
 * longo do tempo, uma por grupo de mensagens, cada uma com id próprio.
 */
export const FILA_RESPOSTAS_COLLECTION = "filaRespostas";

export const RASCUNHO_ESTADOS = ["pendente", "usada", "descartada"] as const;
export type RascunhoEstado = (typeof RASCUNHO_ESTADOS)[number];

export interface FilaRespostaDoc {
  id: string;
  leadId: string;
  mensagens: MensagemGrupo[];
  rascunho: string;
  geradoEm: string;
  estado: RascunhoEstado;
}

/**
 * Estados da TAREFA de resposta. Os quatro do meio são os mesmos de
 * `FilaEnvioEstado` de propósito — o aparelho reporta os MESMOS três
 * resultados nos dois caminhos, e inventar um vocabulário paralelo faria a
 * mesma palavra significar coisas diferentes em duas coleções.
 *
 * - `aguardando`: o atraso sorteado ainda corre, ou a tarefa voltou à fila.
 * - `reservado`: está com o aparelho (claim viva).
 * - `enviado` / `invalido` / `falhou`: o que o aparelho reportou.
 * - `encerrada`: o operador fechou o rascunho pelo painel antes de a tarefa
 *   sair — a única saída que não vem do aparelho.
 */
export type RespostaTarefaEstado =
  | "aguardando"
  | "reservado"
  | "enviado"
  | "invalido"
  | "falhou"
  | "encerrada";

/**
 * `filaRespostasTarefas/{id}` — a tarefa de envio de UMA resposta
 * automática. O id é o MESMO do rascunho em `filaRespostas`: são os dois
 * lados da mesma resposta, e um id próprio só criaria uma tabela de
 * tradução entre eles.
 *
 * Conteúdo CONGELADO na geração (número e texto), mesma decisão da tarefa de
 * teste: assim `/proximo` serve a resposta sem reler lead nem rascunho, e o
 * que o aparelho manda é exatamente o que foi gerado.
 */
export interface RespostaTarefaDoc {
  id: string;
  leadId: string;
  /** Nome do lead, congelado — a chave `nome` do contrato vale nos dois tipos de tarefa. */
  nome: string;
  /** Dígitos puros com DDI — congelado, como o texto. */
  numero: string;
  /** O rascunho tal como saiu da IA: é isto que o aparelho manda. */
  texto: string;
  estado: RespostaTarefaEstado;
  /** Quando o ATRASO SORTEADO vence e a tarefa pode ser puxada. */
  disponivelEm: string;
  criadoEm: string;
  claimId: string | null;
  /** Instante em que a claim morre sozinha; `null` fora de `reservado`. */
  claimExpiraEm: string | null;
  dispositivo: string;
  entregueEm: string | null;
  enviadoEm: string | null;
  tentativas: number;
  ultimoErro: string | null;
}

/**
 * Tentativas de uma RESPOSTA antes de ela sair do caminho automático e cair
 * na aprovação manual do painel. Número PRÓPRIO, ainda que hoje igual ao da
 * prospecção (`TENTATIVAS_MAX`): lá ele decide quando um lead para para
 * inspeção; aqui, quando a máquina desiste e devolve a decisão ao humano —
 * duas perguntas que podem querer respostas diferentes amanhã.
 */
export const RESPOSTA_TENTATIVAS_MAX = 3;

/**
 * Uma linha do painel "Respostas pendentes" (/config): o lead respondeu, a
 * IA rascunhou, e o operador ainda não decidiu o que fazer. Traz de uma vez
 * as quatro coisas que a decisão exige — quem é o lead, o que ELE mandou, o
 * que o Radar tinha mandado, e o rascunho — para o operador não precisar
 * abrir a ficha ao lado só para lembrar o contexto.
 */
export interface RespostaPendente {
  /** Id do doc em `/filaRespostas` — a chave da ação, não o leadId: pode
   *  haver várias respostas do mesmo lead ao longo do tempo. */
  id: string;
  leadId: string;
  /** Nome do lead, ou "" se o lead não existe mais (a resposta sobrevive). */
  nome: string;
  /** Nicho CRU da busca que trouxe o lead — o mesmo que a visão da fila mostra. */
  nicho: string;
  /**
   * Dígitos puros (DDI + número) do lead, para montar o link do WhatsApp no
   * cliente. `""` quando o lead não tem telefone: aí não há conversa para
   * abrir, e a tela cai no caminho de copiar o texto.
   */
  telefone: string;
  /** Tudo que o lead mandou no grupo, na ordem em que chegou. */
  mensagens: MensagemGrupo[];
  /**
   * O texto que o Radar tinha mandado, reconstruído com a MESMA precedência
   * do envio (`montarMensagemParaLead`) — o app não guarda o literal que
   * saiu. `""` quando a reconstrução falha, e a tela omite o bloco em vez
   * de mostrar caixa vazia.
   */
  mensagemEnviada: string;
  /** O rascunho da IA — ponto de PARTIDA da caixa editável, não o que vai sair. */
  rascunho: string;
  geradoEm: string;
}
