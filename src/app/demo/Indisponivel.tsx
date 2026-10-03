import type { Metadata, Viewport } from "next";

/**
 * A página NEUTRA de `/demo/{leadId}` quando o lead existe mas a demo não
 * existe mais — apagada pela varredura das demos automáticas vencidas (ver
 * "Expiração das demos automáticas" em ARCHITECTURE.md) ou pelo "Excluir
 * demo" da ficha. Responde 200: o link pode estar numa conversa, e quem o
 * abre não pode cair num erro.
 *
 * Neutra de propósito: sem skin, sem o nome do negócio (a página não tem
 * mais o que mostrar dele) e sem a identidade do Radar — e no tema claro
 * ou escuro do SISTEMA de quem abre (`prefers-color-scheme`), porque não há
 * tema de marca nem de usuário a seguir. CSS próprio, inline, nenhum token
 * da plataforma: o `<body>` do layout raiz usa os do app, e a regra com
 * `:has` cobre também o fundo que aparece no repique da rolagem.
 *
 * O texto sai no idioma do país do lead (`idiomaPadraoDoLead`) — a demo
 * dele também saía; o que não estiver no mapa cai no português.
 */

interface TextoIndisponivel {
  titulo: string;
  texto: string;
}

const TEXTOS: Record<string, TextoIndisponivel> = {
  pt: {
    titulo: "Esta demonstração não está mais disponível.",
    texto: "Se você recebeu este link numa conversa, é só responder por lá.",
  },
  "pt-PT": {
    titulo: "Esta demonstração já não está disponível.",
    texto: "Se recebeu esta ligação numa conversa, basta responder por lá.",
  },
  es: {
    titulo: "Esta demostración ya no está disponible.",
    texto: "Si recibiste este enlace en una conversación, solo responde por ahí.",
  },
  en: {
    titulo: "This demo is no longer available.",
    texto: "If you got this link in a conversation, just reply there.",
  },
  fr: {
    titulo: "Cette démonstration n’est plus disponible.",
    texto: "Si vous avez reçu ce lien dans une conversation, répondez simplement par là.",
  },
  de: {
    titulo: "Diese Demo ist nicht mehr verfügbar.",
    texto: "Wenn Sie diesen Link in einem Gespräch erhalten haben, antworten Sie einfach dort.",
  },
  it: {
    titulo: "Questa demo non è più disponibile.",
    texto: "Se hai ricevuto questo link in una conversazione, rispondi pure lì.",
  },
  nl: {
    titulo: "Deze demo is niet meer beschikbaar.",
    texto: "Heb je deze link in een gesprek ontvangen? Antwoord daar gewoon.",
  },
};

/** O texto no idioma pedido: a variante exata, depois o idioma base, depois o português. */
export function textoIndisponivel(idioma: string): TextoIndisponivel & { lang: string } {
  if (TEXTOS[idioma]) return { ...TEXTOS[idioma], lang: idioma };
  const base = idioma.split("-")[0];
  if (TEXTOS[base]) return { ...TEXTOS[base], lang: idioma };
  return { ...TEXTOS.pt, lang: "pt-BR" };
}

const CLARO = { fundo: "#f5f4f0", tinta: "#1c1b18", apoio: "#5f5c55", fio: "#dedbd3" };
const ESCURO = { fundo: "#151513", tinta: "#ecebe6", apoio: "#a39f97", fio: "#34322d" };

const CSS = `
body:has(.demo-indisponivel) { background: ${CLARO.fundo}; }
.demo-indisponivel {
  color-scheme: light dark;
  box-sizing: border-box;
  min-height: 100dvh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: ${CLARO.fundo};
  color: ${CLARO.tinta};
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
.demo-indisponivel .caixa {
  max-width: 26rem;
  text-align: center;
  border-top: 1px solid ${CLARO.fio};
  padding-top: 20px;
}
.demo-indisponivel h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
  text-wrap: balance;
}
.demo-indisponivel p {
  margin: 12px 0 0;
  font-size: 0.95rem;
  line-height: 1.55;
  color: ${CLARO.apoio};
  text-wrap: balance;
}
@media (prefers-color-scheme: dark) {
  body:has(.demo-indisponivel) { background: ${ESCURO.fundo}; }
  .demo-indisponivel { background: ${ESCURO.fundo}; color: ${ESCURO.tinta}; }
  .demo-indisponivel .caixa { border-top-color: ${ESCURO.fio}; }
  .demo-indisponivel p { color: ${ESCURO.apoio}; }
}
`;

export function DemoIndisponivel({ idioma }: { idioma: string }) {
  const { titulo, texto, lang } = textoIndisponivel(idioma);
  return (
    <main className="demo-indisponivel" lang={lang} data-demo="indisponivel">
      <style>{CSS}</style>
      <div className="caixa">
        <h1>{titulo}</h1>
        <p>{texto}</p>
      </div>
    </main>
  );
}

/** Sem imagem de prévia (a da demo não existe mais) e nunca indexada. */
export function metadataIndisponivel(idioma: string): Metadata {
  const { titulo } = textoIndisponivel(idioma);
  return { title: titulo.replace(/\.$/, ""), robots: { index: false, follow: false } };
}

/** A barra do navegador acompanha o fundo, nos dois esquemas. */
export function viewportIndisponivel(): Viewport {
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: CLARO.fundo },
      { media: "(prefers-color-scheme: dark)", color: ESCURO.fundo },
    ],
  };
}
