import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { SESSION_COOKIE, appPassword, lerSessaoToken } from "@/lib/auth";
import { TOKEN_QUERY_PARAM } from "@/lib/demos/envio";
import { getSkin, getTheme } from "@/lib/demos/registry";
import { montarDemoData } from "@/lib/demos/montar";
import { aplicarTema } from "@/lib/demos/tema";
import { getDb } from "@/lib/firebase/admin";
import { getLead, registrarVisitaDemo } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";
import { demoCoreFontsClassName, resolveExtraFontClassNames } from "../fonts";
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
  // Só busca (import dinâmico) as fontes curadas que o editor de fato
  // escolheu — o resto da lista nunca chega a ser fetched pelo cliente.
  const extraFontClassName = await resolveExtraFontClassNames([
    lead.demo.tema?.fonteDisplay,
    lead.demo.tema?.fonteCorpo,
  ]);
  return { skin, theme, data, extraFontClassName };
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

/**
 * "Interna" = o navegador que abriu a demo tem cookie de sessão válido do
 * app — ou seja, alguém do time (preview/QA), não o lead de verdade. Só
 * essa distinção separa "visita real" de "abri pra conferir" na timeline
 * da ficha e na fila "abriram e não responderam".
 */
async function requestEhInterna(): Promise<boolean> {
  const secret = appPassword();
  if (!secret) return false;
  const valor = (await cookies()).get(SESSION_COOKIE)?.value;
  return (await lerSessaoToken(valor, secret)) !== null;
}

export default async function DemoPage({ params, searchParams }: Props) {
  const { leadId } = await params;
  const demo = await loadDemo(leadId);
  if (!demo) notFound();

  const tokenParam = (await searchParams)[TOKEN_QUERY_PARAM];
  const token = typeof tokenParam === "string" ? tokenParam : undefined;
  let visitaId: string | undefined;
  if (token) {
    try {
      const interna = await requestEhInterna();
      const registro = await registrarVisitaDemo(getDb(), leadId, { token, interna });
      visitaId = registro.visitaId;
    } catch (error) {
      // Tracking nunca derruba a demo pública — o link do lead tem que abrir.
      console.error("[radar] falha ao registrar visita da demo:", error);
    }
  }

  const Skin = demo.skin.componente;
  return (
    <div className={`${demoCoreFontsClassName} ${demo.extraFontClassName}`}>
      <Skin data={demo.data} theme={demo.theme} />
      {visitaId && <VisitaTracker leadId={leadId} visitaId={visitaId} />}
    </div>
  );
}
