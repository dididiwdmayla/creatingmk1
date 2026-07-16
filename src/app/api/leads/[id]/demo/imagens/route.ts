import { NextResponse } from "next/server";

import {
  removerImagemDemo,
  salvarImagemDemo,
  validarImagem,
  validarSlot,
} from "@/lib/demos/imagens";
import { DEFAULT_SKIN, getSkin } from "@/lib/demos/registry";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { getDemoStorage } from "@/lib/firebase/storage";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { getLead, removeDemoImagem } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";

/**
 * Imagens da demo de um lead (Firebase Storage).
 *
 * POST — multipart/form-data com `slot` + `arquivo` (jpg/png/webp, ≤2MB;
 * o editor comprime client-side antes). Sobe para
 * demos/{leadId}/{slot}-{ts}.{ext} (apagando versões velhas do slot) e
 * devolve `{ slot, url }` — o editor coloca a URL em dados.imagens[slot]
 * e persiste no PUT normal da demo.
 *
 * DELETE — corpo `{ slot }`: apaga os arquivos do slot no Storage e, se a
 * demo salva tinha override para o slot, remove o override (a demo pública
 * volta ao placeholder na hora — nunca fica apontando pra arquivo morto).
 */

async function requireLead(id: string): Promise<Lead> {
  const lead = await getLead(getDb(), id);
  if (!lead) throw new NotFoundError(`Lead "${id}" não encontrado.`);
  return lead;
}

/** Slots válidos = chaves de imagens do exemplo da skin do lead (ou a pedida). */
function slotsDaSkin(lead: Lead, skinId?: string): string[] {
  const skin = getSkin(skinId) ?? getSkin(lead.demo?.skinId) ?? DEFAULT_SKIN;
  return Object.keys(skin.demoDataExemplo.imagens);
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
    const slot = validarSlot(
      form.get("slot"),
      slotsDaSkin(lead, typeof skinId === "string" ? skinId : undefined),
    );
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File)) {
      throw new ValidationError(["arquivo ausente (campo multipart 'arquivo')"]);
    }
    validarImagem(arquivo.type, arquivo.size);

    const data = new Uint8Array(await arquivo.arrayBuffer());
    const url = await salvarImagemDemo(getDemoStorage(), id, slot, data, arquivo.type);
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
    const slot = validarSlot(body.slot, slotsDaSkin(lead));

    await removerImagemDemo(getDemoStorage(), id, slot);
    const atualizado = await removeDemoImagem(getDb(), id, slot);
    return NextResponse.json({ lead: atualizado });
  } catch (error) {
    return handleRouteError(error);
  }
}
