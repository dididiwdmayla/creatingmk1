/**
 * Contrato do registro de ESTILOS de borda LED (camada de micro-interação
 * `Theme.led`/`Theme.ledEstilo`) — mesmo padrão do registro de efeitos
 * (`../efeitos/registry.ts`): metadado puro (id/nome/nichos), sem o
 * componente, pra quem só precisa listar estilos (ex.: o seletor "Estilo do
 * LED" do editor) nunca puxar código nenhum. O componente em si
 * (`../led/LedEdges.tsx`) é único e sempre montado — troca de visual é só
 * CSS por atributo (`data-d-led-estilo`), sem import dinâmico por estilo
 * (ao contrário dos efeitos de fundo, o LED é leve o bastante pra não
 * precisar de code-splitting por variante).
 */
export interface LedEstiloDefinition {
  id: string;
  /** Nome legível (ex.: "Dissipado"). */
  nome: string;
  /** Nichos (ids de SkinDefinition.nicho) recomendados para este estilo. */
  nichosRecomendados: readonly string[];
}
