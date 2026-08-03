import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { appPassword, lerSessaoToken, SESSION_COOKIE } from "@/lib/auth";
import { classificarVisitaInterna, DEVICE_COOKIE } from "@/lib/device";
import { resolverCamadaEfeito } from "@/lib/demos/efeitos/camada";
import { EfeitoCamada } from "@/lib/demos/efeitos/EfeitoCamada";
import { resolverEfeitoFundo } from "@/lib/demos/efeitos/registry";
import { TOKEN_QUERY_PARAM } from "@/lib/demos/envio";
import { idiomaEfetivoDemo } from "@/lib/demos/idioma";
import { moedaDaDemo } from "@/lib/demos/moeda";
import { getSkin, getTheme } from "@/lib/demos/registry";
import { montarDemoData } from "@/lib/demos/montar";
import { aplicarTema } from "@/lib/demos/tema";
import type { AppDb } from "@/lib/firestore-like";
import { getDb } from "@/lib/firebase/admin";
import { getLead, registrarVisitaDemo } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";
import { getUsuario } from "@/lib/usuarios/repo";
import { demoCoreFontsClassName, resolveExtraFontClassNames } from "../fonts";
import { SeloVisitaInterna } from "../SeloVisitaInterna";
import { VisitaTracker } from "../VisitaTracker";

/**
 * Rota PÚBLICA da demo de um lead (a única fora da proteção por senha —
 * ver src/proxy.ts). Server Component: lê o lead direto do Firestore e
 * monta o DemoData (exemplo do template ← dados do lead ← edições do
 * editor). Nenhuma chamada ao Google acontece aqui — só Firestore.
 *
 * A demo só existe DEPOIS de salva no editor (/leads/{id}/demo/editar):
 * lead sem `demo` responde 404 — mesma resposta de lead inexistente, e o
 * que "Excluir demo" restaura. Nada é publicado sem intenção explícita.
 */

// Sempre por request: a demo reflete a última edição da ficha na hora.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function loadDemo(leadId: string) {
  const lead: Lead | undefined = await getLead(getDb(), leadId);
  if (!lead?.demo) return undefined;
  const skin = getSkin(lead.demo.skinId);
  if (!skin) return undefined;
  const theme = aplicarTema(getTheme(skin, lead.demo.themeId), lead.demo.tema, skin.heroEscalaLimites);
  const data = montarDemoData(skin.demoDataExemplo, lead, lead.demo.dados, skin.id);
  const idioma = idiomaEfetivoDemo(lead);
  const moeda = moedaDaDemo(lead);
  // Só busca (import dinâmico) as fontes curadas que o editor de fato
  // escolheu — o resto da lista nunca chega a ser fetched pelo cliente.
  const extraFontClassName = await resolveExtraFontClassNames([
    lead.demo.tema?.fonteDisplay,
    lead.demo.tema?.fonteCorpo,
  ]);
  // Efeito de fundo (registro de efeitos) + intensidade — undefined cobre
  // tanto "nenhum" quanto um id que não existe mais no registro. Nunca deve
  // derrubar a demo: um efeito é decoração opcional, a ficha/skin em si
  // continuam válidas mesmo se a resolução do efeito falhar.
  let efeitoFundo: ReturnType<typeof resolverEfeitoFundo> | undefined;
  try {
    efeitoFundo = resolverEfeitoFundo(
      theme.fundoEfeito,
      lead.demo.tema?.fundoEfeitoIntensidade,
      skin.nicho,
    );
  } catch (error) {
    console.error("[radar] falha ao resolver o efeito de fundo da demo:", error);
  }
  // Cores da camada decorativa: modo de cor (vale pra qualquer efeito) ←
  // cores da aura (controle anterior, só no modo "tema") ← paleta do tema.
  // Resolvidas aqui, fora do JSX, pela MESMA função do preview e do
  // harness — ver lib/demos/efeitos/camada.ts.
  const camada = resolverCamadaEfeito({
    paleta: theme.paleta,
    efeitoId: efeitoFundo?.efeito.id,
    efeitoCores: theme.efeitoCores,
    auraCores: lead.demo.tema?.auraCores,
  });
  return { skin, theme, data, idioma, moeda, extraFontClassName, efeitoFundo, camada };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { leadId } = await params;
  const demo = await loadDemo(leadId).catch(() => undefined);
  if (!demo) return { title: "Demo" };
  return {
    title: demo.data.slogan ? `${demo.data.nome} — ${demo.data.slogan}` : demo.data.nome,
    description: demo.data.secoes.hero?.texto,
    // Prévia de prospecção: nunca indexar.
    robots: { index: false, follow: false },
  };
}

// theme-color da aba do navegador = fundo do tema da skin escolhida — cada
// demo pública tem sua própria cor de marca, não a do app (dark fixo).
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { leadId } = await params;
  const demo = await loadDemo(leadId).catch(() => undefined);
  if (!demo) return {};
  return { themeColor: demo.theme.paleta.fundo };
}

interface VisitanteInterno {
  /**
   * Sessão válida do app OU marcador de dispositivo (ver lib/device.ts) —
   * alguém do time (preview/QA), não o lead de verdade. A sessão sozinha
   * falha sempre que o navegador que abre o link não é o mesmo/não manda o
   * cookie httpOnly (ex.: navegador embutido de um app, segunda aba sem
   * sessão, sessão expirada) mesmo sendo um dispositivo do time — o
   * marcador cobre esse caso, sobrevivendo bem além da sessão.
   */
  interna: boolean;
  /** Nome de quem está logado — só quando a SESSÃO (não só o marcador de dispositivo) é válida. */
  nomeUsuario?: string;
}

/**
 * Classificação de "interna" (usada tanto pro tracking quanto pelo selo
 * "Vendo como membro") + o nome de quem está logado, quando dá pra saber.
 * Decisão sempre no servidor. Qualquer falha na resolução (Firestore fora
 * do ar, cookie corrompido etc.) cai no lado seguro — `interna: false` —
 * igual ao princípio do resto da página: sem certeza, não renderiza nada.
 */
async function visitanteInterno(db: AppDb): Promise<VisitanteInterno> {
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
 * da ficha — nunca entra na classificação de interna/externa (ver
 * visitanteInterno acima, que não os usa). Logado pra diagnosticar em
 * produção quais chegam de verdade (ver ARCHITECTURE.md).
 */
async function geoDaVisita(): Promise<{ pais?: string; regiao?: string; cidade?: string } | undefined> {
  const h = await headers();
  const pais = h.get("x-vercel-ip-country") ?? undefined;
  const regiao = h.get("x-vercel-ip-country-region") ?? undefined;
  const cidadeRaw = h.get("x-vercel-ip-city") ?? undefined;
  const cidade = cidadeRaw ? decodeURIComponent(cidadeRaw) : undefined;
  console.log("[radar] cabeçalhos de geolocalização da visita:", { pais, regiao, cidade });
  if (!pais && !regiao && !cidade) return undefined;
  return { pais, regiao, cidade };
}

export default async function DemoPage({ params, searchParams }: Props) {
  const { leadId } = await params;
  const demo = await loadDemo(leadId);
  if (!demo) notFound();

  const db = getDb();
  // Calculada uma vez, reaproveitada pelo tracking (abaixo, só com token) e
  // pelo selo "Vendo como membro" (independe de token — cobre também
  // "Abrir demo" da ficha/editor, que abre sem token de propósito).
  const visitante = await visitanteInterno(db);

  const tokenParam = (await searchParams)[TOKEN_QUERY_PARAM];
  const token = typeof tokenParam === "string" ? tokenParam : undefined;
  let visitaId: string | undefined;
  if (token) {
    try {
      const geo = await geoDaVisita();
      const registro = await registrarVisitaDemo(db, leadId, { token, interna: visitante.interna, geo });
      visitaId = registro.visitaId;
    } catch (error) {
      // Tracking nunca derruba a demo pública — o link do lead tem que abrir.
      console.error("[radar] falha ao registrar visita da demo:", error);
    }
  }

  const Skin = demo.skin.componente;
  return (
    <div className={`${demoCoreFontsClassName} ${demo.extraFontClassName}`}>
      {/*
        O layout raiz fixa <html lang="pt-BR"> (compartilhado por todo o
        app — Radar é uma ferramenta interna em pt-BR). A demo pública é a
        ÚNICA rota cujo idioma de CONTEÚDO varia por lead (ver "Idioma da
        IA na demo"): este script síncrono ajusta o atributo antes do resto
        da página pintar, mesmo padrão do THEME_INIT em app/layout.tsx.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(demo.idioma)}`,
        }}
      />
      <Skin data={demo.data} theme={demo.theme} idioma={demo.idioma} moeda={demo.moeda} />
      {demo.efeitoFundo && (
        // EfeitoCamada (client component) resolve E renderiza o efeito —
        // nunca chamar getEfeitoComponenteDinamico direto aqui: é uma
        // função comum exportada de um módulo "use client", e invocá-la
        // como função (fora de JSX) a partir deste Server Component lança
        // em runtime ("Attempted to call ... from the server"), derrubando
        // a rota pública inteira. Ver dynamicComponents.tsx.
        <EfeitoCamada
          id={demo.efeitoFundo.efeito.id}
          intensidade={demo.efeitoFundo.intensidade}
          cores={demo.camada.cores}
          coresCss={demo.camada.coresCss}
          coresAnimacao={demo.camada.coresAnimacao}
        />
      )}
      {visitante.interna && <SeloVisitaInterna nomeUsuario={visitante.nomeUsuario} />}
      {visitaId && <VisitaTracker leadId={leadId} visitaId={visitaId} />}
    </div>
  );
}
