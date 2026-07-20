export const MENSAGENS_COLLECTION = "mensagens";

export const MENSAGEM_TEXTO_MAX = 2000;

/**
 * Uma mensagem privada entre dois usuários (coleção /mensagens, um doc por
 * mensagem, ID = UUID). Texto simples, sem anexos. `lidaEm` é carimbada
 * quando o DESTINATÁRIO abre a conversa (GET com ?com= marca as recebidas).
 *
 * Privacidade: mensagem só é visível para deUserId e paraUserId — as rotas
 * escopam TODA leitura pela sessão, sem exceção para admin (papel dá
 * gestão de usuários, não acesso a conversa alheia).
 */
export interface Mensagem {
  /** Também é o ID do doc. */
  id: string;
  deUserId: string;
  paraUserId: string;
  texto: string;
  criadaEm: string;
  /** Ausente = ainda não lida pelo destinatário. */
  lidaEm?: string;
}

/** Resumo de uma conversa para a lista da página /mensagens. */
export interface ConversaResumo {
  comUserId: string;
  ultimaMensagem?: Mensagem;
  /** Mensagens recebidas DESTE usuário ainda sem lidaEm. */
  naoLidas: number;
}
