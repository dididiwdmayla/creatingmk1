import { cookies } from "next/headers";

import { getDb } from "@/lib/firebase/admin";
import { normalizaPaineisConfigAbertos, usuarioDaRequest } from "@/lib/usuarios";
import type { PaineisConfigAbertos } from "@/lib/usuarios/preferencias";

import ConfigClient from "./ConfigClient";

/**
 * Quais painéis desta página abrem de cara, resolvido no SERVIDOR — mesma
 * ideia do progresso da meta no `AppLayout` e do tema no `<html>`: a
 * preferência já chega no primeiro desenho.
 *
 * Sem isto, a página pintaria com tudo fechado e a busca do cliente, ao
 * responder, EXPANDIRIA os painéis guardados — empurrando para baixo tudo
 * o que vem depois de cada um. É o deslocamento que o portão de CLS reprova
 * (ver "Deslocamento de layout" no ARCHITECTURE.md), e aqui ele seria
 * grande: um painel aberto cresce centenas de pixels.
 *
 * Falha de leitura (sessão ausente, banco fora do ar) cai em "tudo
 * fechado", que é o padrão — a preferência é acessório e não pode impedir
 * a página de abrir.
 */
async function paineisIniciais(): Promise<PaineisConfigAbertos> {
  try {
    const jar = await cookies();
    const cookieHeader = jar
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const req = new Request("http://localhost/", { headers: { cookie: cookieHeader } });
    const usuario = await usuarioDaRequest(getDb(), req);
    return normalizaPaineisConfigAbertos(usuario?.paineisConfigAbertos);
  } catch {
    return [];
  }
}

export default async function ConfigPage() {
  return <ConfigClient paineisIniciais={await paineisIniciais()} />;
}
