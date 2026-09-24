import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";

import { appPassword, lerSessaoToken, SESSION_COOKIE } from "@/lib/auth";
import { classificarVisitaInterna, DEVICE_COOKIE } from "@/lib/device";
import { BarraNavegador } from "@/lib/demos/barra/BarraNavegador";
import { barraModoEfetivo, corDaBarra } from "@/lib/demos/barra/modos";
import { cssPlanoDaPagina } from "@/lib/demos/barra/plano";
import { montarDemoDataAvulsa } from "@/lib/demos/avulsas/identidade";
import { CAPTURA_HEADER } from "@/lib/demos/capturas/seguranca.mjs";
import type { CapturaComposta } from "@/lib/demos/capturas/estado";
import { PREVIA_ALTURA, PREVIA_LARGURA } from "@/lib/demos/capturas/previa.mjs";
import { resolverCamadaEfeito } from "@/lib/demos/efeitos/camada";
import { EfeitoCamada } from "@/lib/demos/efeitos/EfeitoCamada";
import { resolverEfeitoFundo } from "@/lib/demos/efeitos/registry";
import { fontesEscolhidas } from "@/lib/demos/fontes";
import { montarDemoData } from "@/lib/demos/montar";
import { getSkin, getTheme } from "@/lib/demos/registry";
import { aplicarTema } from "@/lib/demos/tema";
import { exemploDaSkin, temaCalibrado, varianteEfetiva } from "@/lib/demos/variantes";
import type { LeadDemo } from "@/lib/demos/types";
import type { AppDb } from "@/lib/firestore-like";
import type { Lead } from "@/lib/leads/types";
import { compararEmTempoConstante } from "@/lib/seguranca";
import { getUsuario } from "@/lib/usuarios/repo";

import { demoCoreFontsClassName, resolveExtraFontClassNames } from "./fonts";
import { SeloVisitaInterna } from "./SeloVisitaInterna";
import { VisitaTracker } from "./VisitaTracker";

/**
 * A PARTE COMUM das duas rotas públicas de demo: `/demo/{leadId}` (a demo
 * de um lead) e `/demo/avulsa/{id}` (a demo sem lead associado).
 *
 * A única diferença entre elas é de ONDE vem a configuração e se existe a
 * camada de dados do negócio (`dadosDoLead`). Tudo o mais — resolução de
 * skin/tema/fontes/efeito, cartão de conversa, cor da barra, selo de
 * visita interna e o rastreio de abertura — é idêntico, e por isso mora
 * aqui: duas cópias divergem no primeiro ajuste que alguém faz numa só.
 */

/** O que uma rota pública precisa saber sobre a demo que vai servir. */
export interface FonteDemo {
  /** Id na URL pública (Place ID do lead ou UUID da avulsa). */
  id: string;
  avulsa: boolean;
  demo: LeadDemo;
  /**
   * O lead, quando existe — é ele que traz a camada `dadosDoLead` da
   * montagem. Ausente na avulsa: a identidade dela já está em `demo.dados`
   * (ver lib/demos/avulsas/identidade.ts).
   */
  lead?: Lead;
  idioma: string;
  moeda: string;
  /** Nome do negócio — título do cartão de conversa e da prévia de reserva. */
  nome: string;
  /** Prévia já composta no Storage, quando as capturas já rodaram. */
  previa?: CapturaComposta;
}

export type DemoResolvida = NonNullable<Awaited<ReturnType<typeof resolverDemo>>>;

/**
 * A intro é suprimida quando o header de captura bate com `CAPTURA_SECRET`
 * — ver "Intro e captura" em ARCHITECTURE.md. Função PURA (não lê
 * `headers()` sozinha) de propósito: assim o fail-closed e o caminho feliz
 * se testam sem precisar mockar `next/headers` — ver
 * __tests__/comum.test.tsx.
 *
 * **Fail-closed**: sem `CAPTURA_SECRET` configurada no servidor, o header
 * é ignorado (mesmo que alguém mande um valor) e a intro renderiza como
 * sempre. O header só desliga uma animação — vazá-lo não dá acesso a nada,
 * mas ele nunca é ecoado em resposta, log ou print daqui pra frente.
 */
export function introSuprimidaPelaCaptura(
  headerRecebido: string | null,
  segredoConfigurado: string | undefined,
): boolean {
  if (!segredoConfigurado || !headerRecebido) return false;
  return compararEmTempoConstante(headerRecebido, segredoConfigurado);
}

/**
 * Skin, tema, conteúdo, fontes e camada decorativa a partir da fonte.
 * `undefined` quando a skin salva saiu do registro — a rota responde 404,
 * mesmo tratamento de "demo não existe".
 */
export async function resolverDemo(fonte: FonteDemo) {
  const skin = getSkin(fonte.demo.skinId);
  if (!skin) return undefined;
  if (skin.localeFixo) fonte={...fonte,...skin.localeFixo};

  const temaBase = aplicarTema(
    getTheme(skin, fonte.demo.themeId),
    fonte.demo.tema,
    skin.heroEscalaLimites,
  );
  // Decisão da camada de RESOLUÇÃO, nada gravado no banco — mesma
  // filosofia de SKINS_MIGRADAS/EFEITOS_MIGRADOS: a skin nunca sabe que
  // captura existe, só o `theme.intro` que chega até ela muda.
  const h = await headers();
  const theme = introSuprimidaPelaCaptura(h.get(CAPTURA_HEADER), process.env.CAPTURA_SECRET)
    ? { ...temaBase, intro: false }
    : temaBase;
  // A ÚNICA bifurcação de conteúdo entre as duas famílias: com lead, a
  // camada `dadosDoLead` entra no meio; sem ele, a identidade em branco
  // toma o lugar dela (nada de texto de template se passando por dado do
  // negócio numa página pública).
  // Camada 1 da montagem: o exemplo da VARIANTE escolhida (skin sem
  // variantes devolve o demoDataExemplo de sempre) — ver lib/demos/variantes.ts.
  const exemplo = exemploDaSkin(skin, fonte.demo.themeId);
  const data = fonte.lead
    ? montarDemoData(exemplo, fonte.lead, fonte.demo.dados, skin.id)
    : montarDemoDataAvulsa(exemplo, fonte.demo.dados, skin.id);

  // Só busca (import dinâmico) as fontes curadas que o editor de fato
  // escolheu — o resto da lista nunca chega a ser fetched pelo cliente.
  // Skin de tema calibrado traz a própria folha de fontes (Tema.folhaFontes):
  // buscar as fontes curadas da Forja só baixaria família que ela não usa.
  const extraFontClassName = temaCalibrado(skin)
    ? ""
    : await resolveExtraFontClassNames(fontesEscolhidas(fonte.demo.tema));

  // Fontes DEFAULT da VARIANTE ativa (opt-in — ver SkinDefinition.fontesVariante):
  // import dinâmico por variante, então só o par de .woff2 da variante deste
  // lead entra no HTML desta requisição.
  const varianteFontClassName = skin.fontesVariante
    ? await skin.fontesVariante(fonte.demo.themeId)
    : "";

  // Efeito de fundo (registro de efeitos) + intensidade — undefined cobre
  // tanto "nenhum" quanto um id que não existe mais no registro. Nunca deve
  // derrubar a demo: um efeito é decoração opcional.
  let efeitoFundo: ReturnType<typeof resolverEfeitoFundo> | undefined;
  try {
    efeitoFundo = resolverEfeitoFundo(
      theme.fundoEfeito,
      fonte.demo.tema?.fundoEfeitoIntensidade,
      skin.nicho,
    );
  } catch (error) {
    console.error("[radar] falha ao resolver o efeito de fundo da demo:", error);
  }

  // Cores da camada decorativa: modo de cor (vale pra qualquer efeito) ←
  // cores da aura (controle anterior, só no modo "tema") ← paleta do tema.
  const camada = resolverCamadaEfeito({
    paleta: theme.paleta,
    efeitoId: efeitoFundo?.efeito.id,
    efeitoCores: theme.efeitoCores,
    auraCores: fonte.demo.tema?.auraCores,
    // Veredito do portão de fps POR CÉLULA (variante × modo de cor).
    modosReprovados: varianteEfetiva(skin, fonte.demo.themeId)?.modosDeCorReprovados,
  });

  // `await` AQUI, antes de montar qualquer elemento: `PaginaDemo` (abaixo)
  // continua um componente síncrono comum — Suspense em streaming SSR
  // resolveria a troca via um <script> que só um navegador executa, e a
  // captura de tela / prévia do link não rodam JavaScript nenhum (ver o
  // comentário de `SkinDefinition.componente` em lib/demos/types.ts).
  const Componente = await skin.componente();

  return { skin, theme, data, extraFontClassName, varianteFontClassName, efeitoFundo, camada, fonte, Componente };
}

/**
 * Endereço absoluto desta instalação, montado dos cabeçalhos da requisição.
 *
 * O `og:image` precisa ser absoluto — cliente de mensagens não resolve
 * caminho relativo. Sai dos cabeçalhos em vez de uma variável de ambiente
 * porque a rota já é `force-dynamic` e assim o link funciona igual em
 * produção, em preview de deploy e em desenvolvimento, sem configurar nada.
 */
export async function origemDaRequisicao(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

/**
 * METADADOS DO CARTÃO DE CONVERSA. Título e descrição saem do conteúdo da
 * própria demo; a imagem é a prévia composta pelo motor de capturas (ver
 * `capturas/previa.mjs`).
 *
 * A imagem aponta DIRETO para o Storage quando existe: é um arquivo
 * pronto, servido pela CDN, e o buscador de prévia do WhatsApp não executa
 * JavaScript e desiste depressa. Enquanto ela não existe (demo recém-salva,
 * capturas ainda não rodadas), o endereço é o do recurso de RESERVA
 * (`{caminho}/previa`), nunca nada: um cartão sem imagem é pior que um
 * cartão simples.
 */
export async function metadataDaDemo(
  resolvida: DemoResolvida | undefined,
  caminhoPrevia: string,
): Promise<Metadata> {
  if (!resolvida) return { title: "Demo" };

  const { data, fonte } = resolvida;
  const titulo = data.slogan ? `${data.nome} — ${data.slogan}` : data.nome;
  const descricao = data.secoes.hero?.texto;
  const imagem = fonte.previa
    ? { url: fonte.previa.url, width: fonte.previa.largura, height: fonte.previa.altura }
    : {
        url: `${await origemDaRequisicao()}${caminhoPrevia}`,
        width: PREVIA_LARGURA,
        height: PREVIA_ALTURA,
      };

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      type: "website",
      images: [{ ...imagem, alt: `${data.nome} — prévia do site` }],
    },
    // Sem isto o cartão sai com a imagem em miniatura quadrada, e o nome
    // do negócio (que é o que a composição existe pra mostrar) fica
    // pequeno demais para ler.
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descricao,
      images: [imagem.url],
    },
    // Prévia de prospecção: nunca indexar.
    robots: { index: false, follow: false },
  };
}

/**
 * theme-color da barra do navegador — cada demo pública tem sua própria
 * cor de marca, não a do app (ver "Barra do navegador" em ARCHITECTURE.md).
 *
 * A cor sai PRONTA daqui, no HTML do servidor, em todos os modos de
 * `Theme.barraCor` — inclusive no `automatico`, em que ela é a cor de
 * partida (o topo da página). É o que faz a feature degradar sozinha.
 */
export function viewportDaDemo(resolvida: DemoResolvida | undefined): Viewport {
  return resolvida ? { themeColor: corDaBarra(resolvida.theme) } : {};
}

export interface VisitanteInterno {
  /**
   * Sessão válida do app OU marcador de dispositivo (ver lib/device.ts) —
   * alguém do time (preview/QA), não o lead de verdade. A sessão sozinha
   * falha sempre que o navegador que abre o link não é o mesmo/não manda o
   * cookie httpOnly (ex.: navegador embutido de um app, segunda aba sem
   * sessão, sessão expirada) mesmo sendo um dispositivo do time — o
   * marcador cobre esse caso, sobrevivendo bem além da sessão.
   */
  interna: boolean;
  /** Nome de quem está logado — só quando a SESSÃO (não só o marcador) é válida. */
  nomeUsuario?: string;
}

/**
 * Classificação de "interna" (usada tanto pro tracking quanto pelo selo
 * "Vendo como membro") + o nome de quem está logado, quando dá pra saber.
 * Decisão sempre no servidor. Qualquer falha na resolução (Firestore fora
 * do ar, cookie corrompido etc.) cai no lado seguro — `interna: false`.
 */
export async function visitanteInterno(db: AppDb): Promise<VisitanteInterno> {
  try {
    const jar = await cookies();
    const sessionCookie = jar.get(SESSION_COOKIE)?.value;
    const deviceCookie = jar.get(DEVICE_COOKIE)?.value;
    const interna = await classificarVisitaInterna({ sessionCookie, deviceCookie });
    if (!interna) return { interna: false };

    const secret = appPassword();
    const sessao = secret ? await lerSessaoToken(sessionCookie, secret) : null;
    if (!sessao) return { interna: true };
    const usuario = await getUsuario(db, sessao.userId);
    const nomeUsuario =
      usuario && usuario.ativo && usuario.sessao === sessao.versao ? usuario.nome : undefined;
    return { interna: true, nomeUsuario };
  } catch (error) {
    console.error("[radar] falha ao classificar visitante interno:", error);
    return { interna: false };
  }
}

/**
 * Cabeçalhos de geolocalização por IP que a Vercel injeta em produção
 * (`x-vercel-ip-*` — ausentes em dev/self-host). Só INFORMATIVO na timeline
 * da ficha — nunca entra na classificação de interna/externa.
 */
export async function geoDaVisita(): Promise<
  { pais?: string; regiao?: string; cidade?: string } | undefined
> {
  const h = await headers();
  const pais = h.get("x-vercel-ip-country") ?? undefined;
  const regiao = h.get("x-vercel-ip-country-region") ?? undefined;
  const cidadeRaw = h.get("x-vercel-ip-city") ?? undefined;
  const cidade = cidadeRaw ? decodeURIComponent(cidadeRaw) : undefined;
  console.log("[radar] cabeçalhos de geolocalização da visita:", { pais, regiao, cidade });
  if (!pais && !regiao && !cidade) return undefined;
  return { pais, regiao, cidade };
}

/** A árvore da demo pública — idêntica nas duas rotas. */
export function PaginaDemo({
  resolvida,
  visitante,
  visitaId,
}: {
  resolvida: DemoResolvida;
  visitante: VisitanteInterno;
  visitaId?: string;
}) {
  const { theme, data, extraFontClassName, varianteFontClassName, efeitoFundo, camada, fonte, Componente } = resolvida;
  return (
    <div className={`${theme.lancheria ? "" : demoCoreFontsClassName} ${extraFontClassName} ${varianteFontClassName}`}>
      {/*
        O layout raiz fixa <html lang="pt-BR"> (compartilhado por todo o
        app — Radar é uma ferramenta interna em pt-BR). A demo pública é a
        ÚNICA rota cujo idioma de CONTEÚDO varia por demo (ver "Idioma da
        IA na demo"): este script síncrono ajusta o atributo antes do resto
        da página pintar, mesmo padrão do THEME_INIT em app/layout.tsx.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(fonte.idioma)}`,
        }}
      />
      {/*
        Plano da página na cor da demo — ver lib/demos/barra/plano.ts. É
        de onde o Safari 26+ amostra a cor da barra (a meta `theme-color`
        deixou de tintar a aba lá) e o que aparece no rubber-band do
        overscroll em qualquer navegador.
      */}
      <style>{cssPlanoDaPagina(corDaBarra(theme))}</style>
      <Componente data={data} theme={theme} idioma={fonte.idioma} moeda={fonte.moeda} />
      {efeitoFundo && (
        // EfeitoCamada (client component) resolve E renderiza o efeito —
        // nunca chamar getEfeitoComponenteDinamico direto aqui: é uma
        // função comum exportada de um módulo "use client", e invocá-la
        // como função (fora de JSX) a partir deste Server Component lança
        // em runtime, derrubando a rota pública inteira.
        <EfeitoCamada
          id={efeitoFundo.efeito.id}
          intensidade={efeitoFundo.intensidade}
          cores={camada.cores}
          coresCss={camada.coresCss}
          coresAnimacao={camada.coresAnimacao}
        />
      )}
      {barraModoEfetivo(theme) === "automatico" && (
        // Só no modo automático: nos modos fixos a cor já saiu no
        // `generateViewport` e não há nada pra acompanhar.
        <BarraNavegador corInicial={corDaBarra(theme)} />
      )}
      {visitante.interna && <SeloVisitaInterna nomeUsuario={visitante.nomeUsuario} />}
      {visitaId && <VisitaTracker id={fonte.id} avulsa={fonte.avulsa} visitaId={visitaId} />}
    </div>
  );
}
