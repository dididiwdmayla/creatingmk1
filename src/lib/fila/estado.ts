/**
 * A forma e a política da fila de envio, SEM nada de servidor — este módulo
 * é importado pela ficha do lead, que é um componente client. `envios.ts`,
 * que é o dono das transações, importa `node:crypto` para cunhar o claimId;
 * arrastá-lo para o navegador por causa de uma constante quebraria o bundle.
 */

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
