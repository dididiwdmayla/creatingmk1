import { cookies } from "next/headers";

import type { MetaProprioResponse } from "@/lib/api-client";
import { getDb } from "@/lib/firebase/admin";
import { getProgressoMetaUsuario, usuarioDaRequest } from "@/lib/usuarios";
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
async function metaInicial(): Promise<MetaProprioResponse | null> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const req = new Request("http://localhost/", { headers: { cookie: cookieHeader } });
  const db = getDb();
  const usuario = await usuarioDaRequest(db, req);
  if (!usuario) return null;
  const progresso = await getProgressoMetaUsuario(db, usuario.id, usuario.metas);
  return { ...progresso, minimizada: usuario.metaFaixaMinimizada ?? false };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const inicial = await metaInicial();
  return (
    <div className="flex flex-1 flex-col">
      <MetaFaixa inicial={inicial} />
      <Nav />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-20 pt-4">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
