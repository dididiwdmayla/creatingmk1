import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { nomeDaAvulsa } from "@/lib/demos/avulsas/identidade";
import { idiomaEfetivoAvulsa, moedaDaAvulsa } from "@/lib/demos/avulsas/idioma";
import { getDemoAvulsa, registrarVisitaAvulsa } from "@/lib/demos/avulsas/repo";
import { TOKEN_QUERY_PARAM } from "@/lib/demos/envio";
import { getDb } from "@/lib/firebase/admin";

import {
  PaginaDemo,
  geoDaVisita,
  metadataDaDemo,
  resolverDemo,
  viewportDaDemo,
  visitanteInterno,
  type DemoResolvida,
} from "../../comum";

/**
 * Rota PÚBLICA da demo AVULSA — a que existe sem lead associado. Gêmea de
 * `/demo/{leadId}`: mesmo Server Component, mesmo `montarDemoData`, mesmo
 * cartão de conversa, mesmo rastreio de abertura por token. A única
 * diferença é a origem do dado (coleção `/demosAvulsas`) e a ausência da
 * camada `dadosDoLead` — ver ../../comum.tsx.
 *
 * O segmento estático `avulsa` tem precedência sobre o `[leadId]` irmão,
 * então `/demo/avulsa/{id}` nunca é confundido com um lead cujo Place ID
 * fosse "avulsa".
 *
 * Idioma e moeda saem do PAÍS digitado na criação (`DemoAvulsa.pais`), no
 * lugar do país extraído do endereço que o Google devolveu.
 */

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function carregar(id: string): Promise<DemoResolvida | undefined> {
  const avulsa = await getDemoAvulsa(getDb(), id);
  if (!avulsa) return undefined;
  return resolverDemo({
    id,
    avulsa: true,
    demo: avulsa.demo,
    idioma: idiomaEfetivoAvulsa(avulsa),
    moeda: moedaDaAvulsa(avulsa),
    nome: nomeDaAvulsa(avulsa),
    previa: avulsa.capturas?.previa,
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const resolvida = await carregar(id).catch(() => undefined);
  return metadataDaDemo(resolvida, `/demo/avulsa/${encodeURIComponent(id)}/previa`);
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { id } = await params;
  return viewportDaDemo(await carregar(id).catch(() => undefined));
}

export default async function DemoAvulsaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const resolvida = await carregar(id);
  if (!resolvida) notFound();

  const db = getDb();
  const visitante = await visitanteInterno(db);

  const tokenParam = (await searchParams)[TOKEN_QUERY_PARAM];
  const token = typeof tokenParam === "string" ? tokenParam : undefined;
  let visitaId: string | undefined;
  if (token) {
    try {
      const geo = await geoDaVisita();
      const registro = await registrarVisitaAvulsa(db, id, {
        token,
        interna: visitante.interna,
        geo,
      });
      visitaId = registro.visitaId;
    } catch (error) {
      // Tracking nunca derruba a demo pública — o link tem que abrir.
      console.error("[radar] falha ao registrar visita da demo avulsa:", error);
    }
  }

  return <PaginaDemo resolvida={resolvida} visitante={visitante} visitaId={visitaId} />;
}
