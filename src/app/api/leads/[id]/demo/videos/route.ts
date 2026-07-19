import { NextResponse } from "next/server";

import { DEFAULT_SKIN, getSkin } from "@/lib/demos/registry";
import { removerVideoDemo, salvarVideoDemo, validarSlotVideo, validarVideo } from "@/lib/demos/videos";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { getDemoStorage } from "@/lib/firebase/storage";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { getLead, removeDemoVideo } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";

/**
 * Vídeo-no-título da demo de um lead (Firebase Storage) — mesmo padrão da
 * rota de imagens (src/app/api/leads/[id]/demo/imagens/route.ts), mas
 * validando o slot contra SkinDefinition.videoSlots (opt-in por skin) em
 * vez das chaves de `imagens` do exemplo.
 *
 * POST — multipart/form-data com `slot` + `arquivo` (mp4/webm, ≤15MB).
 * Sobe para demos/{leadId}/video-{slot}-{ts}.{ext} (apagando versões
 * velhas do slot) e devolve `{ slot, url }` — o editor coloca a URL em
 * dados.videos[slot] e persiste no PUT normal da demo.
 *
 * DELETE — corpo `{ slot }`: apaga os arquivos do slot e, se a demo salva
 * tinha override para o slot, remove o override (a skin volta ao
 * fallback — imagem do slot correspondente, ou cor sólida — na hora).
 */

async function requireLead(id: string): Promise<Lead> {
  const lead = await getLead(getDb(), id);
  if (!lead) throw new NotFoundError(`Lead "${id}" não encontrado.`);
  return lead;
}

/** Slots de vídeo válidos = SkinDefinition.videoSlots da skin do lead (ou a pedida). */
function slotsDeVideoDaSkin(lead: Lead, skinId?: string): readonly string[] {
  const skin = getSkin(skinId) ?? getSkin(lead.demo?.skinId) ?? DEFAULT_SKIN;
  return skin.videoSlots ?? [];
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const lead = await requireLead(id);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ValidationError(["corpo deve ser multipart/form-data com slot e arquivo"]);
    }
    const skinId = form.get("skinId");
    const slot = validarSlotVideo(
      form.get("slot"),
      slotsDeVideoDaSkin(lead, typeof skinId === "string" ? skinId : undefined),
    );
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File)) {
      throw new ValidationError(["arquivo ausente (campo multipart 'arquivo')"]);
    }
    validarVideo(arquivo.type, arquivo.size);

    const data = new Uint8Array(await arquivo.arrayBuffer());
    const url = await salvarVideoDemo(getDemoStorage(), id, slot, data, arquivo.type);
    return NextResponse.json({ slot, url });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const lead = await requireLead(id);
    const body = await readJsonBody(req);
    // skinId opcional: cobre remover antes do primeiro save (lead.demo
    // ainda não existe, então não há skin salva pra cair de volta).
    const slot = validarSlotVideo(
      body.slot,
      slotsDeVideoDaSkin(lead, typeof body.skinId === "string" ? body.skinId : undefined),
    );

    await removerVideoDemo(getDemoStorage(), id, slot);
    const atualizado = await removeDemoVideo(getDb(), id, slot);
    return NextResponse.json({ lead: atualizado });
  } catch (error) {
    return handleRouteError(error);
  }
}
