export const FRASES_COLLECTION = "frasesProspeccao";

/**
 * Quantidade de slots de frase por conjunto. Fixo em 3 por decisão de
 * produto (rotação 1→2→3→1) — slot vazio é legítimo e simplesmente não
 * entra na rotação (ver `frasesEfetivas` em ./rotacao.ts).
 */
export const FRASES_SLOTS = 3;

/** Teto por frase — mesma ordem de grandeza da mensagem por grupo (≤1000). */
export const FRASE_MAX = 1000;

/**
 * ID do doc do conjunto GENÉRICO de fallback, na mesma coleção dos nichos.
 * Um doc por nicho + este: assim rotação, edição e leitura têm um único
 * caminho de código. Um nicho cuja forma normalizada bata este id é
 * rejeitado na escrita (ver `validarConjuntoPatch`) — sem isso, um nicho
 * chamado "__genericas__" sobrescreveria o conjunto de fallback.
 */
export const CHAVE_GENERICAS = "__genericas__";

/**
 * Conjunto de frases de abordagem de UM nicho (ou o genérico de fallback),
 * com o contador de rotação COMPARTILHADO: um só contador por nicho, valendo
 * para todos os leads e todos os membros do time.
 *
 * Persistido em /frasesProspeccao/{chave} — ver "Frases de prospecção por
 * nicho" no ARCHITECTURE.md. As frases usam os MESMOS marcadores da mensagem
 * global e da mensagem por grupo ({nome}, {demo}, {penetracao}); nenhum
 * marcador novo existe.
 */
export interface FrasesProspeccao {
  /**
   * Grafia de exibição do nicho, como veio da busca (não normalizada) — a
   * chave do doc é que é normalizada. String vazia no conjunto genérico.
   */
  nicho: string;
  /**
   * Sempre `FRASES_SLOTS` posições; slot vazio = não preenchido. Guardar os
   * slots vazios (em vez de compactar a lista) mantém a numeração estável na
   * tela de administração: "frase 2" é sempre o segundo campo.
   */
  frases: string[];
  /**
   * Contador de rotação. Avança SÓ no clique do botão de enviar pro WhatsApp
   * (abrir a ficha, copiar ou editar não avançam). Incremento otimista, sem
   * transação: dois envios simultâneos podem repetir uma frase, e isso é
   * aceitável — o custo de uma trava não se paga aqui.
   */
  indice: number;
  /** Ausente = conjunto nunca salvo (sintetizado vazio para um nicho novo). */
  atualizadoEm?: string;
}
