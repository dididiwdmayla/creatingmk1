import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { TOKEN_QUERY_PARAM } from "@/lib/demos/envio";
import { idiomaEfetivoDemo, idiomaPadraoDoLead } from "@/lib/demos/idioma";
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
import { DemoIndisponivel, metadataIndisponivel, viewportIndisponivel } from "../Indisponivel";

/**
 * Rota PÚBLICA da demo de um LEAD (a única fora da proteção por senha,
 * junto da avulsa em ../avulsa/[id] — ver src/proxy.ts). Server Component:
 * lê o lead direto do Firestore e monta o DemoData (exemplo do template ←
 * dados do lead ← edições do editor). Nenhuma chamada ao Google acontece
 * aqui — só Firestore.
 *
 * A demo só existe DEPOIS de salva no editor (/leads/{id}/demo/editar).
 * Lead inexistente responde 404. Lead SEM `demo` responde 200 com a página
 * NEUTRA ("esta demonstração não está mais disponível", ../Indisponivel.tsx):
 * a demo foi apagada — pela varredura das demos automáticas vencidas ou
 * pelo "Excluir demo" — e o link pode estar numa conversa; quem o abre não
 * cai num erro. Nada é publicado sem intenção explícita: a página neutra
 * não mostra nada do negócio.
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

/** O que a rota serve: a demo, a página neutra (lead sem demo) ou nada (404). */
type Carga = { tipo: "demo"; resolvida: DemoResolvida } | { tipo: "indisponivel"; idioma: string };

async function carregar(leadId: string): Promise<Carga | undefined> {
  const lead = await getLead(getDb(), leadId);
  if (!lead) return undefined;
  if (!lead.demo) return { tipo: "indisponivel", idioma: idiomaPadraoDoLead(lead) };
  const resolvida = await resolverDemo({
    id: leadId,
    avulsa: false,
    demo: lead.demo,
    lead,
    idioma: idiomaEfetivoDemo(lead),
    moeda: moedaDaDemo(lead),
    nome: lead.nome,
    previa: lead.capturas?.previa,
  });
  // Demo que não resolve (skin fora do registro) continua 404, como antes.
  return resolvida ? { tipo: "demo", resolvida } : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { leadId } = await params;
  const carga = await carregar(leadId).catch(() => undefined);
  if (carga?.tipo === "indisponivel") return metadataIndisponivel(carga.idioma);
  return metadataDaDemo(carga?.resolvida, `/demo/${encodeURIComponent(leadId)}/previa`);
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { leadId } = await params;
  const carga = await carregar(leadId).catch(() => undefined);
  if (carga?.tipo === "indisponivel") return viewportIndisponivel();
  return viewportDaDemo(carga?.resolvida);
}

export default async function DemoPage({ params, searchParams }: Props) {
  const { leadId } = await params;
  const carga = await carregar(leadId);
  if (!carga) notFound();
  // Sem demo: nada a rastrear nem a estampar — só a página neutra.
  if (carga.tipo === "indisponivel") return <DemoIndisponivel idioma={carga.idioma} />;
  const { resolvida } = carga;

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
