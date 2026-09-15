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

/**
 * Pacote Android do WhatsApp **Business**. O comum é `com.whatsapp`, e o
 * aparelho do operador tem OS DOIS instalados — é essa a razão de tudo que
 * vem abaixo existir. Um `wa.me` genérico neste aparelho abre o seletor de
 * aplicativo, ou o app errado, e o rascunho vai parar na conta pessoal.
 */
export const PACOTE_WHATSAPP_BUSINESS = "com.whatsapp.w4b";

/**
 * Link que abre a conversa no WhatsApp **Business** (e não no comum), com o
 * texto já preenchido. Android + navegador da família Chrome apenas — ver
 * `podeAbrirBusiness` abaixo, e `linkWhatsApp` para o caminho genérico.
 *
 * ## A forma, e de onde ela vem
 *
 * A integração que a própria WhatsApp documenta para Android é
 * `ACTION_VIEW` sobre `https://api.whatsapp.com/send?phone=…&text=…` com
 * `setPackage("com.whatsapp.w4b")`. Da web não há como chamar `setPackage`,
 * mas o Chrome no Android aceita a mesma coisa escrita como URI de intent
 * (a gramática de `Intent.parseUri`: o URI de dados, `#Intent;`, os campos
 * separados por `;`, `end`):
 *
 *     intent://api.whatsapp.com/send?phone=<dígitos>&text=<texto>
 *       #Intent;scheme=https;action=android.intent.action.VIEW;
 *       package=com.whatsapp.w4b;S.browser_fallback_url=<url>;end
 *
 * Preferido ao `whatsapp://send` de esquema próprio porque é EXATAMENTE a
 * mesma ação, o mesmo dado e o mesmo pacote que a integração documentada —
 * o esquema próprio funciona, mas é folclore.
 *
 * ## Os dois cuidados que decidem se isto funciona
 *
 * **A codificação do texto.** `encodeURIComponent` é obrigatório, e não só
 * pelas quebras de linha (que viram `%0A` e sobrevivem inteiras): ele
 * também escapa `#` → `%23` e `;` → `%3B`, que são precisamente os dois
 * caracteres que delimitam `#Intent;…;end`. Um rascunho com "#1" ou
 * "sinal; ok?" — texto comum numa negociação — cortaria o intent no meio e
 * a URL viraria outra coisa, provavelmente sem erro visível. Há teste que
 * remonta o URI pela gramática e confere que nenhum dos dois sobrevive cru.
 *
 * **O que acontece sem o Business instalado.** Sem `browser_fallback_url`,
 * o Chrome manda para a página do pacote na Play Store — resposta pronta,
 * operador na loja de aplicativos. Com ele, cai no `wa.me` de sempre: abre
 * o WhatsApp que houver (ou o seletor), que é pior que o Business e MUITO
 * melhor que a loja. O valor vai codificado porque `Intent.parseUri`
 * decodifica extras `S.` — e porque um `;` cru ali dentro encerraria o
 * campo no meio da URL.
 *
 * Sem telefone não há conversa para abrir: `undefined`, e a tela cai no
 * caminho de copiar o texto.
 */
export function linkWhatsAppBusinessAndroid(
  texto: string,
  telefoneIntl: string,
): string | undefined {
  const digitos = digitosTelefone(telefoneIntl);
  if (!digitos) return undefined;

  const textoCodificado = encodeURIComponent(texto);
  const dados = `api.whatsapp.com/send?phone=${digitos}&text=${textoCodificado}`;
  const reserva = encodeURIComponent(linkWhatsApp(texto, digitos));

  return (
    `intent://${dados}#Intent;scheme=https;action=android.intent.action.VIEW;` +
    `package=${PACOTE_WHATSAPP_BUSINESS};S.browser_fallback_url=${reserva};end`
  );
}

/**
 * O aparelho consegue abrir o Business por URI de intent? Só o Android: é o
 * único sistema em que `intent://` com `package=` existe. No desktop e no
 * iPhone o link não faria NADA — e botão que não faz nada em metade dos
 * casos é pior que botão ausente, então a tela troca a ação por copiar o
 * texto em vez de mostrar um botão morto.
 *
 * Checagem deliberadamente grosseira (a string do agente), porque é a única
 * que existe: não há como perguntar ao navegador se ele resolve `intent://`
 * sem tentar navegar. Erra para o lado seguro — um Android com navegador
 * que não seja da família Chrome cai no `browser_fallback_url` do link
 * acima, que é o `wa.me` de sempre, nunca um beco sem saída.
 */
export function podeAbrirBusiness(userAgent: string): boolean {
  return /android/i.test(userAgent);
}
