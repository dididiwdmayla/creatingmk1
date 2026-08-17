import { NextResponse } from "next/server";

import { getDemoAvulsa, removeVideoAvulsa } from "@/lib/demos/avulsas/repo";
import type { DemoAvulsa } from "@/lib/demos/avulsas/types";
import { DEFAULT_SKIN, getSkin } from "@/lib/demos/registry";
import { removerVideoDemo, salvarVideoDemo, validarSlotVideo, validarVideo } from "@/lib/demos/videos";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { getDemoStorage } from "@/lib/firebase/storage";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * Vídeo-no-título da demo avulsa — irmã da rota de imagens ao lado, e da
 * de vídeo do lead: valida o slot contra `SkinDefinition.videoSlots`
 * (opt-in por skin) em vez das chaves de `imagens`.
 */

type Params = { params: Promise<{ id: string }> };

async function requireAvulsa(id: string): Promise<DemoAvulsa> {
  const avulsa = await getDemoAvulsa(getDb(), id);
  if (!avulsa) throw new NotFoundError(`Demo avulsa "${id}" não encontrada.`);
  return avulsa;
}

function slotsDeVideoDaSkin(avulsa: DemoAvulsa, skinId?: string): readonly string[] {
  const skin = getSkin(skinId) ?? getSkin(avulsa.demo.skinId) ?? DEFAULT_SKIN;
  return skin.videoSlots ?? [];
}

export async function POST(req: Request, { params }: Params) {
  try {
    const db = getDb();
    if (!(await usuarioDaRequest(db, req))) throw new UnauthorizedError();

    const { id } = await params;
    const avulsa = await requireAvulsa(id);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ValidationError(["corpo deve ser multipart/form-data com slot e arquivo"]);
    }
    const skinId = form.get("skinId");
    const slot = validarSlotVideo(
      form.get("slot"),
      slotsDeVideoDaSkin(avulsa, typeof skinId === "string" ? skinId : undefined),
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

export async function DELETE(req: Request, { params }: Params) {
  try {
    const db = getDb();
    if (!(await usuarioDaRequest(db, req))) throw new UnauthorizedError();

    const { id } = await params;
    const avulsa = await requireAvulsa(id);
    const body = await readJsonBody(req);
    const slot = validarSlotVideo(
      body.slot,
      slotsDeVideoDaSkin(avulsa, typeof body.skinId === "string" ? body.skinId : undefined),
    );

    await removerVideoDemo(getDemoStorage(), id, slot);
    return NextResponse.json({ avulsa: await removeVideoAvulsa(db, id, slot) });
  } catch (error) {
    return handleRouteError(error);
  }
}
