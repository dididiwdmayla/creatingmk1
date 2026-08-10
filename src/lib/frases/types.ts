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
 * Conjunto de frases de abordagem de UMA SKIN do registro, com o contador
 * de rotação COMPARTILHADO: um contador por skin, valendo para todos os
 * leads que usam aquela skin e para todos os membros do time.
 *
 * Persistido em /frasesProspeccao/{skinId} — ver "Frases de prospecção por
 * skin" no ARCHITECTURE.md. A chave é o **id da skin registrada**, nunca o
 * texto do nicho digitado na busca: texto livre gerava um conjunto novo a
 * cada grafia ("Barbearia", "barbearia old school", "barbería").
 *
 * As frases usam os MESMOS marcadores da mensagem global e da mensagem por
 * grupo ({nome}, {demo}, {penetracao}); nenhum marcador novo existe.
 */
export interface FrasesProspeccao {
  /** Id da skin no registro (`lib/demos/registry.ts`) — é também o id do doc. */
  skinId: string;
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
  /** Ausente = conjunto nunca salvo (sintetizado vazio para uma skin nova). */
  atualizadoEm?: string;
}

/**
 * Um doc LEGADO da coleção: os que a versão anterior criava chaveados pelo
 * texto do nicho digitado na busca (mais o antigo `__genericas__`). Não
 * casam com skin nenhuma, então não aparecem na tela — existem só para a
 * migração aproveitar o texto já escrito. Ver ./migracao.ts.
 */
export interface EntradaLegada {
  /** Id do doc como está no Firestore (o nicho normalizado de antes). */
  chave: string;
  /** Grafia de exibição do nicho, como o doc antigo guardava. */
  nicho: string;
  frases: string[];
}

/** Uma entrada legada levada para o conjunto de uma skin. */
export interface MigracaoFeita {
  chave: string;
  nicho: string;
  skinId: string;
  skinNome: string;
}

/** Uma entrada legada que a migração NÃO soube associar — com o texto junto, para copiar à mão. */
export interface MigracaoPendente {
  chave: string;
  nicho: string;
  frases: string[];
  motivo: string;
}

/** Relatório do POST /api/frases/migrar (e a prévia do GET, com `feitas` vazio). */
export interface RelatorioMigracao {
  feitas: MigracaoFeita[];
  pendentes: MigracaoPendente[];
  /** Entradas legadas sem nenhum texto: apagadas sem relatório (não havia o que preservar). */
  vazias: number;
}

/**
 * O conjunto + a identidade da skin, como a tela de administração precisa.
 * Montado no SERVIDOR (`montarConjuntos`) porque o registro de skins arrasta
 * os componentes das 8 skins junto — `/config` não pode importá-lo só para
 * ler nome e nicho.
 */
export interface ConjuntoSkin extends FrasesProspeccao {
  /** Nome de exibição da skin no registro ("Barbearia Sul"). */
  skinNome: string;
  /** Nicho da skin no registro ("barbearia") — só rótulo, nunca chave. */
  nicho: string;
}
