import { NextResponse } from "next/server";

import { QuotaExceededError } from "@/lib/costs";
import {
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { PlacesError } from "@/lib/places/client";

/**
 * Formato de erro padrão de todas as rotas (contrato do ARCHITECTURE.md):
 * { error: { code, message, ...extras } }
 */
export function jsonError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/** Mapeia erros de domínio para os HTTP status fixos do contrato. */
export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof QuotaExceededError) {
    return jsonError(429, error.code, error.message, {
      sku: error.sku,
      used: error.used,
      cap: error.cap,
      period: error.period,
    });
  }
  if (error instanceof PlacesError) {
    return jsonError(502, error.code, error.message, {
      googleStatus: error.googleStatus,
      detail: error.detail,
    });
  }
  if (error instanceof ValidationError) {
    return jsonError(400, error.code, error.message, {
      problemas: error.problemas,
    });
  }
  if (error instanceof UnauthorizedError) {
    return jsonError(401, error.code, error.message);
  }
  if (error instanceof ForbiddenError) {
    return jsonError(403, error.code, error.message);
  }
  if (error instanceof NotFoundError) {
    return jsonError(404, error.code, error.message);
  }
  if (error instanceof InvalidTransitionError) {
    return jsonError(409, error.code, error.message, {
      de: error.de,
      para: error.para,
    });
  }
  console.error("[radar] erro não mapeado na rota:", error);
  return jsonError(
    500,
    "internal_error",
    error instanceof Error ? error.message : "Erro interno.",
  );
}

/** Corpo JSON do request. Corpo vazio é {}; JSON inválido/não-objeto → 400. */
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError(["corpo deve ser JSON válido"]);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError(["corpo deve ser um objeto JSON"]);
  }
  return parsed as Record<string, unknown>;
}
