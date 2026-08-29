import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { getUsage } from "@/lib/costs";
import { cotacaoImportacaoMaps, importarDoGoogleMaps } from "@/lib/demos/avulsas/googleMaps";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { usuarioDaRequest } from "@/lib/usuarios";

export async function GET(req: Request) {
  try {
    const db = getDb();
    if (!(await usuarioDaRequest(db, req))) throw new UnauthorizedError();
    const [config, { usage }] = await Promise.all([loadConfig(db), getUsage(db)]);
    return NextResponse.json(cotacaoImportacaoMaps(config, usage));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();
    const body = await readJsonBody(req);
    if (typeof body.link !== "string") throw new ValidationError(["link é obrigatório"]);
    const config = await loadConfig(db);
    const identidade = await importarDoGoogleMaps(db, body.link, config.caps, {
      id: usuario.id,
      isAdmin: usuario.papel === "admin",
      limites: usuario.limites,
    });
    const lead = await db.collection("leads").doc(identidade.placeId).get();
    return NextResponse.json({ identidade, leadExistente: lead.exists ? { id: identidade.placeId } : null });
  } catch (error) {
    return handleRouteError(error);
  }
}
