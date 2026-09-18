import { cookies } from "next/headers";

import type { MetaProprioResponse } from "@/lib/api-client";
import { getDb } from "@/lib/firebase/admin";
import { getProgressoMetaUsuario, usuarioDaRequest } from "@/lib/usuarios";
import { BalaoFila } from "@/components/BalaoFila";
import { MetaFaixa } from "@/components/MetaFaixa";
import { Nav } from "@/components/Nav";
import { PageTransition } from "@/components/PageTransition";

/**
 * Progresso da meta resolvido no SERVIDOR, antes do primeiro desenho — a
 * mesma ideia do tema (`data-theme` já vem certo no HTML). Sem isso,
 * `MetaFaixa` nasce sem faixa nenhuma (0px) e a busca client-side, ao
 * responder, insere um bloco de ~44-52px ACIMA do cabeçalho e do
 * conteúdo — empurra as duas coisas pra baixo em TODA navegação, em TODA
 * aba, pra quem tem meta configurada (medido: CLS ~0.05 em cada uma das 7
 * abas, sempre a mesma dupla `header`+`main` como fonte). `MetaFaixa`
 * ainda faz o próprio refetch ao trocar de rota (o progresso muda
 * navegando) — isto só resolve o PRIMEIRO desenho.
 */
/**
 * `admin` sai da MESMA leitura de usuário que a meta já fazia — o balão da
 * fila é ADMIN ONLY, e resolver isso no servidor significa que, para membro,
 * ele não chega a entrar no HTML (não é um `display: none` que uma aba de
 * DevTools desfaz, nem uma chamada que volta 403 em toda tela). As rotas
 * dele cobram o papel de novo, como sempre: a tela nunca é a permissão.
 */
async function estadoInicial(): Promise<{
  meta: MetaProprioResponse | null;
  admin: boolean;
}> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const req = new Request("http://localhost/", { headers: { cookie: cookieHeader } });
  const db = getDb();
  const usuario = await usuarioDaRequest(db, req);
  if (!usuario) return { meta: null, admin: false };
  const progresso = await getProgressoMetaUsuario(db, usuario.id, usuario.metas);
  return {
    meta: { ...progresso, minimizada: usuario.metaFaixaMinimizada ?? false },
    admin: usuario.papel === "admin",
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { meta, admin } = await estadoInicial();
  return (
    <div className="flex flex-1 flex-col">
      <MetaFaixa inicial={meta} />
      <Nav />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-20 pt-4">
        <PageTransition>{children}</PageTransition>
      </main>
      {/* Fora do <main>: o balão é `fixed` e vale para a tela inteira, não
          para o conteúdo da aba. Fica no LAYOUT (e não em cada página) para
          não remontar a cada navegação — é isso que faz o estado fechado
          custar 2 leituras por carregamento em vez de 2 por aba aberta. */}
      {admin && <BalaoFila />}
    </div>
  );
}
