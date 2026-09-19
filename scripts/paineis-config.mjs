/**
 * Os ids dos painéis colapsáveis da /config, na ordem da tela.
 *
 * Cópia em `.mjs` de `src/components/config/registro.ts`, porque os laços
 * de verificação não compilam TypeScript — mesma razão (e mesmo risco) de
 * `ANCORAS_PADRAO`/`SECOES_POR_SKIN` nas capturas. **E é por isso que ela
 * tem teste de contrato** (`src/components/config/__tests__/registro.test.ts`):
 * um portão que não visita o painel novo passa sempre, e foi assim que as
 * quatro lancherias ficaram fora de três laços por uma rodada inteira.
 *
 * `nivel` distingue o painel de TOPO do bloco subordinado a um painel: o
 * aferidor do `--so=paineis` só cobra cabeçalho visível de primeiro nível
 * com a página recém-aberta — os de nível 3 estão dentro de um painel
 * fechado, e portanto escondidos junto com ele.
 */
export const PAINEIS_CONFIG = [
  { id: "usuarios", titulo: "Usuários", nivel: 2 },
  { id: "cotas-usuarios", titulo: "Cotas por usuário", nivel: 2 },
  { id: "metas-usuarios", titulo: "Metas por integrante", nivel: 2 },
  { id: "contexto-comercial", titulo: "Contexto comercial", nivel: 2 },
  { id: "fila-envio", titulo: "Fila de envio", nivel: 2 },
  { id: "fila-resposta-automatica", titulo: "Resposta automática", nivel: 3 },
  { id: "fila-visao", titulo: "O que vai acontecer", nivel: 3 },
  { id: "fila-disparo-teste", titulo: "Disparo de teste", nivel: 3 },
  { id: "fila-print-pendente", titulo: "Print pendente", nivel: 3 },
  { id: "respostas-pendentes", titulo: "Respostas pendentes", nivel: 2 },
  { id: "leads-sem-vestigio", titulo: "Leads sem vestígio", nivel: 2 },
  { id: "busca", titulo: "Busca", nivel: 2 },
  { id: "mensagem-padrao", titulo: "Mensagem padrão", nivel: 2 },
  { id: "operacao-diaria", titulo: "Operação diária", nivel: 2 },
  { id: "tetos-sku", titulo: "Tetos mensais por SKU", nivel: 2 },
  { id: "precos-cambio", titulo: "Preços e câmbio", nivel: 2 },
  { id: "precificacao", titulo: "Precificação", nivel: 2 },
  { id: "janelas-contato", titulo: "Faixas de contato por família", nivel: 2 },
  { id: "paises-prospeccao", titulo: "Países candidatos (tela Mundo)", nivel: 2 },
  { id: "frases", titulo: "Frases de prospecção por skin", nivel: 2 },
];

/** Só os de TOPO — os que a página mostra com tudo fechado. */
export const PAINEIS_CONFIG_TOPO = PAINEIS_CONFIG.filter((p) => p.nivel === 2);
