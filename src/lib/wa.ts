/**
 * Link wa.me montado no cliente a partir de dados já persistidos — nenhuma
 * chamada externa. {nome} na mensagem padrão vira o nome do lead.
 */
export function buildWhatsAppLink(
  mensagemPadrao: string,
  nome: string,
  telefoneIntl: string,
): string {
  const mensagem = mensagemPadrao.replace(/\{nome\}/g, nome);
  const numero = telefoneIntl.replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
