import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  appPassword,
  criarSessaoToken,
} from "@/lib/auth";
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_OPTIONS,
  deviceIdValido,
  gerarDeviceId,
  lerCookieDoRequest,
} from "@/lib/device";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/http";
import { getUsuarioPorNome, seedUsuariosSeVazio, verificarSenha } from "@/lib/usuarios";

/**
 * Única rota fora da proteção do proxy: recebe { nome, senha }, identifica
 * o usuário em /usuarios e estabelece o cookie de sessão assinado com o id
 * dele. `nome` ausente cai em "admin" (compatível com o fluxo antigo de
 * senha única via curl).
 *
 * Migração da senha única: na primeira tentativa de login com /usuarios
 * vazia, o seed cria o admin (senha = APP_PASSWORD atual) + 2 membros sem
 * senha (o admin define em /config) — quem já usava o app continua
 * entrando com a mesma senha, agora como admin.
 */
export async function POST(req: Request) {
  try {
    const secret = appPassword();
    if (!secret) {
      return jsonError(
        503,
        "config_error",
        "APP_PASSWORD não configurada no servidor (ver .env.example).",
      );
    }

    const body = await readJsonBody(req);
    const nome = typeof body.nome === "string" && body.nome.trim() ? body.nome : "admin";
    const senha = typeof body.senha === "string" ? body.senha : "";

    const db = getDb();
    await seedUsuariosSeVazio(db, secret);

    const usuario = await getUsuarioPorNome(db, nome);
    const confere = usuario ? await verificarSenha(senha, usuario.senhaHash) : false;
    if (!usuario || !usuario.ativo || !confere) {
      return jsonError(
        401,
        "invalid_credentials",
        "Usuário ou senha incorretos (ou usuário inativo/sem senha definida — fale com o admin).",
      );
    }

    const res = new NextResponse(null, { status: 204 });
    res.cookies.set(
      SESSION_COOKIE,
      await criarSessaoToken(
        { userId: usuario.id, papel: usuario.papel, versao: usuario.sessao },
        secret,
      ),
      { ...SESSION_COOKIE_OPTIONS },
    );

    // Marcador de dispositivo (ver lib/device.ts): mantém o id existente se
    // o navegador já tiver um (não precisa trocar a cada login), só gera um
    // novo quando ausente/malformado. Sobrevive além da sessão — é o sinal
    // usado pra classificar visitas da demo como internas sem sessão válida.
    const deviceAtual = lerCookieDoRequest(req, DEVICE_COOKIE);
    const deviceId = deviceIdValido(deviceAtual) ? deviceAtual : gerarDeviceId();
    res.cookies.set(DEVICE_COOKIE, deviceId, { ...DEVICE_COOKIE_OPTIONS });

    return res;
  } catch (error) {
    return handleRouteError(error);
  }
}
