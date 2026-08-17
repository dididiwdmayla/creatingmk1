import { NextResponse } from "next/server";

import { getDemoAvulsa, removeImagemAvulsa } from "@/lib/demos/avulsas/repo";
import type { DemoAvulsa } from "@/lib/demos/avulsas/types";
import {
  removerImagemDemo,
  salvarImagemDemo,
  validarImagem,
  validarSlot,
} from "@/lib/demos/imagens";
import { DEFAULT_SKIN, getSkin } from "@/lib/demos/registry";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { getDemoStorage } from "@/lib/firebase/storage";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * Imagens da demo avulsa — mesma rota da demo de lead
 * (`/api/leads/[id]/demo/imagens`), mesmo Storage, mesma convenção de
 * caminho (`demos/{id}/{slot}-{ts}.{ext}`). O id da avulsa é UUID e não
 * colide com Place ID, então as duas famílias dividem o bucket sem
 * namespace extra.
 */

type Params = { params: Promise<{ id: string }> };

async function requireAvulsa(id: string): Promise<DemoAvulsa> {
  const avulsa = await getDemoAvulsa(getDb(), id);
  if (!avulsa) throw new NotFoundError(`Demo avulsa "${id}" não encontrada.`);
  return avulsa;
}

function slotsDaSkin(avulsa: DemoAvulsa, skinId?: string): string[] {
  const skin = getSkin(skinId) ?? getSkin(avulsa.demo.skinId) ?? DEFAULT_SKIN;
  return Object.keys(skin.demoDataExemplo.imagens);
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
    const slot = validarSlot(
      form.get("slot"),
      slotsDaSkin(avulsa, typeof skinId === "string" ? skinId : undefined),
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

export async function DELETE(req: Request, { params }: Params) {
  try {
    const db = getDb();
    if (!(await usuarioDaRequest(db, req))) throw new UnauthorizedError();

    const { id } = await params;
    const avulsa = await requireAvulsa(id);
    const body = await readJsonBody(req);
    const slot = validarSlot(
      body.slot,
      slotsDaSkin(avulsa, typeof body.skinId === "string" ? body.skinId : undefined),
    );

    await removerImagemDemo(getDemoStorage(), id, slot);
    return NextResponse.json({ avulsa: await removeImagemAvulsa(db, id, slot) });
  } catch (error) {
    return handleRouteError(error);
  }
}
