/**
 * Deslocamento UTC (minutos) do fuso do NAVEGADOR de quem está logado, AGORA
 * — usado só para mostrar, ao lado da hora local do lead, a hora
 * equivalente de quem vai fazer o contato (ver "Barra do dia" em
 * ARCHITECTURE.md). `Date.getTimezoneOffset()` já resolve o horário de
 * verão sozinho para o fuso onde o navegador está rodando — sem tabela
 * paralela a manter aqui, ao contrário do fallback fixo por PAÍS de
 * `utcOffsetPais.ts` (esse é só para quando falta o dado do LEAD).
 */
export function offsetUsuarioMinutos(now: Date = new Date()): number {
  return -now.getTimezoneOffset();
}
