/**
 * Marcadores da mensagem de WhatsApp — os MESMOS na mensagem global, na
 * mensagem por grupo e nas frases de prospecção por skin (não existe
 * marcador exclusivo de nenhuma das três): {nome} vira o nome do lead;
 * {demo} vira o link da demo pública; {penetracao} vira a linha de argumento
 * pronta (src/lib/leads/penetracao.ts).
 *
 * Cada um só é substituído quando o valor correspondente é fornecido —
 * ausência de dado nunca apaga a variável em silêncio. Aplicar duas vezes é
 * inofensivo: depois da primeira não sobra marcador para substituir.
 */
export const MARCADORES = ["{nome}", "{demo}", "{penetracao}"] as const;

export function aplicarMarcadores(
  mensagem: string,
  nome: string,
  extras: { demoUrl?: string; penetracao?: string } = {},
): string {
  let texto = mensagem.replace(/\{nome\}/g, nome);
  if (extras.demoUrl !== undefined) {
    texto = texto.replace(/\{demo\}/g, extras.demoUrl);
  }
  if (extras.penetracao !== undefined) {
    texto = texto.replace(/\{penetracao\}/g, extras.penetracao);
  }
  return texto;
}

/**
 * Dígitos puros (DDI + número) a partir do texto CRU que o Google devolve
 * em `telefoneIntl` (com espaços, parênteses e traços — ex.: "+55 44
 * 3222-1111"). Extraído de `linkWhatsApp` para ser reaproveitado também no
 * servidor (ver `@/lib/fila/mensagem`), sem duplicar a limpeza.
 */
export function digitosTelefone(telefoneIntl: string): string {
  return telefoneIntl.replace(/\D/g, "");
}

/**
 * Link wa.me a partir de um texto JÁ PRONTO (marcadores resolvidos) — é o
 * que a ficha usa depois de você editar a frase à mão na caixa de texto.
 * Montado no cliente sobre dados já persistidos: nenhuma chamada externa.
 */
export function linkWhatsApp(texto: string, telefoneIntl: string): string {
  return `https://wa.me/${digitosTelefone(telefoneIntl)}?text=${encodeURIComponent(texto)}`;
}

/** Substituição + link num passo só — o caminho de quem não edita o texto. */
export function buildWhatsAppLink(
  mensagemPadrao: string,
  nome: string,
  telefoneIntl: string,
  extras: { demoUrl?: string; penetracao?: string } = {},
): string {
  return linkWhatsApp(aplicarMarcadores(mensagemPadrao, nome, extras), telefoneIntl);
}
