/**
 * Link wa.me montado no cliente a partir de dados já persistidos — nenhuma
 * chamada externa. Variáveis da mensagem padrão: {nome} vira o nome do
 * lead; {demo} vira o link da demo pública; {penetracao} vira a linha de
 * argumento pronta (src/lib/leads/penetracao.ts) — cada uma só é
 * substituída quando o valor correspondente é fornecido (ausência de
 * dado nunca apaga a variável em silêncio).
 */
export function buildWhatsAppLink(
  mensagemPadrao: string,
  nome: string,
  telefoneIntl: string,
  extras: { demoUrl?: string; penetracao?: string } = {},
): string {
  let mensagem = mensagemPadrao.replace(/\{nome\}/g, nome);
  if (extras.demoUrl !== undefined) {
    mensagem = mensagem.replace(/\{demo\}/g, extras.demoUrl);
  }
  if (extras.penetracao !== undefined) {
    mensagem = mensagem.replace(/\{penetracao\}/g, extras.penetracao);
  }
  const numero = telefoneIntl.replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
