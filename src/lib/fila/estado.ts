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
 * RETENÇÃO POR CLAIM NÃO CONFIRMADA — a proteção contra mensagem repetida
 * que NÃO depende do aparelho.
 *
 * O caso que a criou, reconstituído pelo log do celular: o ciclo rodou
 * inteiro (texto enviado, print anexado), o `POST /api/fila/confirmar`
 * respondeu 503, a macro não repetiu a chamada, a claim expirou, o lead
 * voltou ao pool e recebeu a MESMA mensagem de novo. O lado do aparelho já
 * repete a confirmação 3 vezes, o que reduz a probabilidade e não elimina a
 * classe: aparelho reiniciado, macro morta pelo sistema, rede caindo ou
 * servidor indisponível de novo produzem o mesmo resultado.
 *
 * **Isto INVERTE deliberadamente a regra original** de que claim expirada
 * volta livre (ver `reservarLead`). Aquela regra existia para o lead não
 * ficar preso quando o celular trava; o fato novo é que "o aparelho pegou e
 * não disse o que houve" é mais provavelmente "mandou" do que "não mandou".
 * A reserva já é evidência suficiente.
 *
 * **A assimetria que justifica:** bloquear um lead que não recebeu nada
 * custa um envio, recuperável a qualquer momento (pela liberação manual do
 * painel, ou sozinho quando a janela vence). Liberar um lead que já recebeu
 * manda duas vezes, e isso não tem volta — mensagem repetida é o padrão que
 * mais gera denúncia no WhatsApp, e denúncia derruba número. Na dúvida,
 * bloqueia.
 *
 * **O que retém é o SILÊNCIO, não a falha reportada.** Claim confirmada com
 * resultado "falhou" NÃO entra aqui: confirmação de falha é evidência
 * POSITIVA de que nada saiu — é exatamente o caso em que o aparelho falou.
 * Sai de graça, por construção: confirmar move `estado` para
 * `enviado`/`invalido`/`falhou` na mesma transação, então só uma claim NUNCA
 * confirmada continua em `"reservado"`, e a política de 3 tentativas
 * (`TENTATIVAS_MAX`) segue valendo intacta para aquele caminho. Ler o pedido
 * ao pé da letra ("claim reservada nas últimas horas") mataria a
 * retentativa; não é isso que se quer.
 */

/**
 * A claim MORREU EM SILÊNCIO: reservada, prazo vencido, e nenhuma
 * confirmação jamais chegou.
 *
 * `expiraEm > reservadoEm` é o que separa silêncio de desistência declarada,
 * e não é heurística: `reservarLead` é a ÚNICA escrita que cria
 * `"reservado"` e sempre grava `expiraEm = reservadoEm + RESERVA_DURACAO_MS`
 * (5 min à frente); `liberarClaim` é a única que move `expiraEm` para trás
 * (`EPOCH_ISO`). Então `expiraEm <= reservadoEm` quer dizer "a claim foi
 * devolvida de propósito", que é o caminho em que a ROTA desistiu antes de o
 * aparelho receber tarefa nenhuma (lead que perdeu o print, lead sem
 * telefone) — ali nada saiu, e o servidor sabe disso. Retê-lo seria afirmar
 * um envio que nunca foi montado. Há teste travando a invariante contra o
 * doc que `liberarClaim` de fato produz.
 */
export function claimExpiradaSemConfirmacao(doc: FilaEnvioDoc, now: Date): boolean {
  if (doc.estado !== "reservado") return false;
  const expiraEm = new Date(doc.expiraEm).getTime();
  const reservadoEm = new Date(doc.reservadoEm).getTime();
  if (!Number.isFinite(expiraEm) || !Number.isFinite(reservadoEm)) return false;
  // Claim devolvida à mão (painel) ou pela rota: nada saiu, não é silêncio.
  if (expiraEm <= reservadoEm) return false;
  return expiraEm <= now.getTime();
}

/**
 * Instante em que a retenção deste doc vence — `reservadoEm + janela`, e não
 * `expiraEm + janela`: a âncora é quando a mensagem PROVAVELMENTE saiu, não
 * cinco minutos depois. `undefined` quando o doc não está sob retenção
 * nenhuma (não é claim silenciosa, ou a janela está desligada).
 *
 * `reservadoEm` é sobrescrito a cada nova reserva, e isso NÃO atrapalha:
 * enquanto a retenção vale, o lead está fora do pool E o portão de
 * `leadDisponivel` recusa a reserva, então nada re-reserva — logo nada
 * reescreve o carimbo. Vencida a janela, uma reserva nova reinicia a
 * contagem do carimbo novo, que é o correto: é evidência nova de um envio
 * novo.
 */
export function retencaoVenceEm(
  doc: FilaEnvioDoc,
  now: Date,
  retencaoMs: number,
): string | undefined {
  if (retencaoMs <= 0 || !claimExpiradaSemConfirmacao(doc, now)) return undefined;
  return new Date(new Date(doc.reservadoEm).getTime() + retencaoMs).toISOString();
}

/**
 * O lead está RETIDO agora — claim morta em silêncio e a janela ainda
 * correndo. `retencaoMs <= 0` desliga a retenção inteira (é o
 * `retencaoEnvioHoras: 0` da config), e aí a regra antiga volta a valer tal
 * como era.
 */
export function retidoPorEnvio(doc: FilaEnvioDoc, now: Date, retencaoMs: number): boolean {
  const venceEm = retencaoVenceEm(doc, now, retencaoMs);
  return venceEm !== undefined && now.getTime() < new Date(venceEm).getTime();
}

/** Horas da config (`retencaoEnvioHoras`) em milissegundos, sem negativo. */
export function retencaoMsDeHoras(horas: number): number {
  return Number.isFinite(horas) && horas > 0 ? horas * 60 * 60 * 1000 : 0;
}

/**
 * A CLAIM ESTÁ VIVA: o aparelho pegou este lead e o prazo ainda não venceu —
 * ele pode estar com o WhatsApp aberto NESTE segundo.
 *
 * Existe como função e não inline porque DUAS ações do painel a consultam
 * para a mesma decisão — liberar um retido (`liberarRetido`) e remover um
 * lead da fila pelo balão —, e as duas recusam pelo mesmo motivo: nenhuma
 * delas cancela um envio em andamento, e mexer num lead reservado produziria
 * exatamente a mensagem duplicada que a fila inteira existe para evitar.
 * Duas cópias da comparação divergiriam em silêncio na primeira mudança.
 *
 * `undefined` (lead que nunca foi reservado) é claim nenhuma, nunca viva.
 */
export function claimAtiva(doc: FilaEnvioDoc | undefined | null, now: Date): boolean {
  if (doc?.estado !== "reservado") return false;
  const expiraEm = new Date(doc.expiraEm).getTime();
  return Number.isFinite(expiraEm) && expiraEm > now.getTime();
}

/* ── SELEÇÃO MANUAL (`Lead.filaManual`) ────────────────────────────────
 *
 * O operador escolhe um lead na ficha e ele FURA os filtros de POLÍTICA
 * (nicho permitido e a ordem natural). Não fura os FÍSICOS: demo, captura
 * pronta, telefone, fuso. Esses não são regra, são a ausência da coisa que
 * seria enviada — sem captura não existe `printUrl` e o ciclo quebra no
 * aparelho.
 */

/**
 * As peneiras estruturais que são AUSÊNCIA DE PEÇA — o subconjunto de
 * `MotivoEstrutural` (`lib/fila/candidatos.ts`) que deixa um lead manual
 * PENDENTE em vez de invisível: alguém gera a demo, roda a captura ou
 * conserta o telefone, e ele entra sozinho.
 *
 * Mora aqui, e não junto de `MOTIVOS_ESTRUTURAIS`, pelo mesmo motivo de
 * todo o resto deste módulo: quem desenha a lista de pendentes é componente
 * client, e `candidatos.ts` arrasta `node:crypto` por `envios.ts`. Um teste
 * trava que este conjunto é subconjunto daquele — duas listas que
 * divergissem fariam um lead pendente sumir sem aviso.
 *
 * As demais peneiras (`status`, `contactadoForaDaFila`, `descartado`,
 * `telefoneInvalido`) ficam de FORA de propósito: ali não falta peça, houve
 * decisão — e `descartado` é a própria ação de remover da fila.
 */
export const MOTIVOS_FISICOS = ["semTelefone", "semDemo", "capturaNaoPronta", "semFuso"] as const;

export type MotivoFisico = (typeof MOTIVOS_FISICOS)[number];

/** `motivo` é uma ausência de peça (e não uma decisão)? */
export function motivoEhFisico(motivo: string | undefined): motivo is MotivoFisico {
  return (MOTIVOS_FISICOS as readonly string[]).includes(motivo ?? "");
}

/**
 * O que cada pendência DIZ para quem lê — o motivo visível da linha. Fica
 * junto da lista pelo mesmo motivo de a lista estar aqui: a ficha do lead e
 * o balão da fila mostram a mesma pendência, e dois textos para o mesmo
 * estado seriam duas explicações para o mesmo fato.
 */
export const MOTIVO_FISICO_LABEL: Record<MotivoFisico, string> = {
  semTelefone: "sem telefone",
  semDemo: "sem demo",
  capturaNaoPronta: "print da demo não pronto",
  semFuso: "sem fuso conhecido",
};

/**
 * Uma linha da lista de PENDENTES — lead marcado à mão que ainda não tem a
 * peça que o envio exige. Mora aqui pelo mesmo motivo de `LinhaFilaPainel`.
 *
 * Não tem nível de janela nem hora local de propósito: esse lead não está na
 * fila de entrega, e prometer "entra às 14h" seria mentira enquanto faltar a
 * peça.
 */
export interface LinhaPendenteManual {
  leadId: string;
  /** Nome do lead, ou "" se o doc sumiu entre o pool e esta leitura. */
  nome: string;
  /** Nicho CRU da busca que trouxe o lead. */
  nicho: string;
  /** A peça que falta — reconferida contra o doc FRESCO, não a do pool. */
  motivo: MotivoFisico;
}

/**
 * Uma linha da lista "Retidos por envio recente não confirmado" do painel
 * "Fila de envio" (/config). Mora aqui, e não em `retidos.ts`, pelo mesmo
 * motivo de `PendenciaEnvio`: quem desenha a lista é componente client e o
 * módulo que a MONTA lê o Firestore.
 *
 * Traz as três coisas que a decisão de liberar exige — quem é, QUANDO foi a
 * reserva (é o instante em que a mensagem provavelmente saiu, o que o
 * operador vai conferir no WhatsApp) e QUANDO a retenção vence sozinha. Só o
 * número não bastaria: sem lista não há como liberar um específico.
 */
export interface LinhaRetido {
  leadId: string;
  /** Nome do lead, ou "" se o lead não existe mais (a retenção sobrevive). */
  nome: string;
  /** Quando a claim silenciosa foi reservada (ISO). */
  reservadoEm: string;
  /** Quando a retenção vence e o lead volta ao pool sozinho (ISO). */
  venceEm: string;
  /** Aparelho que levou a tarefa e não disse o que houve. */
  dispositivo: string;
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
   * Entrou por SELEÇÃO MANUAL (`Lead.filaManual`) — furou o nicho e vem
   * antes do FIFO dentro do mesmo nível de janela. Sempre presente (nunca
   * opcional): a linha precisa poder dizer por que aquele lead está na
   * frente de quem chegou antes.
   */
  manual: boolean;
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
  /**
   * Quantos ciclos o operador pediu ao injetar — congelado, o MESMO em todo
   * REARME (ver `repeticoesRestantes` abaixo): é o que a tela usa para
   * distinguir "nunca pediu repetição" de "pediu e já zerou sozinho".
   */
  repeticoesTotal: number;
  /**
   * Quantas rearmadas AUTOMÁTICAS ainda faltam depois deste ciclo. Cunhado
   * na injeção como `repeticoesTotal - 1`; cada CONFIRMAÇÃO (nunca o
   * disparo) decrementa e faz nascer o próximo ciclo na mesma transação,
   * até zerar. `POST .../repeticoes` (cancelar) também zera, a qualquer
   * momento — é a única outra escrita que toca este campo.
   */
  repeticoesRestantes: number;
  /**
   * `null` enquanto nada foi cancelado — inclusive quando o contador chegou
   * a zero sozinho, terminando as repetições pedidas. Só o operador
   * cancelando grava um ISO aqui, e é o que distingue "terminou" de
   * "interrompido" na tela.
   */
  repeticoesCanceladasEm: string | null;
}

/**
 * As quatro etapas da seleção, na ORDEM REAL de avaliação — a mesma de
 * `/proximo` e do funil da visão (ritmo → estrutural → nicho → janela).
 */
export const ETAPAS_TESTE = ["ritmo", "estruturais", "nicho", "janela"] as const;
export type EtapaTeste = (typeof ETAPAS_TESTE)[number];

/**
 * Teto rígido do campo de repetições do disparo de teste. O campo é para
 * operador distraído: sem teto, 50 "repetições" seriam 50 mensagens reais
 * saindo para `numeroTeste` — e cada volta já leva até `TESTE_VALIDADE_MS`
 * (a macro pergunta a cada ~180s), então dez já cobrem meia hora de prova.
 */
export const REPETICOES_TESTE_MAX = 10;

/**
 * A tarefa pendente EXPIROU sem o aparelho puxar? Pura, e vive aqui (não em
 * `teste.ts`) pela mesma razão da FORMA: `repeticoesRestantesEfetivas`
 * abaixo precisa dela, e quem desenha o painel é componente client — que não
 * pode importar `teste.ts` (arrasta `node:crypto`).
 */
export function testeExpirado(doc: FilaTesteDoc, now: Date): boolean {
  return new Date(doc.expiraEm).getTime() <= now.getTime();
}

/**
 * Quantas repetições restam, considerando que uma tarefa pendente que
 * EXPIROU sem ser puxada cancela junto o que sobrava — mesma regra de
 * "instante no passado = não existe" que já vale para a tarefa em si. Pura e
 * sem escrita: o painel já mostra 0 no mesmo instante em que passa a mostrar
 * "Expirou", sem precisar de um job para sobrescrever o doc (que também não
 * teria como: só a PRÓXIMA injeção legitimamente o substitui).
 */
export function repeticoesRestantesEfetivas(doc: FilaTesteDoc, now: Date): number {
  if (doc.estado === "pendente" && testeExpirado(doc, now)) return 0;
  return doc.repeticoesRestantes;
}

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
  /**
   * Rascunho de ENSAIO gerado a partir do NÚMERO DE EXCEÇÃO (ver "Número de
   * exceção" em ARCHITECTURE.md) — `leadId` é o `leadContextoExcecao`
   * escolhido pelo operador, emprestado só para dar contexto ao prompt.
   * Ausente/`false` nos rascunhos normais (todo o histórico anterior a este
   * campo). SEMPRE `true` aqui nunca vira tarefa automática (mesmo com
   * `respostaAutomatica` ligado — ver `salvarRascunho`), nunca conta como a
   * "primeira resposta" do lead de contexto (`decidirAutomatica`) e nunca
   * aparece no painel manual de aprovação (`listarRespostasPendentes`) —
   * aquele lead não escreveu nada, e abrir o Business a partir dali mandaria
   * o ensaio para um número real.
   */
  teste?: boolean;
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
