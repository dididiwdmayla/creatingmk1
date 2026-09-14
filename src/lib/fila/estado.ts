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
