import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSkin, getTheme } from "@/lib/demos/registry";
import { montarDemoData } from "@/lib/demos/montar";
import { aplicarTema } from "@/lib/demos/tema";
import { getDb } from "@/lib/firebase/admin";
import { getLead } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";
import { demoCoreFontsClassName, resolveExtraFontClassNames } from "../fonts";

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

type Props = { params: Promise<{ leadId: string }> };

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

export default async function DemoPage({ params }: Props) {
  const { leadId } = await params;
  const demo = await loadDemo(leadId);
  if (!demo) notFound();

  const Skin = demo.skin.componente;
  return (
    <div className={`${demoCoreFontsClassName} ${demo.extraFontClassName}`}>
      <Skin data={demo.data} theme={demo.theme} />
    </div>
  );
}
