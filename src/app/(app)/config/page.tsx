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

/**
 * `?abrir={id do painel}` abre aquele painel NESTA visita, além dos
 * guardados — é o "ver agenda completa" do balão da fila
 * (`/config?abrir=fila-envio#painel-fila-envio`). Não grava a preferência:
 * quem segue um link quer ver, não mudar como a página abre amanhã. Resolvido
 * aqui, junto da preferência, pelo mesmo motivo dela: o painel já chega
 * aberto no primeiro desenho, e o `#` cai no lugar certo.
 */
export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  const [guardados, { abrir }] = await Promise.all([paineisIniciais(), searchParams]);
  const pedido = typeof abrir === "string" && abrir.length > 0 && abrir.length <= 64 ? abrir : undefined;
  const iniciais = pedido && !guardados.includes(pedido) ? [...guardados, pedido] : guardados;
  return <ConfigClient paineisIniciais={iniciais} />;
}
