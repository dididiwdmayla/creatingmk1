/**
 * Período de contagem mensal em UTC ("2026-07").
 *
 * O reset da cota grátis do Google segue o fuso da conta de billing;
 * para um teto de segurança, algumas horas de deriva são irrelevantes,
 * e UTC evita bugs de horário de verão.
 */
export function periodKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
