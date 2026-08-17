import { randomUUID } from "node:crypto";

import { enviosIncompletos, garantirEnviosCanais } from "@/lib/demos/envio";
import type { DemoDataPatch, TemaPatch } from "@/lib/demos/types";
import { aplicarVisita, completarVisita, type CompletarVisita, type EntradaVisita } from "@/lib/demos/visitas";
import { NotFoundError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";

import { patchIdentidadeAvulsa } from "./identidade";
import { DEMOS_AVULSAS_COLLECTION, type DemoAvulsa, type IdentidadeAvulsa } from "./types";

/**
 * Repositório de `/demosAvulsas` — mesmo estilo do de `/leads`: leitura-
 * modificação-escrita simples (single-user, centenas de docs), doc sempre
 * reescrito por inteiro em vez de merge do Firestore, pro fake dos testes
 * e o banco real se comportarem igual.
 *
 * Nada aqui toca `/leads`, `/buscas`, `/usage` ou `/usage_users`: uma demo
 * avulsa não é prospecção, não consome cota e não entra em contagem
 * nenhuma do funil (ver __tests__/fora-do-funil.test.ts).
 */

function docRef(db: AppDb, id: string) {
  return db.collection(DEMOS_AVULSAS_COLLECTION).doc(id);
}

/** Cópia sem chaves undefined — o Firestore recusa `undefined` em campo. */
function semUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function asAvulsa(data: Record<string, unknown>): DemoAvulsa {
  return data as unknown as DemoAvulsa;
}

export async function getDemoAvulsa(db: AppDb, id: string): Promise<DemoAvulsa | undefined> {
  const snap = await docRef(db, id).get();
  const data = snap.data();
  return data ? asAvulsa(data) : undefined;
}

async function requireAvulsa(db: AppDb, id: string): Promise<DemoAvulsa> {
  const avulsa = await getDemoAvulsa(db, id);
  if (!avulsa) throw new NotFoundError(`Demo avulsa "${id}" não encontrada.`);
  return avulsa;
}

/** Todas as avulsas, mais recentes primeiro (a listagem de /demos reordena como quiser). */
export async function listDemosAvulsas(db: AppDb): Promise<DemoAvulsa[]> {
  const snap = await db.collection(DEMOS_AVULSAS_COLLECTION).get();
  return snap.docs
    .map((doc) => asAvulsa(doc.data()))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export interface ConfigDemoAvulsa {
  skinId: string;
  themeId: string;
  /** Overrides de conteúdo além da identidade (efeito/modo de imagem do diálogo). */
  dados?: DemoDataPatch;
  tema?: TemaPatch;
}

/**
 * Cria a avulsa: a identidade digitada vira patch de conteúdo (camada 3),
 * exatamente onde as edições do editor moram — a demo nasce já publicável.
 *
 * Os tokens de envio (um por canal) nascem junto, como na demo de lead:
 * "Copiar link" e o link de WhatsApp precisam do token pronto no
 * carregamento da página, nunca de um fetch no clique.
 */
export async function criarDemoAvulsa(
  db: AppDb,
  identidade: IdentidadeAvulsa,
  config: ConfigDemoAvulsa,
  now: Date = new Date(),
  userId?: string,
  novoId: () => string = randomUUID,
): Promise<DemoAvulsa> {
  const em = now.toISOString();
  const id = novoId();
  const pais = identidade.pais?.trim();

  const avulsa: DemoAvulsa = semUndefined({
    id,
    pais: pais || undefined,
    demo: {
      skinId: config.skinId,
      themeId: config.themeId,
      dados: { ...config.dados, ...patchIdentidadeAvulsa(identidade) },
      ...(config.tema && { tema: config.tema }),
      criadoEm: em,
      ...(userId && { criadoPor: userId }),
      envios: garantirEnviosCanais([], em),
      atualizadoEm: em,
    },
    criadoEm: em,
    ...(userId && { criadoPor: userId }),
    atualizadoEm: em,
  });

  await docRef(db, id).set(avulsa as unknown as Record<string, unknown>);
  return avulsa;
}

/**
 * Salva a configuração da demo (o PUT do editor). `criadoEm`/`criadoPor`
 * do campo `demo` são do PRIMEIRO save e sobrevivem às edições, igual ao
 * `saveDemo` do lead.
 */
export async function saveDemoAvulsa(
  db: AppDb,
  id: string,
  demo: { skinId: string; themeId: string; dados: DemoDataPatch; tema?: TemaPatch; idioma?: string },
  now: Date = new Date(),
): Promise<DemoAvulsa> {
  const avulsa = await requireAvulsa(db, id);
  const em = now.toISOString();
  const atualizada: DemoAvulsa = {
    ...avulsa,
    demo: semUndefined({
      ...demo,
      criadoEm: avulsa.demo.criadoEm,
      ...(avulsa.demo.criadoPor && { criadoPor: avulsa.demo.criadoPor }),
      envios: garantirEnviosCanais(avulsa.demo.envios ?? [], em),
      atualizadoEm: em,
    }),
    atualizadoEm: em,
  };
  await docRef(db, id).set(atualizada as unknown as Record<string, unknown>);
  return atualizada;
}

/** País do negócio (idioma/moeda da demo) — editável fora do PUT da demo. */
export async function salvarPaisAvulsa(
  db: AppDb,
  id: string,
  pais: string | undefined,
  now: Date = new Date(),
): Promise<DemoAvulsa> {
  const avulsa = await requireAvulsa(db, id);
  const limpo = pais?.trim();
  const atualizada: DemoAvulsa = semUndefined({
    ...avulsa,
    pais: limpo || undefined,
    atualizadoEm: now.toISOString(),
  });
  await docRef(db, id).set(atualizada as unknown as Record<string, unknown>);
  return atualizada;
}

/**
 * Self-heal do token de envio por canal — mesmo papel de
 * `garantirEnvioToken` no lead: chamado no GET da listagem/editor, nunca
 * no clique.
 */
export async function garantirEnvioTokenAvulsa(
  db: AppDb,
  id: string,
  now: Date = new Date(),
): Promise<DemoAvulsa> {
  const avulsa = await requireAvulsa(db, id);
  if (!enviosIncompletos(avulsa.demo)) return avulsa;
  const atualizada: DemoAvulsa = {
    ...avulsa,
    demo: {
      ...avulsa.demo,
      envios: garantirEnviosCanais(avulsa.demo.envios ?? [], now.toISOString()),
    },
  };
  await docRef(db, id).set(atualizada as unknown as Record<string, unknown>);
  return atualizada;
}

/**
 * Registra uma visita à rota pública `/demo/avulsa/{id}`. Mesma regra da
 * demo de lead (ver `aplicarVisita`): só com `?t=`, e visita interna nunca
 * consome o token vigente.
 */
export async function registrarVisitaAvulsa(
  db: AppDb,
  id: string,
  entrada: EntradaVisita,
  now: Date = new Date(),
): Promise<{ avulsa: DemoAvulsa; visitaId?: string }> {
  const avulsa = await requireAvulsa(db, id);
  if (!entrada.token) return { avulsa };

  const { envios, visita } = aplicarVisita(avulsa.demo, entrada, now.toISOString());
  const atualizada: DemoAvulsa = {
    ...avulsa,
    demo: { ...avulsa.demo, envios },
    demoVisitas: [...(avulsa.demoVisitas ?? []), visita],
  };
  await docRef(db, id).set(atualizada as unknown as Record<string, unknown>);
  return { avulsa: atualizada, visitaId: visita.id };
}

/** Completa duração/scroll de uma visita — o beacon do unload. No-op silencioso. */
export async function atualizarVisitaAvulsa(
  db: AppDb,
  id: string,
  visitaId: string,
  dados: CompletarVisita,
): Promise<DemoAvulsa | undefined> {
  const avulsa = await getDemoAvulsa(db, id);
  if (!avulsa?.demoVisitas) return avulsa;

  const visitas = completarVisita(avulsa.demoVisitas, visitaId, dados);
  if (visitas === avulsa.demoVisitas) return avulsa;
  const atualizada: DemoAvulsa = { ...avulsa, demoVisitas: visitas };
  await docRef(db, id).set(atualizada as unknown as Record<string, unknown>);
  return atualizada;
}

/**
 * Apaga a avulsa INTEIRA. Ao contrário do lead — onde "Excluir demo" tira
 * só o campo `demo` e o prospect continua na base —, aqui a demo é o
 * registro todo: não sobra nada que faça sentido guardar.
 */
export async function deleteDemoAvulsa(db: AppDb, id: string): Promise<void> {
  await requireAvulsa(db, id);
  await docRef(db, id).delete();
}

/** Remove o override de imagem de um slot (volta ao placeholder do template). */
export async function removeImagemAvulsa(
  db: AppDb,
  id: string,
  slot: string,
  now: Date = new Date(),
): Promise<DemoAvulsa> {
  return removerOverride(db, id, "imagens", slot, now);
}

/** Mesma lógica de removeImagemAvulsa, para `dados.videos[slot]`. */
export async function removeVideoAvulsa(
  db: AppDb,
  id: string,
  slot: string,
  now: Date = new Date(),
): Promise<DemoAvulsa> {
  return removerOverride(db, id, "videos", slot, now);
}

async function removerOverride(
  db: AppDb,
  id: string,
  campo: "imagens" | "videos",
  slot: string,
  now: Date,
): Promise<DemoAvulsa> {
  const avulsa = await requireAvulsa(db, id);
  if (!avulsa.demo.dados[campo]?.[slot]) return avulsa;
  const overrides = { ...avulsa.demo.dados[campo] };
  delete overrides[slot];
  const atualizada: DemoAvulsa = {
    ...avulsa,
    demo: { ...avulsa.demo, dados: { ...avulsa.demo.dados, [campo]: overrides } },
    atualizadoEm: now.toISOString(),
  };
  await docRef(db, id).set(atualizada as unknown as Record<string, unknown>);
  return atualizada;
}
