/**
 * Link wa.me montado no cliente a partir de dados já persistidos — nenhuma
 * chamada externa. Variáveis da mensagem padrão: {nome} vira o nome do
 * lead; {demo} vira o link da demo pública (quando fornecido).
 */
export function buildWhatsAppLink(
  mensagemPadrao: string,
  nome: string,
  telefoneIntl: string,
  demoUrl?: string,
): string {
  let mensagem = mensagemPadrao.replace(/\{nome\}/g, nome);
  if (demoUrl !== undefined) {
    mensagem = mensagem.replace(/\{demo\}/g, demoUrl);
  }
  const numero = telefoneIntl.replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
