import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DEFAULT_SKIN, getSkin, getTheme } from "@/lib/demos/registry";
import { montarDemoData } from "@/lib/demos/montar";
import { getDb } from "@/lib/firebase/admin";
import { getLead } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";
import { demoFontsClassName } from "../fonts";

/**
 * Rota PÚBLICA da demo de um lead (a única fora da proteção por senha —
 * ver src/proxy.ts). Server Component: lê o lead direto do Firestore e
 * monta o DemoData (exemplo do template ← dados do lead ← edições da
 * ficha). Nenhuma chamada ao Google acontece aqui — só Firestore.
 *
 * Sem demo salva na ficha, a skin default renderiza com os dados que o
 * lead já tem: o link /demo/{leadId} funciona antes de qualquer edição.
 */

// Sempre por request: a demo reflete a última edição da ficha na hora.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ leadId: string }> };

async function loadDemo(leadId: string) {
  const lead: Lead | undefined = await getLead(getDb(), leadId);
  if (!lead) return undefined;
  const skin = getSkin(lead.demo?.skinId) ?? DEFAULT_SKIN;
  const theme = getTheme(skin, lead.demo?.themeId);
  const data = montarDemoData(skin.demoDataExemplo, lead, lead.demo?.dados);
  return { skin, theme, data };
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
    <div className={demoFontsClassName}>
      <Skin data={demo.data} theme={demo.theme} />
    </div>
  );
}
