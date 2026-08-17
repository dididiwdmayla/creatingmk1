import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { TOKEN_QUERY_PARAM } from "@/lib/demos/envio";
import { idiomaEfetivoDemo } from "@/lib/demos/idioma";
import { moedaDaDemo } from "@/lib/demos/moeda";
import { getDb } from "@/lib/firebase/admin";
import { getLead, registrarVisitaDemo } from "@/lib/leads/repo";

import {
  PaginaDemo,
  geoDaVisita,
  metadataDaDemo,
  resolverDemo,
  viewportDaDemo,
  visitanteInterno,
  type DemoResolvida,
} from "../comum";

/**
 * Rota PÚBLICA da demo de um LEAD (a única fora da proteção por senha,
 * junto da avulsa em ../avulsa/[id] — ver src/proxy.ts). Server Component:
 * lê o lead direto do Firestore e monta o DemoData (exemplo do template ←
 * dados do lead ← edições do editor). Nenhuma chamada ao Google acontece
 * aqui — só Firestore.
 *
 * A demo só existe DEPOIS de salva no editor (/leads/{id}/demo/editar):
 * lead sem `demo` responde 404 — mesma resposta de lead inexistente, e o
 * que "Excluir demo" restaura. Nada é publicado sem intenção explícita.
 *
 * Tudo o que não é "de onde vem o dado" mora em ../comum.tsx, dividido com
 * a rota da demo avulsa.
 */

// Sempre por request: a demo reflete a última edição da ficha na hora.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function carregar(leadId: string): Promise<DemoResolvida | undefined> {
  const lead = await getLead(getDb(), leadId);
  if (!lead?.demo) return undefined;
  return resolverDemo({
    id: leadId,
    avulsa: false,
    demo: lead.demo,
    lead,
    idioma: idiomaEfetivoDemo(lead),
    moeda: moedaDaDemo(lead),
    nome: lead.nome,
    previa: lead.capturas?.previa,
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { leadId } = await params;
  const resolvida = await carregar(leadId).catch(() => undefined);
  return metadataDaDemo(resolvida, `/demo/${encodeURIComponent(leadId)}/previa`);
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { leadId } = await params;
  return viewportDaDemo(await carregar(leadId).catch(() => undefined));
}

export default async function DemoPage({ params, searchParams }: Props) {
  const { leadId } = await params;
  const resolvida = await carregar(leadId);
  if (!resolvida) notFound();

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
      const registro = await registrarVisitaDemo(db, leadId, {
        token,
        interna: visitante.interna,
        geo,
      });
      visitaId = registro.visitaId;
    } catch (error) {
      // Tracking nunca derruba a demo pública — o link do lead tem que abrir.
      console.error("[radar] falha ao registrar visita da demo:", error);
    }
  }

  return <PaginaDemo resolvida={resolvida} visitante={visitante} visitaId={visitaId} />;
}
